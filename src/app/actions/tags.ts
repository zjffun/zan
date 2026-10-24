"use server";

import { z } from "zod";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { rateLimit } from "@/lib/server/ratelimit";
import { createOrFindTag } from "@/lib/server/tag-store";
import { createClient } from "@/lib/supabase/server";
import { MAX_TAG_NAME_LENGTH, normalizeTagName } from "@/lib/tag-name";
import { listTags } from "@/lib/tags";
import { TAG_KINDS, type TagListItem, type TagRef } from "@/lib/types";
import { getBangumiWork, searchBangumi } from "@/lib/works/bangumi";
import { getOpenLibraryWork, searchOpenLibrary } from "@/lib/works/openlibrary";
import { tagFromWorkInputSchema, type WorkCandidate, type WorkRecord } from "@/lib/works/types";

const POSTGRES_UNIQUE_VIOLATION = "23505";

/** For the tag picker: existing tags that match what is being typed. */
export async function searchTags(q: string): Promise<ActionResult<{ tags: TagListItem[] }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  if (typeof q !== "string") return fail("参数无效。");
  const limited = rateLimit(`tagsearch:${user.id}`, 120, 60_000);
  if (!limited.ok) return fail(`搜索太频繁，请 ${limited.retryAfter} 秒后再试。`);
  const { items } = await listTags({ q: q.trim().replace(/^[#＃]+/, "").slice(0, 60), sort: "hot" }, 8);
  return { ok: true, tags: items };
}

const manualTagSchema = z.object({
  name: z.unknown(),
  kind: z.enum(TAG_KINDS).nullable().default(null),
  description: z.string().trim().max(300, "介绍最多 300 个字").default(""),
});

/** A tag typed in by hand. If the name is taken, you get the existing tag back (`created: false`). */
export async function createTag(input: {
  name: string;
  kind?: string | null;
  description?: string;
}): Promise<ActionResult<{ tag: TagRef; created: boolean }>> {
  const parsed = manualTagSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const name = normalizeTagName(parsed.data.name);
  if (!name) return fail(`标签名要 1–${MAX_TAG_NAME_LENGTH} 个字，不能包含 #。`);
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`tag:${user.id}`, 20, 10 * 60_000);
  if (!limited.ok) return fail(`创建太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const result = await createOrFindTag(supabase, { name, kind: parsed.data.kind, description: parsed.data.description });
  return "error" in result ? fail(result.error) : { ok: true, ...result };
}

/** Search Bangumi (anime, books, manga, games, live action) and Open Library (books, ISBN). */
export async function searchWorks(rawQuery: string): Promise<ActionResult<{ candidates: WorkCandidate[] }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const query = String(rawQuery ?? "").trim().slice(0, 100);
  if (query.length < 1) return { ok: true, candidates: [] };

  const limited = rateLimit(`search:${user.id}`, 30, 60_000);
  if (!limited.ok) return fail(`搜索太频繁，请 ${limited.retryAfter} 秒后再试。`);

  // One source being down must not break the other.
  const [bangumi, openlibrary] = await Promise.allSettled([searchBangumi(query), searchOpenLibrary(query)]);
  const candidates = [
    ...(bangumi.status === "fulfilled" ? bangumi.value : []),
    ...(openlibrary.status === "fulfilled" ? openlibrary.value : []),
  ];
  if (candidates.length === 0 && bangumi.status === "rejected" && openlibrary.status === "rejected") {
    return fail("作品数据库暂时无法访问，请稍后再试，或手动创建。");
  }
  return { ok: true, candidates };
}

/** A tag name from a catalog title: no "#", at most 30 characters. */
function tagNameFromTitle(title: string): string | null {
  const cleaned = Array.from(title.replace(/[#＃]/g, "").replace(/\s+/g, " ").trim())
    .slice(0, MAX_TAG_NAME_LENGTH)
    .join("")
    .trim();
  return normalizeTagName(cleaned);
}

/** Makes a tag for a work from Bangumi or Open Library, with its cover and type. Reuses an existing tag for it. */
export async function createTagFromWork(input: unknown): Promise<ActionResult<{ tag: TagRef; created: boolean }>> {
  const parsed = tagFromWorkInputSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`tag:${user.id}`, 20, 10 * 60_000);
  if (!limited.ok) return fail(`创建太频繁，请 ${limited.retryAfter} 秒后再试。`);

  // The title and cover come from the upstream API, never from the client.
  let record: WorkRecord | null;
  try {
    record =
      parsed.data.origin === "bangumi"
        ? await getBangumiWork(parsed.data.id)
        : await getOpenLibraryWork(parsed.data.id, parsed.data.isbn);
  } catch {
    return fail("作品数据库暂时无法访问，请稍后再试。");
  }
  if (!record) return fail("在作品数据库里找不到这部作品。");
  const name = tagNameFromTitle(record.title);
  if (!name) return fail("这部作品的名字不能用作标签。");

  const supabase = await createClient();
  const result = await createOrFindTag(supabase, {
    name,
    kind: record.kind,
    cover_url: record.cover_url,
    external: record.external,
    description: record.title_original && record.title_original !== record.title ? record.title_original : "",
  });
  return "error" in result ? fail(result.error) : { ok: true, ...result };
}

/** Follow / unfollow a tag: posts under it show up in the "关注" feed. */
export async function setFollow(tagId: string, on: boolean): Promise<ActionResult> {
  if (!isUuid(tagId) || typeof on !== "boolean") return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`follow:${user.id}`, 60, 60_000);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  if (on) {
    const { error } = await supabase.from("tag_follows").insert({ tag_id: tagId });
    if (error && error.code !== POSTGRES_UNIQUE_VIOLATION) return fail("操作失败。");
  } else {
    const { error } = await supabase.from("tag_follows").delete().eq("tag_id", tagId).eq("user_id", user.id);
    if (error) return fail("操作失败。");
  }
  return { ok: true };
}
