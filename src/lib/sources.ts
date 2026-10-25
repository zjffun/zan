import type { Anchor } from "./anchor";
import type { SourceLike, SourceProvider } from "./types";

// ---------------------------------------------------------------------------
// links back to the original site
// ---------------------------------------------------------------------------

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

/**
 * Where to watch/read this source on the original site, optionally at `t`
 * seconds. Always shown under the player: it is the fallback for visitors who
 * cannot load the embed (e.g. YouTube in mainland China).
 */
export function sourceUrl(source: SourceLike, t?: number): string | null {
  const ref = source.ref;
  const at = t !== undefined && t > 0 ? Math.floor(t) : undefined;
  switch (source.provider) {
    case "youtube": {
      const id = str(ref.videoId);
      if (!id) return null;
      return `https://youtu.be/${id}${at !== undefined ? `?t=${at}` : ""}`;
    }
    case "bilibili": {
      const bvid = str(ref.bvid);
      if (!bvid) return null;
      const p = num(ref.p) ?? 1;
      const params = new URLSearchParams();
      if (p > 1) params.set("p", String(p));
      if (at !== undefined) params.set("t", String(at));
      const query = params.toString();
      return `https://www.bilibili.com/video/${bvid}${query ? `?${query}` : ""}`;
    }
    case "episode":
    case "book":
    case "link":
      return str(ref.url) ?? null;
  }
}

/**
 * Link to a video at the anchor's time. Only video providers have addressable
 * times; pages, chapters and episodes of other providers get no link.
 */
export function anchorUrl(source: SourceLike | null | undefined, anchor: Pick<Anchor, "t"> | null): string | null {
  if (!source || anchor?.t === undefined) return null;
  if (source.provider !== "youtube" && source.provider !== "bilibili") return null;
  return sourceUrl(source, anchor.t);
}

/**
 * Whether the post page has a player that a time label can make jump: only the two video providers
 * embed one, and a video that is gone has none.
 */
export function canSeek(source: SourceLike | null | undefined, status: "ok" | "dead" = "ok"): boolean {
  return status === "ok" && (source?.provider === "youtube" || source?.provider === "bilibili");
}

/** Display name of a source: the title we saved, else something readable from the ref. */
export function sourceTitle(source: SourceLike): string {
  if (source.meta?.title) {
    return source.meta.part && source.provider === "bilibili"
      ? `${source.meta.title} · ${source.meta.part}`
      : source.meta.title;
  }
  const ref = source.ref;
  switch (source.provider) {
    case "youtube":
      return `YouTube ${str(ref.videoId) ?? ""}`.trim();
    case "bilibili":
      return `Bilibili ${str(ref.bvid) ?? ""}${(num(ref.p) ?? 1) > 1 ? ` P${num(ref.p)}` : ""}`.trim();
    case "episode":
      return `第 ${num(ref.ep) ?? "?"} 集`;
    case "book":
      return str(ref.edition) ?? "书";
    case "link":
      try {
        return new URL(str(ref.url) ?? "").hostname;
      } catch {
        return "链接";
      }
  }
}

export const PROVIDER_LABEL: Record<SourceProvider, string> = {
  youtube: "YouTube",
  bilibili: "哔哩哔哩",
  episode: "剧集",
  book: "书",
  link: "链接",
};
