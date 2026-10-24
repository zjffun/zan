"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser, type PublicationInfo } from "@/lib/dal";
import { rateLimit } from "@/lib/server/ratelimit";
import { createClient } from "@/lib/supabase/server";

const publishSchema = z.object({
  jarId: z.uuid(),
  visibility: z.enum(["unlisted", "public"]),
});

/**
 * Publishing writes a snapshot (publish_jar) and bumps its version; the live
 * private notes keep changing without touching the public page. Publish again
 * to update it.
 */
export async function publishJar(
  jarId: string,
  visibility: "unlisted" | "public",
): Promise<ActionResult<{ publication: PublicationInfo }>> {
  const parsed = publishSchema.safeParse({ jarId, visibility });
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`publish:${user.id}`, 10, 60_000);
  if (!limited.ok) return fail(`发布太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_jar", {
    p_jar_id: parsed.data.jarId,
    p_visibility: parsed.data.visibility,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return fail(error?.code === "P0002" ? "找不到这个罐子。" : "发布失败。");

  // Expire the cached public page, its share image and the sitemap right away.
  updateTag(`pub:${row.slug}`);
  updateTag("pub:index");
  return {
    ok: true,
    publication: { slug: row.slug, visibility: row.visibility, version: row.version, published_at: row.published_at },
  };
}

/** Takes the public page down by deleting the snapshot. */
export async function unpublishJar(jarId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(jarId).success) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");

  const supabase = await createClient();
  const jar = await supabase.from("jars").select("slug").eq("id", jarId).maybeSingle();
  if (!jar.data) return fail("找不到这个罐子。");

  const { error } = await supabase.rpc("unpublish_jar", { p_jar_id: jarId });
  if (error) return fail("取消发布失败。");

  updateTag(`pub:${jar.data.slug}`);
  updateTag("pub:index");
  return { ok: true };
}
