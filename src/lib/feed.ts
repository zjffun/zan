import { docToPlainText } from "./doc/text";
import { sanitizeDocOrEmpty } from "./doc/schema";
import { WORK_KINDS, type WorkKind } from "./types";

export const FEED_PAGE_SIZE = 20;
/** Highest page number the feed will serve: keeps `offset` sane for crafted URLs. */
export const FEED_MAX_PAGE = 500;

const EXCERPT_LENGTH = 140;

export interface FeedQuery {
  kind: WorkKind | null;
  page: number;
}

type RawParam = string | string[] | undefined;
const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value);

/** `?kind=book&page=2` -> a query that is always valid, whatever was typed into the URL. */
export function parseFeedQuery(params: { kind?: RawParam; page?: RawParam }): FeedQuery {
  const kind = first(params.kind);
  const page = Number(first(params.page));
  return {
    kind: (WORK_KINDS as readonly string[]).includes(kind ?? "") ? (kind as WorkKind) : null,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, FEED_MAX_PAGE) : 1,
  };
}

/** The link to a feed page: defaults are left out so "all, page 1" is just "/". */
export function feedHref({ kind, page }: FeedQuery): string {
  const search = new URLSearchParams();
  if (kind) search.set("kind", kind);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

/** A card's teaser: the first lines of a published note, flattened and cut on a character boundary. */
export function feedExcerpt(body: unknown): string {
  if (body === null || body === undefined) return "";
  const text = docToPlainText(sanitizeDocOrEmpty(body)).replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  return chars.length > EXCERPT_LENGTH ? `${chars.slice(0, EXCERPT_LENGTH).join("")}…` : text;
}
