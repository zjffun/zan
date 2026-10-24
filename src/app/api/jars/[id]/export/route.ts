import { NextResponse } from "next/server";
import { getCurrentUser, loadJar } from "@/lib/dal";
import { exportJarMarkdown } from "@/lib/export/markdown";

/** Markdown export of one jar: the user can always take their data away. */
export async function GET(_request: Request, ctx: RouteContext<"/api/jars/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const bundle = await loadJar(id); // row level security: null unless it is the caller's jar
  if (!bundle) return NextResponse.json({ error: "not found" }, { status: 404 });

  const markdown = exportJarMarkdown({
    work: bundle.work,
    sources: bundle.sources,
    notes: bundle.notes,
    exportedAt: new Date().toISOString().slice(0, 10),
  });

  const safeName = bundle.work.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 80) || "zan";
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="zan.md"; filename*=UTF-8''${encodeURIComponent(safeName)}.md`,
      "Cache-Control": "private, no-store",
    },
  });
}
