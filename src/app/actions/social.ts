"use server";

import { fail, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { enforce, LIMITS } from "@/lib/server/limits";
import { failLogged } from "@/lib/server/log";
import { createClient } from "@/lib/supabase/server";

const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_FK_VIOLATION = "23503";

type Table = "likes" | "favorites";

async function setMark(table: Table, postId: string, on: boolean): Promise<ActionResult<{ likeCount: number }>> {
  if (!isUuid(postId) || typeof on !== "boolean") return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = await enforce(LIMITS.mark, user.id);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  if (on) {
    const { error } = await supabase.from(table).insert({ post_id: postId });
    // already there: the end state is what the user asked for
    if (error && error.code !== POSTGRES_UNIQUE_VIOLATION) {
      if (error.code === POSTGRES_FK_VIOLATION) return fail("找不到这条内容。");
      return failLogged(`social.${table}.add`, error, "操作失败。", { post: postId });
    }
  } else {
    const { error } = await supabase.from(table).delete().eq("post_id", postId).eq("user_id", user.id);
    if (error) return failLogged(`social.${table}.remove`, error, "操作失败。", { post: postId });
  }

  // the trigger has updated the counter: report the real number back
  const post = await supabase.from("posts").select("like_count").eq("id", postId).maybeSingle();
  return { ok: true, likeCount: (post.data?.like_count as number | undefined) ?? 0 };
}

export const setLike = async (postId: string, on: boolean) => setMark("likes", postId, on);
export const setFavorite = async (postId: string, on: boolean) => setMark("favorites", postId, on);
