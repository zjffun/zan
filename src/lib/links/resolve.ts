import "server-only";
import { isAllowedImageUrl, REDIRECT_ALLOWED_HOSTS } from "./hosts";
import { parseLink, type ParsedLink } from "./parse";
import { parseSourceInput, type SourceInput } from "../sources";
import { BROWSER_USER_AGENT, fetchJson, followAllowedRedirects } from "../server/http";
import { SharedCache } from "../server/cache";
import type { SourceMeta } from "../types";

export interface ResolvedLink {
  /** Ready to insert once the user has confirmed (they may still edit the title). */
  source: SourceInput;
  /** Start time found in the URL (`?t=`), if any. */
  t?: number;
  /** Things the user should know, shown next to the preview. */
  warnings: string[];
  /** Metadata could not be fetched: the UI must ask for a title. */
  needsTitle: boolean;
}

export type ResolveResult = { ok: true; value: ResolvedLink } | { ok: false; error: string };

const fail = (error: string): ResolveResult => ({ ok: false, error });

const clip = (text: string, max = 300) => Array.from(text.trim()).slice(0, max).join("");

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

type YouTubeLookup =
  | { state: "ok"; meta: SourceMeta; embeddable: boolean }
  | { state: "gone" }
  | { state: "blocked" }
  | { state: "unknown" };

interface YouTubeVideoItem {
  contentDetails?: { duration?: unknown };
  status?: { embeddable?: unknown };
}

interface BilibiliView {
  code?: number;
  data?: {
    title?: unknown;
    pic?: unknown;
    duration?: unknown;
    owner?: { name?: unknown };
    pages?: Record<string, unknown>[];
  };
}

const ISO_DURATION = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

export function parseIsoDuration(value: string): number | undefined {
  const m = ISO_DURATION.exec(value);
  if (!m) return undefined;
  const total = Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
  return total > 0 && total <= 48 * 3600 ? total : undefined;
}

async function lookupYouTube(videoId: string): Promise<YouTubeLookup> {
  try {
    // oEmbed: title, author, thumbnail. No API key needed.
    const watch = `https://www.youtube.com/watch?v=${videoId}`;
    const oembed = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`);
    if (oembed.status === 400 || oembed.status === 404) return { state: "gone" };
    if (oembed.status === 401 || oembed.status === 403) return { state: "blocked" };
    if (oembed.status !== 200 || typeof oembed.json !== "object" || oembed.json === null) {
      return { state: "unknown" };
    }
    const body = oembed.json as Record<string, unknown>;
    const meta: SourceMeta = {};
    if (typeof body.title === "string" && body.title.trim()) meta.title = clip(body.title);
    if (typeof body.author_name === "string" && body.author_name.trim()) meta.author = clip(body.author_name, 200);
    if (typeof body.thumbnail_url === "string" && isAllowedImageUrl(body.thumbnail_url)) {
      meta.thumbnail = body.thumbnail_url;
    }

    // Duration (and the embeddable flag) need the Data API: optional, quota-limited.
    let embeddable = true;
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
      const api = await fetchJson(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${videoId}&key=${encodeURIComponent(key)}`,
      ).catch(() => null);
      const item = (api?.json as { items?: YouTubeVideoItem[] } | null)?.items?.[0];
      if (item) {
        const duration = typeof item.contentDetails?.duration === "string" ? parseIsoDuration(item.contentDetails.duration) : undefined;
        if (duration) meta.duration = duration;
        if (item.status?.embeddable === false) embeddable = false;
      }
    }
    return { state: "ok", meta, embeddable };
  } catch {
    return { state: "unknown" };
  }
}

const youtubeCache = new SharedCache<YouTubeLookup>("youtube", 60 * 60_000);

async function resolveYouTube(link: Extract<ParsedLink, { provider: "youtube" }>): Promise<ResolveResult> {
  const lookup = await youtubeCache.memo(link.videoId, () => lookupYouTube(link.videoId), (l) => l.state !== "unknown");
  const t = link.t;
  const watchUrl = `https://www.youtube.com/watch?v=${link.videoId}`;

  switch (lookup.state) {
    case "gone":
      return fail("找不到这个 YouTube 视频：可能已删除，或链接有误。");
    case "blocked":
      return {
        ok: true,
        value: {
          source: parseSourceInput({ provider: "link", ref: { url: watchUrl }, meta: null }),
          t,
          warnings: ["这个视频是私享视频或上传者关闭了外嵌，已作为外链添加：不能在页面内播放，但时间点仍会链接回原站。"],
          needsTitle: true,
        },
      };
    case "unknown":
      return {
        ok: true,
        value: {
          source: parseSourceInput({ provider: "youtube", ref: { videoId: link.videoId }, meta: null }),
          t,
          warnings: ["暂时拿不到视频信息（YouTube 没有响应），请手动填写标题。"],
          needsTitle: true,
        },
      };
    case "ok":
      if (!lookup.embeddable) {
        return {
          ok: true,
          value: {
            source: parseSourceInput({ provider: "link", ref: { url: watchUrl }, meta: lookup.meta }),
            t,
            warnings: ["上传者关闭了外嵌，已作为外链添加：不能在页面内播放，但时间点仍会链接回原站。"],
            needsTitle: !lookup.meta.title,
          },
        };
      }
      return {
        ok: true,
        value: {
          source: parseSourceInput({ provider: "youtube", ref: { videoId: link.videoId }, meta: lookup.meta }),
          t,
          warnings: [],
          needsTitle: !lookup.meta.title,
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Bilibili
// ---------------------------------------------------------------------------

interface BilibiliPage {
  page: number;
  part?: string;
  duration?: number;
}

type BilibiliLookup =
  | { state: "ok"; title: string; author?: string; thumbnail?: string; duration?: number; pages: BilibiliPage[] }
  | { state: "gone" }
  | { state: "hidden" }
  | { state: "unknown" };

/** Bilibili hands out `http://` and `//` image URLs; we only keep https from their CDN. */
export function normalizeBilibiliImage(pic: unknown): string | undefined {
  if (typeof pic !== "string") return undefined;
  const url = pic.startsWith("//") ? `https:${pic}` : pic.replace(/^http:\/\//, "https://");
  return isAllowedImageUrl(url) ? url : undefined;
}

async function lookupBilibili(bvid: string): Promise<BilibiliLookup> {
  try {
    // Unofficial endpoint. It checks UA/Referer, and answers 412 or code -352
    // when it suspects a bot: that is "unknown", not "gone".
    const res = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: { "User-Agent": BROWSER_USER_AGENT, Referer: "https://www.bilibili.com/" },
    });
    const body = res.json as BilibiliView | null;
    if (res.status !== 200 || !body || typeof body.code !== "number") return { state: "unknown" };
    if (body.code === -404) return { state: "gone" };
    if ([62002, 62004, 62012].includes(body.code)) return { state: "hidden" };
    if (body.code !== 0 || !body.data || typeof body.data.title !== "string") return { state: "unknown" };

    const pages: BilibiliPage[] = Array.isArray(body.data.pages)
      ? body.data.pages.map((p: Record<string, unknown>, i: number) => ({
          page: typeof p.page === "number" ? p.page : i + 1,
          part: typeof p.part === "string" ? p.part : undefined,
          duration: typeof p.duration === "number" ? p.duration : undefined,
        }))
      : [];
    return {
      state: "ok",
      title: clip(body.data.title),
      author: typeof body.data.owner?.name === "string" ? clip(body.data.owner.name, 200) : undefined,
      thumbnail: normalizeBilibiliImage(body.data.pic),
      duration: typeof body.data.duration === "number" ? body.data.duration : undefined,
      pages,
    };
  } catch {
    return { state: "unknown" };
  }
}

const bilibiliCache = new SharedCache<BilibiliLookup>("bilibili", 60 * 60_000);

async function resolveBilibili(link: Extract<ParsedLink, { provider: "bilibili" }>): Promise<ResolveResult> {
  const lookup = await bilibiliCache.memo(link.bvid, () => lookupBilibili(link.bvid), (l) => l.state !== "unknown");
  const ref = { bvid: link.bvid, p: link.p };

  switch (lookup.state) {
    case "gone":
      return fail("找不到这个 B 站视频：可能已删除，或 BV 号有误。");
    case "hidden":
      return fail("这个 B 站视频不可见（审核中、仅 UP 主可见或已被下架）。");
    case "unknown":
      return {
        ok: true,
        value: {
          source: parseSourceInput({ provider: "bilibili", ref, meta: null }),
          t: link.t,
          warnings: ["暂时拿不到视频信息（B 站接口限流或拒绝了请求），请手动填写标题。"],
          needsTitle: true,
        },
      };
    case "ok": {
      if (lookup.pages.length > 0 && link.p > lookup.pages.length) {
        return fail(`这个视频只有 ${lookup.pages.length} 个分 P，没有 P${link.p}。`);
      }
      const page = lookup.pages[link.p - 1];
      const meta: SourceMeta = { title: lookup.title };
      if (lookup.author) meta.author = lookup.author;
      if (lookup.thumbnail) meta.thumbnail = lookup.thumbnail;
      const duration = page?.duration ?? lookup.duration;
      if (duration && duration > 0) meta.duration = Math.floor(duration);
      if (lookup.pages.length > 1 && page?.part) meta.part = clip(page.part, 200);
      return {
        ok: true,
        value: { source: parseSourceInput({ provider: "bilibili", ref, meta }), t: link.t, warnings: [], needsTitle: false },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/**
 * Turns whatever the user pasted into a source ready to be added: recognises
 * the site, follows b23.tv short links (host-allowlisted at every hop), and
 * fetches a metadata snapshot. Network trouble never blocks adding a source;
 * it only means the user has to type the title.
 */
export async function resolveLink(input: string): Promise<ResolveResult> {
  let link = parseLink(input);
  if (!link) return fail("无法识别这个链接。请粘贴 YouTube、B 站或其他网页的地址。");

  if (link.provider === "bilibili-short") {
    let finalUrl: string | null = null;
    try {
      finalUrl = await followAllowedRedirects(link.url, REDIRECT_ALLOWED_HOSTS);
    } catch {
      return fail("暂时无法展开这个 b23.tv 短链，请直接粘贴完整的 B 站视频地址。");
    }
    if (!finalUrl) return fail("这个短链指向的不是 B 站视频，已拒绝。");
    link = parseLink(finalUrl);
    if (link?.provider !== "bilibili") return fail("这个短链指向的不是 B 站视频。");
  }

  switch (link.provider) {
    case "youtube":
      return resolveYouTube(link);
    case "bilibili":
      return resolveBilibili(link);
    case "link": {
      const host = new URL(link.url).hostname;
      return {
        ok: true,
        value: {
          source: parseSourceInput({ provider: "link", ref: { url: link.url }, meta: { title: host } }),
          warnings: [],
          needsTitle: false,
        },
      };
    }
    default:
      return fail("无法识别这个链接。");
  }
}
