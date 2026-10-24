"use server";

import { fail, type ActionResult } from "@/lib/action";
import { getCurrentUser } from "@/lib/dal";
import { resolveLink, type ResolvedLink } from "@/lib/links/resolve";
import { rateLimit } from "@/lib/server/ratelimit";

/** Recognise a pasted link and fetch a metadata snapshot (title, thumbnail, …). Nothing is saved. */
export async function previewLink(input: string): Promise<ActionResult<{ preview: ResolvedLink }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  if (typeof input !== "string" || input.length > 2000) return fail("链接无效。");
  const limited = rateLimit(`resolve:${user.id}`, 30, 60_000);
  if (!limited.ok) return fail(`解析太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const result = await resolveLink(input);
  return result.ok ? { ok: true, preview: result.value } : fail(result.error);
}
