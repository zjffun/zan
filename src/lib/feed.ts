export const FEED_PAGE_SIZE = 20;
/** Highest page number any list will serve: keeps `offset` sane for crafted URLs. */
export const FEED_MAX_PAGE = 500;

const EXCERPT_LENGTH = 140;

export type RawParam = string | string[] | undefined;
const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value);

/** `?page=2` -> a page number that is always valid, whatever was typed into the URL. */
export function parsePage(value: RawParam): number {
  const page = Number(first(value));
  return Number.isInteger(page) && page >= 1 ? Math.min(page, FEED_MAX_PAGE) : 1;
}

export type FeedTab = "latest" | "following";

export function parseFeedTab(value: RawParam): FeedTab {
  return first(value) === "following" ? "following" : "latest";
}

/**
 * A link to a list page. Defaults are left out, so "latest, page 1" is just the
 * path itself, and every list builds its links the same way.
 */
export function buildHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    if (key === "tab" && value === "latest") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * What a card shows of a post: its first lines, one per line (the text of a post is one block per
 * line already), at most `max` characters, cut on a character boundary. The card clamps how many lines show.
 */
export function teaserOf(plainText: string | null | undefined, max = EXCERPT_LENGTH): string {
  const text = (plainText ?? "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join("").trimEnd()}…` : text;
}

/** A one-line teaser: the first lines of a post, flattened and cut on a character boundary. */
export function excerptOf(plainText: string | null | undefined, max = EXCERPT_LENGTH): string {
  const text = (plainText ?? "").replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : text;
}
