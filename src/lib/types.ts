
/** What sort of thing a tag is about. Plain topics have no kind. */
export const TAG_KINDS = ["anime", "book", "manga", "game", "film", "other"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const TAG_KIND_LABEL: Record<TagKind, string> = {
  anime: "动画",
  book: "书",
  manga: "漫画",
  game: "游戏",
  film: "影视",
  other: "其他",
};

export const SOURCE_PROVIDERS = ["youtube", "bilibili", "episode", "book", "link"] as const;
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

export type Visibility = "public" | "private";

/** What we remember about a source so a post stays readable if the video dies. */
export interface SourceMeta {
  title?: string;
  author?: string;
  thumbnail?: string;
  /** seconds */
  duration?: number;
  /** e.g. the Bilibili part title */
  part?: string;
}

/** What a post points at: a video or a link. Stored as `posts.source`. */
export interface PostSource {
  provider: SourceProvider;
  /** {"videoId"} | {"bvid","p"} | {"url"} | … */
  ref: Record<string, unknown>;
  meta: SourceMeta | null;
}

/** The part of a source the players and link builders need. */
export type SourceLike = Pick<PostSource, "provider" | "ref"> & { meta?: SourceMeta | null };

export interface TagRef {
  id: string;
  slug: string;
  name: string;
  kind: TagKind | null;
}

/** A tag page's header: the tag plus its counts. */
export interface TagInfo extends TagRef {
  description: string;
  cover_url: string | null;
  external: Record<string, string>;
  created_by: string | null;
  post_count: number;
  follower_count: number;
}

/** A row of the tag directory. */
export interface TagListItem extends TagRef {
  description: string;
  cover_url: string | null;
  post_count: number;
  follower_count: number;
}

export interface AuthorRef {
  id: string;
  nickname: string;
}

/** What a feed card needs: no body, just a teaser. */
export interface PostCardData {
  id: string;
  author: AuthorRef;
  excerpt: string;
  /** key of the first picture of the post, if it has one (shown when there is no video) */
  cover: string | null;
  source: PostSource | null;
  source_status: "ok" | "dead";
  visibility: Visibility;
  like_count: number;
  comment_count: number;
  created_at: string;
  tags: TagRef[];
}

/** Everything the post page shows. */
export interface PostDetailData extends Omit<PostCardData, "excerpt"> {
  /** TipTap JSON; always passed through sanitizeDoc before use */
  body: unknown;
  plain_text: string;
  updated_at: string;
}

export interface CommentData {
  id: string;
  post_id: string;
  parent_id: string | null;
  author: AuthorRef;
  /** the comment as HTML, rendered on the server from the whitelist (see lib/comment-html.ts) */
  html: string;
  created_at: string;
}

export interface Profile {
  id: string;
  nickname: string;
  bio: string;
  created_at: string;
}
