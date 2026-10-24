import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { anchorSchema } from "./anchor";
import { excerptOf, FEED_PAGE_SIZE } from "./feed";
import { createAnonClient } from "./supabase/anon";
import { createClient } from "./supabase/server";
import { TAG_KINDS, type AuthorRef, type CommentData, type PostCardData, type PostDetailData, type PostSource, type TagKind, type TagRef, type Visibility } from "./types";

/**
 * Reads of posts. The feed and the public copy of a post (for share previews)
 * go through the cookie-less anon client so they can be cached; everything that
 * depends on who is looking (private posts, likes, comments) uses the session
 * client and therefore runs under row level security.
 */

const CARD_SELECT =
  "id, plain_text, source, source_status, anchor, visibility, like_count, comment_count, created_at, " +
  "author:profiles(id, nickname), post_tags(tag:tags(id, slug, name, kind))";

const DETAIL_SELECT = `${CARD_SELECT}, body, updated_at`;

interface RawTag {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
}

interface RawPost {
  id: string;
  plain_text: string;
  body?: unknown;
  source: PostSource | null;
  source_status: "ok" | "dead";
  anchor: unknown;
  visibility: Visibility;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at?: string;
  author: AuthorRef | null;
  post_tags: { tag: RawTag | null }[] | null;
}

const GONE_AUTHOR: AuthorRef = { id: "", nickname: "已注销" };

function toTags(row: RawPost): TagRef[] {
  return (row.post_tags ?? []).flatMap(({ tag }) =>
    tag
      ? [
          {
            id: tag.id,
            slug: tag.slug,
            name: tag.name,
            kind: (TAG_KINDS as readonly string[]).includes(tag.kind ?? "") ? (tag.kind as TagKind) : null,
          },
        ]
      : [],
  );
}

function toCard(row: RawPost): PostCardData {
  const anchor = anchorSchema.safeParse(row.anchor);
  return {
    id: row.id,
    author: row.author ?? GONE_AUTHOR,
    excerpt: excerptOf(row.plain_text),
    source: row.source,
    source_status: row.source_status,
    anchor: anchor.success ? anchor.data : null,
    visibility: row.visibility,
    like_count: row.like_count,
    comment_count: row.comment_count,
    created_at: row.created_at,
    tags: toTags(row),
  };
}

function toDetail(row: RawPost): PostDetailData {
  const { excerpt: _excerpt, ...card } = toCard(row);
  void _excerpt;
  return { ...card, body: row.body, plain_text: row.plain_text, updated_at: row.updated_at ?? row.created_at };
}

export interface PostPage {
  items: PostCardData[];
  hasMore: boolean;
}

const EMPTY_PAGE: PostPage = { items: [], hasMore: false };

type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** One page of cards, newest first; asks for one row more than a page to know whether there is a next one. */
async function cardPage(page: number, run: (range: { from: number; to: number }) => Result): Promise<PostPage> {
  const from = (page - 1) * FEED_PAGE_SIZE;
  const { data, error } = await run({ from, to: from + FEED_PAGE_SIZE });
  if (error) throw new Error(`could not load posts: ${error.message}`);
  const rows = (data ?? []) as RawPost[];
  return { items: rows.slice(0, FEED_PAGE_SIZE).map(toCard), hasMore: rows.length > FEED_PAGE_SIZE };
}

/**
 * The public feed, optionally for one tag. Cached until a post is created,
 * edited or deleted (the actions call updateTag("feed")); like and comment
 * counts on the cards may lag by a minute or so.
 */
export async function getPublicFeed({ tagId, page }: { tagId: string | null; page: number }): Promise<PostPage> {
  "use cache";
  cacheTag("feed");
  cacheLife("minutes");

  const supabase = createAnonClient();
  if (!supabase) return EMPTY_PAGE;
  return cardPage(page, ({ from, to }) => {
    const query = supabase
      .from("posts")
      .select(tagId ? `${CARD_SELECT}, tagged:post_tags!inner(tag_id)` : CARD_SELECT)
      .eq("visibility", "public");
    return (tagId ? query.eq("tagged.tag_id", tagId) : query).order("created_at", { ascending: false }).range(from, to);
  });
}

/** Posts under any of the tags the viewer follows. Per viewer, so not cached. */
export async function getFollowingFeed(tagIds: string[], page: number): Promise<PostPage> {
  if (tagIds.length === 0) return EMPTY_PAGE;
  const supabase = await createClient();
  return cardPage(page, ({ from, to }) =>
    supabase
      .from("posts")
      .select(`${CARD_SELECT}, tagged:post_tags!inner(tag_id)`)
      .eq("visibility", "public")
      .in("tagged.tag_id", tagIds)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
}

/** One author's posts. Their private ones are only returned to the author (row level security). */
export async function getAuthorPosts(authorId: string, page: number, includePrivate: boolean): Promise<PostPage> {
  const supabase = await createClient();
  return cardPage(page, ({ from, to }) => {
    const query = supabase.from("posts").select(CARD_SELECT).eq("author", authorId);
    return (includePrivate ? query : query.eq("visibility", "public")).order("created_at", { ascending: false }).range(from, to);
  });
}

/** The viewer's favorites, most recently favorited first. Posts that are gone or no longer visible drop out. */
export async function getFavoritePosts(userId: string, page: number): Promise<PostPage> {
  const supabase = await createClient();
  const from = (page - 1) * FEED_PAGE_SIZE;
  const { data, error } = await supabase
    .from("favorites")
    .select(`created_at, post:posts(${CARD_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + FEED_PAGE_SIZE);
  if (error) throw new Error(`could not load favorites: ${error.message}`);
  const rows = (data ?? []) as unknown as { post: RawPost | null }[];
  return {
    items: rows.slice(0, FEED_PAGE_SIZE).flatMap((row) => (row.post ? [toCard(row.post)] : [])),
    hasMore: rows.length > FEED_PAGE_SIZE,
  };
}

/** Posts matching a search: public ones, plus the viewer's own private ones (row level security decides). */
export async function searchPosts(q: string, page: number): Promise<PostPage> {
  const supabase = await createClient();
  return cardPage(page, ({ from, to }) => supabase.rpc("search_posts", { q, lim: to - from + 1, off: from }).select(CARD_SELECT));
}

/** A post as the signed-in (or anonymous) viewer may see it; null if it does not exist or is not theirs to see. */
export async function getPost(id: string): Promise<PostDetailData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`could not load post: ${error.message}`);
  return data ? toDetail(data as unknown as RawPost) : null;
}

/** The public copy of a post, for share previews (metadata, OG image). Cached until the post changes. */
export async function getPublicPost(id: string): Promise<PostDetailData | null> {
  "use cache";
  cacheTag(`post:${id}`);
  cacheLife("hours");

  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("posts").select(DETAIL_SELECT).eq("id", id).eq("visibility", "public").maybeSingle();
  if (error) throw new Error(`could not load post: ${error.message}`);
  return data ? toDetail(data as unknown as RawPost) : null;
}

export async function getComments(postId: string): Promise<CommentData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, parent_id, body, created_at, author:profiles(id, nickname)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`could not load comments: ${error.message}`);
  return ((data ?? []) as unknown as (Omit<CommentData, "author"> & { author: AuthorRef | null })[]).map((row) => ({
    ...row,
    author: row.author ?? GONE_AUTHOR,
  }));
}

export interface ViewerState {
  liked: string[];
  favorited: string[];
}

/** Which of these posts the viewer has liked / favorited. */
export async function getViewerState(postIds: string[], userId: string | null): Promise<ViewerState> {
  if (!userId || postIds.length === 0) return { liked: [], favorited: [] };
  const supabase = await createClient();
  const [likes, favorites] = await Promise.all([
    supabase.from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
    supabase.from("favorites").select("post_id").eq("user_id", userId).in("post_id", postIds),
  ]);
  return {
    liked: (likes.data ?? []).map((row) => row.post_id as string),
    favorited: (favorites.data ?? []).map((row) => row.post_id as string),
  };
}

/** Public posts and tags, for the sitemap. Cached; any post change refreshes it. */
export async function listSitemapEntries(): Promise<{ posts: { id: string; created_at: string }[]; tags: { slug: string }[] }> {
  "use cache";
  cacheTag("feed");
  cacheLife("hours");

  const supabase = createAnonClient();
  if (!supabase) return { posts: [], tags: [] };
  const [posts, tags] = await Promise.all([
    supabase.from("posts").select("id, created_at").eq("visibility", "public").order("created_at", { ascending: false }).limit(5000),
    supabase.from("tags").select("slug").order("created_at", { ascending: false }).limit(5000),
  ]);
  if (posts.error || tags.error) throw new Error("could not list public pages");
  return { posts: (posts.data ?? []) as { id: string; created_at: string }[], tags: (tags.data ?? []) as { slug: string }[] };
}
