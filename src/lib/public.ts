import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { FEED_PAGE_SIZE, feedExcerpt, type FeedQuery } from "./feed";
import { createAnonClient } from "./supabase/anon";
import { WORK_KINDS, type WorkKind } from "./types";

export interface PublicPage {
  slug: string;
  visibility: "unlisted" | "public";
  version: number;
  published_at: string;
  /** Raw jsonb; always run through parseSnapshot before use. */
  snapshot: unknown;
}

export const SLUG_PATTERN = /^[a-z0-9]{8,32}$/;

/**
 * A published page, by slug. Cached until the owner republishes or unpublishes
 * (publish/unpublish actions call updateTag with the same tag), so public
 * traffic never touches the database. Uses the cookie-less anon client: public
 * pages must not depend on who is looking.
 */
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  "use cache";
  cacheTag(`pub:${slug}`);
  cacheLife("days");

  if (!SLUG_PATTERN.test(slug)) return null;
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_publication", { p_slug: slug });
  if (error) throw new Error(`could not load publication: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as PublicPage) : null;
}

export interface PublicListing {
  slug: string;
  title: string;
  published_at: string;
}

export interface FeedItem {
  slug: string;
  kind: WorkKind;
  title: string;
  title_original: string | null;
  cover_url: string | null;
  note_count: number;
  source_count: number;
  /** teaser text of the first published note; empty when there is none */
  excerpt: string;
  version: number;
  published_at: string;
}

export interface FeedPage {
  items: FeedItem[];
  hasMore: boolean;
}

interface FeedRow extends Omit<FeedItem, "kind" | "excerpt"> {
  kind: string;
  first_note: unknown;
}

/**
 * One page of the home feed: public pages, newest first, optionally for one
 * kind of work. Cached like the pages themselves and expired by the same tag,
 * so publishing or taking a page down shows up on the home page at once.
 */
export async function listPublicFeed({ kind, page }: FeedQuery): Promise<FeedPage> {
  "use cache";
  cacheTag("pub:index");
  cacheLife("hours");

  const supabase = createAnonClient();
  if (!supabase) return { items: [], hasMore: false };
  // one row more than a page, to know whether there is a next one
  const { data, error } = await supabase.rpc("list_public_feed", {
    p_kind: kind,
    p_limit: FEED_PAGE_SIZE + 1,
    p_offset: (page - 1) * FEED_PAGE_SIZE,
  });
  if (error) throw new Error(`could not load the feed: ${error.message}`);

  const rows = (data ?? []) as FeedRow[];
  const items = rows.slice(0, FEED_PAGE_SIZE).map(({ first_note, kind: rawKind, ...row }) => ({
    ...row,
    kind: (WORK_KINDS as readonly string[]).includes(rawKind) ? (rawKind as WorkKind) : "other",
    excerpt: feedExcerpt(first_note),
  }));
  return { items, hasMore: rows.length > FEED_PAGE_SIZE };
}

/** Public (not unlisted) pages, for the sitemap and static params. */
export async function listPublicPages(): Promise<PublicListing[]> {
  "use cache";
  cacheTag("pub:index");
  cacheLife("hours");

  const supabase = createAnonClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_public_publications");
  if (error) throw new Error(`could not list publications: ${error.message}`);
  return (data ?? []) as PublicListing[];
}
