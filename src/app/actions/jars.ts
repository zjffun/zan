"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { rateLimit } from "@/lib/server/ratelimit";
import { createClient } from "@/lib/supabase/server";
import { getBangumiEpisodes, getBangumiWork, searchBangumi, type BangumiEpisode } from "@/lib/works/bangumi";
import { getOpenLibraryWork, searchOpenLibrary } from "@/lib/works/openlibrary";
import { createJarInputSchema, type WorkCandidate, type WorkRecord } from "@/lib/works/types";
import { z } from "zod";

const POSTGRES_UNIQUE_VIOLATION = "23505";

/** Search Bangumi (anime, books, manga, games, live action) and Open Library (books, ISBN). */
export async function searchWorks(rawQuery: string): Promise<ActionResult<{ candidates: WorkCandidate[] }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const query = rawQuery.trim().slice(0, 100);
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

/** One page of episodes of a Bangumi subject, for the "which episode" picker. */
export async function listEpisodes(
  subjectId: string,
  offset = 0,
): Promise<ActionResult<{ total: number; episodes: BangumiEpisode[] }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  if (!/^\d{1,9}$/.test(subjectId) || !Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    return fail("参数无效。");
  }
  const limited = rateLimit(`episodes:${user.id}`, 30, 60_000);
  if (!limited.ok) return fail(`请求太频繁，请 ${limited.retryAfter} 秒后再试。`);
  try {
    return { ok: true, ...(await getBangumiEpisodes(subjectId, offset)) };
  } catch {
    return fail("剧集列表暂时无法获取。");
  }
}

/** Finds the shared catalog entry for a work, creating it if it is new. */
async function ensureWork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: z.infer<typeof createJarInputSchema>,
): Promise<{ workId: string } | { error: string }> {
  // Catalog works are identified by external id; reuse the existing row.
  const externalKey =
    input.origin === "bangumi" ? (["bangumi", input.id] as const) : input.origin === "openlibrary" ? (["openlibrary", input.id] as const) : null;
  if (externalKey) {
    const existing = await supabase.from("works").select("id").eq(`external->>${externalKey[0]}`, externalKey[1]).maybeSingle();
    if (existing.error) return { error: "读取作品库失败。" };
    if (existing.data) return { workId: existing.data.id };
  }

  // New work. Title and cover of catalog works come from the upstream API, never from the client.
  let record: WorkRecord | null;
  try {
    if (input.origin === "bangumi") record = await getBangumiWork(input.id);
    else if (input.origin === "openlibrary") record = await getOpenLibraryWork(input.id, input.isbn);
    else {
      record = {
        kind: input.kind,
        title: input.title,
        title_original: input.title_original || null,
        cover_url: input.cover_url || null,
        external: {},
      };
    }
  } catch {
    return { error: "作品数据库暂时无法访问，请稍后再试。" };
  }
  if (!record) return { error: "在作品数据库里找不到这部作品。" };

  const inserted = await supabase.from("works").insert(record).select("id").single();
  if (inserted.error) {
    if (inserted.error.code === POSTGRES_UNIQUE_VIOLATION && externalKey) {
      // someone else added it a moment ago
      const again = await supabase.from("works").select("id").eq(`external->>${externalKey[0]}`, externalKey[1]).maybeSingle();
      if (again.data) return { workId: again.data.id };
    }
    return { error: "创建作品失败。" };
  }
  return { workId: inserted.data.id };
}

/** Creates (or opens) the jar for a work. */
export async function createJar(input: unknown): Promise<ActionResult<{ jarId: string }>> {
  const parsed = createJarInputSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`jar:${user.id}`, 20, 60_000);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const work = await ensureWork(supabase, parsed.data);
  if ("error" in work) return fail(work.error);

  const inserted = await supabase.from("jars").insert({ work_id: work.workId }).select("id").single();
  if (inserted.error) {
    if (inserted.error.code === POSTGRES_UNIQUE_VIOLATION) {
      // already have a jar for this work: just open it
      const existing = await supabase.from("jars").select("id").eq("work_id", work.workId).maybeSingle();
      if (existing.data) return { ok: true, jarId: existing.data.id };
    }
    return fail("创建罐子失败。");
  }
  return { ok: true, jarId: inserted.data.id };
}

/** Deletes a jar with everything in it, and takes its public page down. */
export async function deleteJar(jarId: string): Promise<ActionResult> {
  if (!isUuid(jarId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");

  const supabase = await createClient();
  const jar = await supabase.from("jars").select("slug").eq("id", jarId).maybeSingle();
  if (!jar.data) return fail("找不到这个罐子。");

  const { error } = await supabase.from("jars").delete().eq("id", jarId);
  if (error) return fail("删除失败。");

  updateTag(`pub:${jar.data.slug}`);
  updateTag("pub:index");
  redirect("/jars");
}
