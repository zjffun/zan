import type { Anchor } from "./anchor";
import type { DocNode } from "./doc/schema";

export const WORK_KINDS = ["anime", "book", "manga", "game", "film", "other"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  anime: "动画",
  book: "书",
  manga: "漫画",
  game: "游戏",
  film: "影视",
  other: "其他",
};

export const SOURCE_PROVIDERS = ["youtube", "bilibili", "episode", "book", "link"] as const;
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

export type Visibility = "private" | "unlisted" | "public";

export interface Work {
  id: string;
  kind: WorkKind;
  title: string;
  title_original: string | null;
  cover_url: string | null;
  /** {"bangumi": "12", "isbn": "978...", "openlibrary": "OL45883W"} */
  external: Record<string, string>;
}

export interface Jar {
  id: string;
  owner: string;
  work_id: string;
  slug: string;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

/** What we remember about a source so notes stay readable if the video dies. */
export interface SourceMeta {
  title?: string;
  author?: string;
  thumbnail?: string;
  /** seconds */
  duration?: number;
  /** e.g. the Bilibili part title */
  part?: string;
}

export interface Source {
  id: string;
  jar_id: string;
  provider: SourceProvider;
  /** {"videoId"} | {"bvid","p"} | {"ep","bgm_ep","url"} | {"isbn","url"} | {"url"} */
  ref: Record<string, unknown>;
  meta: SourceMeta | null;
  status: "ok" | "dead";
  fail_count: number;
  checked_at: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  jar_id: string;
  source_id: string | null;
  anchor: Anchor | null;
  body: DocNode;
  plain_text: string;
  hide_on_publish: boolean;
  created_at: string;
  updated_at: string;
}

/** The part of a source the players and link builders need. */
export type SourceLike = Pick<Source, "provider" | "ref"> & { meta?: SourceMeta | null };
