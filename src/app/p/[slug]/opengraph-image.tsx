import { ImageResponse } from "next/og";
import { isAllowedImageRedirectHost, isAllowedImageUrl } from "@/lib/links/hosts";
import { followAllowedRedirects } from "@/lib/server/http";
import { getPublicPage, listPublicPages, SLUG_PATTERN } from "@/lib/public";
import { parseSnapshot } from "@/lib/snapshot";
import { WORK_KIND_LABEL } from "@/lib/types";

export const alt = "zan 作品笔记";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori (the renderer behind ImageResponse) ships no CJK glyphs, so fetch a
 * subset of Noto Sans SC containing exactly the characters we draw. A legacy
 * User-Agent makes Google Fonts answer with TTF, which Satori can read.
 * Failure is not fatal: the image still renders, with fallback glyphs.
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.54 (KHTML, like Gecko) Version/5.1 Safari/534.54" }, signal: AbortSignal.timeout(4000) },
    ).then((r) => r.text());
    const url = /src: url\((https:\/\/[^)]+)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url || !url.startsWith("https://fonts.gstatic.com/")) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Covers are fetched server-side, so the URL must be on a well-known image host and every redirect
 * hop (Open Library bounces through archive.org) is checked too: no SSRF.
 */
async function loadCover(url: string | null): Promise<string | null> {
  if (!url || !isAllowedImageUrl(url)) return null;
  try {
    const finalUrl = await followAllowedRedirects(url, isAllowedImageRedirectHost);
    if (!finalUrl) return null;
    const res = await fetch(finalUrl, { signal: AbortSignal.timeout(4000), redirect: "error" });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    // Satori reads PNG, JPEG and GIF, not WebP
    if (!res.ok || !["image/png", "image/jpeg", "image/gif"].includes(type)) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > 2_000_000) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

// Same set as the page itself: share images of existing public pages are prerendered.
export async function generateStaticParams() {
  let slugs: string[] = [];
  try {
    slugs = (await listPublicPages()).slice(0, 50).map((p) => p.slug);
  } catch {
    // no database at build time: render on demand
  }
  return (slugs.length > 0 ? slugs : ["placeholder0"]).map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = SLUG_PATTERN.test(slug) ? await getPublicPage(slug) : null;
  const snapshot = page ? parseSnapshot(page.snapshot) : null;

  const title = snapshot?.work.title ?? "zan";
  const original = snapshot?.work.title_original ?? "";
  const kind = snapshot ? WORK_KIND_LABEL[snapshot.work.kind] : "";
  const stats = snapshot ? `${snapshot.notes.length} 条笔记 · ${snapshot.sources.length} 个资源` : "作品研究罐子";
  const shownTitle = Array.from(title).slice(0, 48).join("");
  const shownOriginal = Array.from(original).slice(0, 60).join("");

  const [font, cover] = await Promise.all([
    loadFont(`${shownTitle}${shownOriginal}${kind}${stats}zan · 作品研究罐子0123456789`),
    loadCover(snapshot?.work.cover_url ?? null),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#faf8f4",
          color: "#1f1d18",
          padding: 64,
          fontFamily: font ? "Noto Sans SC" : "sans-serif",
        }}
      >
        {cover ? (
          <img src={cover} alt="" width={300} height={450} style={{ borderRadius: 16, objectFit: "cover", marginRight: 56, alignSelf: "center" }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {kind ? (
              <div style={{ display: "flex", color: "#2b6657", fontSize: 30, fontWeight: 700 }}>{kind}</div>
            ) : null}
            <div style={{ display: "flex", fontSize: shownTitle.length > 20 ? 56 : 76, fontWeight: 700, lineHeight: 1.15, marginTop: 12 }}>
              {shownTitle}
            </div>
            {shownOriginal ? (
              <div style={{ display: "flex", fontSize: 32, color: "#6b655a", marginTop: 16 }}>{shownOriginal}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30, color: "#6b655a" }}>
            <div style={{ display: "flex" }}>{stats}</div>
            <div style={{ display: "flex", color: "#2b6657", fontWeight: 700 }}>zan · 作品研究罐子</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Noto Sans SC", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
