import { collectImages } from "./doc/images";
import { sanitizeDocOrEmpty, type DocNode } from "./doc/schema";
import { docToPlainText } from "./doc/text";
import { parseSourceInput, type SourceInput } from "./sources";
import type { Visibility } from "./types";

/**
 * The unfinished post, kept in this browser (and only there) so that closing the tab or reloading the
 * page does not lose what was written. What is read back is checked like anything else that comes from
 * outside: the text goes through the same whitelist as a post, the link through the same parser.
 */

/** A draft that has not been touched for this long is forgotten. */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TAGS = 5;

export interface Draft {
  body: DocNode;
  source: SourceInput | null;
  /** the title of the attached link: the platform's, or what the author typed over it */
  title: string;
  tags: { id?: string; name: string }[];
  visibility: Visibility;
  /** milliseconds since 1970 */
  savedAt: number;
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One draft for a new post, and one for each post being edited. */
export const draftKey = (postId?: string) => (postId ? `zan:draft:edit:${postId}` : "zan:draft:new");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only text, a picture or a link make a draft worth keeping: tags and visibility alone do not. */
export function hasContent(draft: Pick<Draft, "body" | "source">): boolean {
  return Boolean(draft.source) || docToPlainText(draft.body) !== "" || collectImages(draft.body).length > 0;
}

function parseDraft(value: unknown, now: number): Draft | null {
  if (!isRecord(value) || value.v !== 1 || typeof value.savedAt !== "number") return null;
  if (now - value.savedAt > DRAFT_MAX_AGE_MS) return null;

  let source: SourceInput | null = null;
  if (value.source !== null && value.source !== undefined) {
    try {
      source = parseSourceInput(value.source);
    } catch {
      source = null; // a link that no longer checks out is dropped, the text stays
    }
  }
  const tags = Array.isArray(value.tags)
    ? value.tags.flatMap((tag): Draft["tags"] =>
        isRecord(tag) && typeof tag.name === "string" && tag.name.trim() !== "" && tag.name.length <= 200
          ? [{ name: tag.name, ...(typeof tag.id === "string" && UUID.test(tag.id) ? { id: tag.id } : {}) }]
          : [],
      )
    : [];

  const draft: Draft = {
    body: sanitizeDocOrEmpty(value.body),
    source,
    title: typeof value.title === "string" ? value.title.slice(0, 300) : "",
    tags: tags.slice(0, MAX_TAGS),
    visibility: value.visibility === "private" ? "private" : "public",
    savedAt: value.savedAt,
  };
  return hasContent(draft) ? draft : null;
}

/** The saved draft, or null (nothing saved, too old, not readable, or storage is not available). */
export function readDraft(storage: DraftStorage, key: string, now = Date.now()): Draft | null {
  try {
    const raw = storage.getItem(key);
    return raw ? parseDraft(JSON.parse(raw), now) : null;
  } catch {
    return null;
  }
}

/** Saves the draft, or forgets it when there is nothing in it. Never throws: a full or blocked storage just means no draft. */
export function writeDraft(storage: DraftStorage, key: string, draft: Omit<Draft, "savedAt">, now = Date.now()): void {
  try {
    if (!hasContent(draft)) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ v: 1, ...draft, savedAt: now }));
  } catch {
    // no storage, or no room: the draft is a convenience
  }
}

/** This browser's storage, or one that keeps nothing when the browser does not allow it (private windows, blocked site data). */
export function browserStorage(): DraftStorage {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}

export function clearDraft(storage: DraftStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // see writeDraft
  }
}
