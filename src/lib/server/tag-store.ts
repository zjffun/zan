import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TagKind, TagRef } from "@/lib/types";
import { logError } from "./log";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const POSTGRES_UNIQUE_VIOLATION = "23505";
const TAG_COLUMNS = "id, slug, name, kind";

/** Escapes LIKE wildcards, so a name is matched literally by `ilike`. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The tag with this name (ignoring case), if there is one. */
export async function findTagByName(supabase: Supabase, name: string): Promise<TagRef | null> {
  const { data } = await supabase.from("tags").select(TAG_COLUMNS).ilike("name", escapeLike(name)).limit(1).maybeSingle();
  return (data as TagRef | null) ?? null;
}

export interface NewTag {
  name: string;
  kind?: TagKind | null;
  description?: string;
  cover_url?: string | null;
  external?: Record<string, string>;
}

/**
 * Creates a tag, or returns the one that already has this name (or catalog id).
 * `created` tells which happened, so the caller can say "already exists".
 */
export async function createOrFindTag(
  supabase: Supabase,
  tag: NewTag,
): Promise<{ tag: TagRef; created: boolean } | { error: string }> {
  const catalogKey = tag.external?.bangumi ? (["bangumi", tag.external.bangumi] as const) : tag.external?.openlibrary ? (["openlibrary", tag.external.openlibrary] as const) : null;
  if (catalogKey) {
    const byCatalog = await supabase.from("tags").select(TAG_COLUMNS).eq(`external->>${catalogKey[0]}`, catalogKey[1]).maybeSingle();
    if (byCatalog.data) return { tag: byCatalog.data as TagRef, created: false };
  }
  const existing = await findTagByName(supabase, tag.name);
  if (existing) return { tag: existing, created: false };

  const inserted = await supabase
    .from("tags")
    .insert({
      name: tag.name,
      kind: tag.kind ?? null,
      description: tag.description ?? "",
      cover_url: tag.cover_url ?? null,
      external: tag.external ?? {},
    })
    .select(TAG_COLUMNS)
    .single();
  if (inserted.error) {
    if (inserted.error.code === POSTGRES_UNIQUE_VIOLATION) {
      // somebody created it a moment ago
      const again = (catalogKey ? await supabase.from("tags").select(TAG_COLUMNS).eq(`external->>${catalogKey[0]}`, catalogKey[1]).maybeSingle() : null)?.data ?? (await findTagByName(supabase, tag.name));
      if (again) return { tag: again as TagRef, created: false };
    }
    logError("tags.create", inserted.error, { name: tag.name });
    return { error: "创建标签失败。" };
  }
  return { tag: inserted.data as TagRef, created: true };
}
