import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "./supabase/anon";

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
