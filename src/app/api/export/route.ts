import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { exportPostsMarkdown, type ExportPost } from "@/lib/export/markdown";
import { createClient } from "@/lib/supabase/server";

interface Row extends Omit<ExportPost, "tags"> {
  post_tags: { tag: { name: string } | null }[] | null;
}

/** Everything the signed-in user has posted, as one Markdown file: you can always take your data away. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("created_at, visibility, source, source_status, anchor, body, plain_text, post_tags(tag:tags(name))")
    .eq("author", user.id)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) return NextResponse.json({ error: "export failed" }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const markdown = exportPostsMarkdown({
    posts: ((data ?? []) as unknown as Row[]).map(({ post_tags, ...post }) => ({
      ...post,
      tags: (post_tags ?? []).flatMap((row) => (row.tag ? [row.tag] : [])),
    })),
    exportedAt: today,
  });
  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="zan-${today}.md"`,
      "cache-control": "private, no-store",
    },
  });
}
