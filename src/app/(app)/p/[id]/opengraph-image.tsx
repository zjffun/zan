import { ImageResponse } from "next/og";
import { isUuid } from "@/lib/dal";
import { excerptOf } from "@/lib/feed";
import { isAllowedImageRedirectHost, isAllowedImageUrl } from "@/lib/links/hosts";
import { getPublicPost } from "@/lib/posts";
import { followAllowedRedirects } from "@/lib/server/http";
import { sourceTitle } from "@/lib/sources";

export const alt = "zan 上的一条内容";
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
 * Thumbnails are fetched server-side, so the URL must be on a well-known image host and every redirect
 * hop is checked too: no SSRF.
 */
async function loadImage(url: string | null | undefined): Promise<string | null> {
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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = isUuid(id) ? await getPublicPost(id) : null;

  const headline = post ? (post.source ? sourceTitle(post.source) : "") : "";
  const text = post ? excerptOf(post.plain_text, 110) : "";
  const tags = (post?.tags ?? []).slice(0, 4).map((tag) => `#${tag.name}`);
  const author = post?.author.nickname ?? "";
  const headlineChars = Array.from(headline);
  const shownHeadline = headlineChars.length > 40 ? `${headlineChars.slice(0, 39).join("")}…` : headline;

  const [font, picture] = await Promise.all([
    loadFont(`${shownHeadline}${text}${tags.join("")}${author}zan0123456789`),
    loadImage(post?.source?.meta?.thumbnail),
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
        {picture ? (
          <img src={picture} alt="" width={400} height={225} style={{ borderRadius: 16, objectFit: "cover", marginRight: 48, alignSelf: "center" }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {shownHeadline ? (
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, lineHeight: 1.2 }}>{shownHeadline}</div>
            ) : null}
            {text ? (
              <div style={{ display: "flex", fontSize: shownHeadline ? 32 : 52, fontWeight: 700, lineHeight: 1.3, color: shownHeadline ? "#6b655a" : "#1f1d18", marginTop: shownHeadline ? 20 : 0 }}>
                {text}
              </div>
            ) : null}
            {tags.length > 0 ? (
              <div style={{ display: "flex", fontSize: 30, color: "#2b6657", fontWeight: 700, marginTop: 28 }}>{tags.join("  ")}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30, color: "#6b655a" }}>
            <div style={{ display: "flex" }}>{author}</div>
            <div style={{ display: "flex", color: "#2b6657", fontWeight: 700 }}>zan</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Noto Sans SC", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
