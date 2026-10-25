import { NextResponse, type NextRequest } from "next/server";
import { readAnchors } from "@/lib/anchor";
import { getCurrentUser } from "@/lib/dal";
import { exportPostsMarkdown, type ExportPost } from "@/lib/export/markdown";
import { enforce, LIMITS } from "@/lib/server/limits";
import { logError } from "@/lib/server/log";
import { createClient } from "@/lib/supabase/server";

interface Row extends Omit<ExportPost, "tags" | "anchors"> {
  /** the list of positions; `anchor` is the old single position of posts from before the list existed */
  anchors: unknown;
  anchor: unknown;
  post_tags: { tag: { name: string } | null }[] | null;
}

/** Everything the signed-in user has posted, as one Markdown file: you can always take your data away. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = await enforce(LIMITS.exportAll, user.id);
  if (!limited.ok) {
    return NextResponse.json({ error: "too many exports" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("created_at, visibility, source, source_status, anchor, anchors, body, plain_text, post_tags(tag:tags(name))")
    .eq("author", user.id)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) {
    logError("export", error, { author: user.id });
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const markdown = exportPostsMarkdown({
    posts: ((data ?? []) as unknown as Row[]).map(({ post_tags, anchor, anchors, ...post }) => ({
      ...post,
      anchors: readAnchors(anchors, anchor),
      tags: (post_tags ?? []).flatMap((row) => (row.tag ? [row.tag] : [])),
    })),
    exportedAt: today,
    origin: request.nextUrl.origin,
  });
  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="zan-${today}.md"`,
      "cache-control": "private, no-store",
    },
  });
}
