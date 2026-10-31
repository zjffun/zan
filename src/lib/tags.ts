import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { FEED_PAGE_SIZE } from "./feed";
import { SLUG_PATTERN } from "./slug";
import type { PickerTag } from "./tag-rank";
import { createAnonClient } from "./supabase/anon";
import { createClient } from "./supabase/server";
import { TAG_KINDS, type Profile, type TagInfo, type TagKind, type TagListItem } from "./types";

const asKind = (value: unknown): TagKind | null =>
  (TAG_KINDS as readonly string[]).includes(String(value)) ? (value as TagKind) : null;

interface RawTag {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  description: string;
  cover_url: string | null;
  post_count: number;
  follower_count: number;
}

export interface TagQuery {
  q?: string;
  kind?: TagKind | null;
  sort?: "hot" | "new";
  page?: number;
}

export interface TagPage {
  items: TagListItem[];
  hasMore: boolean;
}

/** The tag directory, with counts that only include public posts. Public data: the anon client is enough. */
export async function listTags({ q = "", kind = null, sort = "hot", page = 1 }: TagQuery, pageSize = FEED_PAGE_SIZE): Promise<TagPage> {
  const supabase = createAnonClient();
  if (!supabase) return { items: [], hasMore: false };
  const { data, error } = await supabase.rpc("list_tags", {
    p_q: q || null,
    p_kind: kind,
    p_sort: sort,
    p_limit: pageSize + 1,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`could not load tags: ${error.message}`);
  const rows = (data ?? []) as RawTag[];
  return {
    items: rows.slice(0, pageSize).map((row) => ({ ...row, kind: asKind(row.kind) })),
    hasMore: rows.length > pageSize,
  };
}

/**
 * The tags that a person's latest posts used, most recent first: what the tag picker offers first. Read
 * as that person (private posts of their own count), from their latest 50 posts, which is plenty to find a
 * handful of different tags.
 */
export async function getMyRecentTags(userId: string, limit = 12): Promise<PickerTag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("post_tags(tag:tags(id, slug, name, kind))")
    .eq("author", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`could not load recent tags: ${error.message}`);
  const seen = new Set<string>();
  const out: PickerTag[] = [];
  for (const post of (data ?? []) as unknown as { post_tags: { tag: { id: string; slug: string; name: string; kind: string | null } | null }[] | null }[]) {
    for (const { tag } of post.post_tags ?? []) {
      if (!tag || seen.has(tag.id)) continue;
      seen.add(tag.id);
      out.push({ id: tag.id, slug: tag.slug, name: tag.name, kind: asKind(tag.kind), post_count: null, mine: true });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** The busiest tags, for the strip on the home page. Cached; any post change refreshes it. */
export async function getHotTags(limit = 12): Promise<TagListItem[]> {
  "use cache";
  cacheTag("feed");
  cacheLife("minutes");
  const { items } = await listTags({ sort: "hot" }, limit);
  return items.filter((tag) => tag.post_count > 0);
}

export async function getTag(slug: string): Promise<TagInfo | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_tag", { p_slug: slug });
  if (error) throw new Error(`could not load tag: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? ({ ...row, kind: asKind(row.kind), external: row.external ?? {} } as TagInfo) : null;
}

/** Ids of the tags the signed-in user follows. */
export async function getFollowedTagIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tag_follows").select("tag_id").eq("user_id", userId);
  if (error) throw new Error(`could not load follows: ${error.message}`);
  return (data ?? []).map((row) => row.tag_id as string);
}

export async function isFollowing(userId: string, tagId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("tag_follows").select("tag_id").eq("user_id", userId).eq("tag_id", tagId).maybeSingle();
  return Boolean(data);
}

/** A profile is public. */
export async function getProfile(id: string): Promise<Profile | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("id, nickname, bio, created_at").eq("id", id).maybeSingle();
  if (error) throw new Error(`could not load profile: ${error.message}`);
  return (data as Profile | null) ?? null;
}
