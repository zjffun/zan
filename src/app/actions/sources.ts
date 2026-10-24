"use server";

import { z } from "zod";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { resolveLink, type ResolvedLink } from "@/lib/links/resolve";
import { rateLimit } from "@/lib/server/ratelimit";
import { parseSourceInput } from "@/lib/sources";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";

const POSTGRES_UNIQUE_VIOLATION = "23505";

/** Step 1 of adding a link: recognise it and fetch a metadata snapshot. Nothing is saved. */
export async function previewLink(input: string): Promise<ActionResult<{ preview: ResolvedLink }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  if (typeof input !== "string" || input.length > 2000) return fail("链接无效。");
  const limited = rateLimit(`resolve:${user.id}`, 30, 60_000);
  if (!limited.ok) return fail(`解析太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const result = await resolveLink(input);
  return result.ok ? { ok: true, preview: result.value } : fail(result.error);
}

const addSchema = z.object({
  jarId: z.uuid(),
  source: z.unknown(),
  /** the title the user confirmed or typed in */
  title: z.string().trim().max(300).optional(),
});

/** Step 2: save a source (a resolved link, an episode, a book edition) into a jar. */
export async function addSource(input: {
  jarId: string;
  source: unknown;
  title?: string;
}): Promise<ActionResult<{ source: Source }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`source:${user.id}`, 60, 60_000);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);

  let source;
  try {
    source = parseSourceInput(parsed.data.source);
  } catch (error) {
    return fail(error instanceof z.ZodError ? zodMessage(error) : "资源无效。");
  }
  if (parsed.data.title) source.meta = { ...(source.meta ?? {}), title: parsed.data.title };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .insert({ jar_id: parsed.data.jarId, provider: source.provider, ref: source.ref, meta: source.meta })
    .select("*")
    .single();
  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) return fail("这个资源已经在罐子里了。");
    return fail("添加失败。");
  }
  return { ok: true, source: data as Source };
}

/** Removes a source. Its notes stay, detached from it. */
export async function removeSource(sourceId: string): Promise<ActionResult> {
  if (!isUuid(sourceId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const supabase = await createClient();
  const { error } = await supabase.from("sources").delete().eq("id", sourceId);
  return error ? fail("删除失败。") : { ok: true };
}

/** Fixes the saved title of a source (useful when the platform would not tell us). */
export async function renameSource(sourceId: string, title: string): Promise<ActionResult<{ source: Source }>> {
  const parsed = z.object({ id: z.uuid(), title: z.string().trim().min(1).max(300) }).safeParse({ id: sourceId, title });
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");

  const supabase = await createClient();
  const current = await supabase.from("sources").select("meta").eq("id", parsed.data.id).maybeSingle();
  if (!current.data) return fail("找不到这个资源。");
  const { data, error } = await supabase
    .from("sources")
    .update({ meta: { ...(current.data.meta ?? {}), title: parsed.data.title } })
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  return error ? fail("保存失败。") : { ok: true, source: data as Source };
}
