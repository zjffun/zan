"use server";

import { z } from "zod";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { normalizeComment } from "@/lib/post-input";
import { rateLimit } from "@/lib/server/ratelimit";
import { createClient } from "@/lib/supabase/server";
import type { AuthorRef, CommentData } from "@/lib/types";

const POSTGRES_FK_VIOLATION = "23503";
const POSTGRES_CHECK_VIOLATION = "23514";

const inputSchema = z.object({
  postId: z.uuid(),
  parentId: z.uuid().nullable().default(null),
  body: z.unknown(),
});

export async function addComment(input: {
  postId: string;
  parentId?: string | null;
  body: string;
}): Promise<ActionResult<{ comment: CommentData }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const body = normalizeComment(parsed.data.body);
  if (!body) return fail("评论要 1–1000 个字。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`comment:${user.id}`, 20, 10 * 60_000);
  if (!limited.ok) return fail(`评论太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: parsed.data.postId, parent_id: parsed.data.parentId, body })
    .select("id, post_id, parent_id, body, created_at, author:profiles(id, nickname)")
    .single();
  if (error) {
    if (error.code === POSTGRES_FK_VIOLATION) return fail("找不到这条内容。");
    if (error.code === POSTGRES_CHECK_VIOLATION) return fail("只能回复一级评论。");
    return fail("评论失败。");
  }
  const row = data as unknown as Omit<CommentData, "author"> & { author: AuthorRef | null };
  return { ok: true, comment: { ...row, author: row.author ?? { id: user.id, nickname: "我" } } };
}

/** Deletes a comment (and the replies under it). Allowed for its author and for the post's author. */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  if (!isUuid(commentId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").delete().eq("id", commentId).select("id");
  if (error) return fail("删除失败。");
  if (!data || data.length === 0) return fail("没有权限删除这条评论。");
  return { ok: true };
}
