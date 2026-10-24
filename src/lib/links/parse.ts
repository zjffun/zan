import { parseTimeParam } from "../time";
import { BILIBILI_HOSTS, BILIBILI_SHORT_HOSTS, YOUTUBE_HOSTS } from "./hosts";

export type ParsedLink =
  | { provider: "youtube"; videoId: string; t?: number }
  | { provider: "bilibili"; bvid: string; p: number; t?: number }
  /** b23.tv: the server has to follow the redirect to learn the BV id */
  | { provider: "bilibili-short"; url: string }
  /** any other http(s) page: stored as an external link */
  | { provider: "link"; url: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const BVID = /^BV[0-9A-Za-z]{10}$/;

/** "youtu.be/abc" -> a URL; returns null for things that are not http(s). */
function toUrl(input: string): URL | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeTime(url: URL): number | undefined {
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const raw = url.searchParams.get("t") ?? url.searchParams.get("start") ?? hash.get("t");
  return parseTimeParam(raw) ?? undefined;
}

function parseYouTube(url: URL): ParsedLink | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return YOUTUBE_ID.test(id) ? withTime({ provider: "youtube", videoId: id }, youtubeTime(url)) : null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (segments[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "embed", "live", "v"].includes(segments[0] ?? "")) id = segments[1];
  return id && YOUTUBE_ID.test(id)
    ? withTime({ provider: "youtube", videoId: id }, youtubeTime(url))
    : null;
}

function parseBilibili(url: URL): ParsedLink | null {
  const bvidFromPath = /\/video\/(BV[0-9A-Za-z]{10})(?:[/?#]|$)/.exec(url.pathname + "/")?.[1];
  const bvid = bvidFromPath ?? url.searchParams.get("bvid") ?? undefined;
  if (!bvid || !BVID.test(bvid)) return null;
  const pRaw = Number(url.searchParams.get("p") ?? 1);
  const p = Number.isInteger(pRaw) && pRaw >= 1 && pRaw <= 9999 ? pRaw : 1;
  return withTime({ provider: "bilibili", bvid, p }, parseTimeParam(url.searchParams.get("t")) ?? undefined);
}

function withTime<T extends ParsedLink>(link: T, t: number | undefined): T {
  return t !== undefined && t > 0 ? { ...link, t } : link;
}

/**
 * Pure URL classification (no network). YouTube and Bilibili links are
 * recognised in all their common shapes; b23.tv needs a server-side redirect;
 * any other http(s) URL becomes a plain external link. Returns null for
 * anything that is not a usable URL.
 */
export function parseLink(input: string): ParsedLink | null {
  const text = input.trim();
  if (BVID.test(text)) return { provider: "bilibili", bvid: text, p: 1 };

  const url = toUrl(text);
  if (!url) return null;
  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) return parseYouTube(url);
  if (BILIBILI_HOSTS.has(host)) return parseBilibili(url);
  if (BILIBILI_SHORT_HOSTS.has(host)) return { provider: "bilibili-short", url: url.toString() };

  // a YouTube/Bilibili look-alike (www.youtube.com.evil.example) lands here as a plain link
  return { provider: "link", url: url.toString() };
}
