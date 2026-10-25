"use server";

import { updateTag } from "next/cache";
import { fail, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { preparePost, type PreparedPost } from "@/lib/post-input";
import { enforce, LIMITS } from "@/lib/server/limits";
import { failLogged } from "@/lib/server/log";
import { chargeNewTags } from "@/lib/server/tag-allowance";
import { createOrFindTag } from "@/lib/server/tag-store";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const POSTGRES_FK_VIOLATION = "23503";
const POSTGRES_CHECK_VIOLATION = "23514";

/**
 * Existing tags plus the ones typed in: the final set of tag ids, or an error. A tag typed in is a tag
 * made, so it is charged to the same allowance as the tag form (before anything is created).
 */
async function resolveTagIds(supabase: Supabase, prepared: PreparedPost, userId: string): Promise<{ ids: string[] } | { error: string }> {
  const ids = new Set(prepared.tagIds);
  const charged = await chargeNewTags(userId, prepared.newTagNames.length);
  if (!charged.ok) return { error: `新建标签太频繁，请 ${charged.retryAfter} 秒后再试。` };
  for (const name of prepared.newTagNames) {
    const result = await createOrFindTag(supabase, { name });
    if ("error" in result) return result;
    ids.add(result.tag.id);
  }
  if (ids.size > 5) return { error: "最多带 5 个标签。" };
  return { ids: [...ids] };
}

function columns(prepared: PreparedPost) {
  return {
    body: prepared.body,
    plain_text: prepared.plain_text,
    source: prepared.source,
    visibility: prepared.visibility,
  };
}

/** Publishes a post. Everything in `input` is untrusted: it is checked and cleaned by preparePost. */
export async function createPost(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const prepared = preparePost(input, user.id);
  if (!prepared.ok) return prepared;
  const limited = await enforce(LIMITS.postCreate, user.id);
  if (!limited.ok) return fail(`发布太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const tags = await resolveTagIds(supabase, prepared.value, user.id);
  if ("error" in tags) return fail(tags.error);

  const inserted = await supabase.from("posts").insert(columns(prepared.value)).select("id").single();
  if (inserted.error) return failLogged("posts.create", inserted.error, "发布失败。", { author: user.id });
  const id = inserted.data.id as string;

  if (tags.ids.length > 0) {
    const linked = await supabase.from("post_tags").insert(tags.ids.map((tag_id) => ({ post_id: id, tag_id })));
    if (linked.error) {
      await supabase.from("posts").delete().eq("id", id); // do not leave a half-made post behind
      if (linked.error.code === POSTGRES_FK_VIOLATION) return fail("有标签已经不存在了，请重新选择。");
      return failLogged("posts.create.tags", linked.error, "发布失败。", { post: id });
    }
  }

  updateTag("feed");
  return { ok: true, id };
}

/** Saves changes to one of your posts, including its tags. */
export async function updatePost(postId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(postId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const prepared = preparePost(input, user.id);
  if (!prepared.ok) return prepared;
  const limited = await enforce(LIMITS.postEdit, user.id);
  if (!limited.ok) return fail(`保存太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  // whose post is it? Before anything is made for it: a made-up id must not leave tags behind
  const owned = await supabase.from("posts").select("id").eq("id", postId).eq("author", user.id).maybeSingle();
  if (owned.error) return failLogged("posts.update.owner", owned.error, "保存失败。", { post: postId });
  if (!owned.data) return fail("找不到这条内容。");

  const tags = await resolveTagIds(supabase, prepared.value, user.id);
  if ("error" in tags) return fail(tags.error);

  const updated = await supabase.from("posts").update(columns(prepared.value)).eq("id", postId).select("id").maybeSingle();
  if (updated.error) return failLogged("posts.update", updated.error, "保存失败。", { post: postId });
  if (!updated.data) return fail("找不到这条内容。");

  // The body is saved from here on: the cached copies of the post and the feed are stale whatever happens to
  // its tags below (an early return there used to leave them showing the old text).
  updateTag("feed");
  updateTag(`post:${postId}`);

  const current = await supabase.from("post_tags").select("tag_id").eq("post_id", postId);
  if (current.error) return failLogged("posts.update.tags", current.error, "保存失败。", { post: postId });
  const have = new Set((current.data ?? []).map((row) => row.tag_id as string));
  const want = new Set(tags.ids);
  const remove = [...have].filter((id) => !want.has(id));
  const add = [...want].filter((id) => !have.has(id));
  if (remove.length > 0) {
    const removed = await supabase.from("post_tags").delete().eq("post_id", postId).in("tag_id", remove);
    if (removed.error) return failLogged("posts.update.untag", removed.error, "保存标签失败。", { post: postId });
  }
  if (add.length > 0) {
    const added = await supabase.from("post_tags").insert(add.map((tag_id) => ({ post_id: postId, tag_id })));
    if (added.error) {
      if (added.error.code === POSTGRES_CHECK_VIOLATION) return fail("最多带 5 个标签。");
      return failLogged("posts.update.tag", added.error, "保存标签失败。", { post: postId });
    }
  }

  return { ok: true, id: postId };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  if (!isUuid(postId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = await enforce(LIMITS.postDelete, user.id);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").delete().eq("id", postId).select("id");
  if (error) return failLogged("posts.delete", error, "删除失败。", { post: postId });
  if (!data || data.length === 0) return fail("找不到这条内容。");
  updateTag("feed");
  updateTag(`post:${postId}`);
  return { ok: true };
}
