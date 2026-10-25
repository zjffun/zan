"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action";
import { getCurrentEmail, getCurrentUser } from "@/lib/dal";
import { IMAGE_BUCKET } from "@/lib/image";
import { enforce, LIMITS } from "@/lib/server/limits";
import { failLogged, logError } from "@/lib/server/log";
import { requestSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const passwordSchema = z.string().min(8, "密码至少 8 位").max(200, "密码最多 200 位");

/** Sets a new password (also for somebody who has only ever signed in with an e-mail link). */
export async function changePassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  const password = passwordSchema.safeParse(input?.password);
  if (!password.success) return fail(password.error.issues[0].message);
  if (input.password !== input.confirm) return fail("两次输入的密码不一样。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = await enforce(LIMITS.accountChange, user.id);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (error.code === "same_password") return fail("新密码不能和现在的一样。");
    if (error.code === "weak_password") return fail("这个密码太容易被猜到，换一个。");
    if (error.code === "reauthentication_needed") return fail("为了安全，请先退出，重新登录以后再改密码。");
    return failLogged("account.password", error, "修改失败，请稍后再试。");
  }
  return { ok: true };
}

/** Asks to change the e-mail address: Supabase sends a link to the new address, and the change happens when it is opened. */
export async function changeEmail(input: { email: string }): Promise<ActionResult<{ pending: string | null }>> {
  const email = z.email("请输入有效的邮箱地址").max(254).safeParse(String(input?.email ?? "").trim());
  if (!email.success) return fail(email.error.issues[0].message);
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = await enforce(LIMITS.accountChange, user.id);
  if (!limited.ok) return fail(`操作太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  if ((await getCurrentEmail())?.toLowerCase() === email.data.toLowerCase()) return fail("这已经是你现在的邮箱了。");
  const emailRedirectTo = `${await requestSiteUrl()}/auth/callback?next=${encodeURIComponent("/settings")}`;
  const { data, error } = await supabase.auth.updateUser({ email: email.data }, { emailRedirectTo });
  if (error) {
    if (error.code === "email_exists") return fail("这个邮箱已经注册过了。");
    if (error.code === "over_email_send_rate_limit") return fail("邮件发得太频繁了，过一会儿再试。");
    return failLogged("account.email", error, "修改失败，请稍后再试。");
  }
  // with confirmation switched on the address changes when the link is opened; without it, now
  return { ok: true, pending: data.user?.new_email ?? null };
}

/** Removes the pictures a person uploaded. Best effort: the account is already gone, and a picture that is left has a name nobody can guess. */
async function removeImagesOf(userId: string): Promise<void> {
  try {
    const bucket = createAdminClient().storage.from(IMAGE_BUCKET);
    for (let round = 0; round < 100; round++) {
      const listed = await bucket.list(userId, { limit: 100 });
      if (listed.error) return logError("account.images", listed.error, { user: userId });
      if (listed.data.length === 0) return;
      const removed = await bucket.remove(listed.data.map((file) => `${userId}/${file.name}`));
      if (removed.error) return logError("account.images", removed.error, { user: userId });
    }
  } catch (error) {
    logError("account.images", error, { user: userId });
  }
}

/**
 * Deletes the account and everything that belongs to it: the profile, the posts, comments, likes,
 * bookmarks and follows (the database cascades from the user), and the pictures. The person has to type
 * their e-mail address first. Tags they made stay: they belong to everybody who used them.
 */
export async function deleteAccount(input: { confirm: string }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const supabase = await createClient();
  const expected = (await getCurrentEmail()) ?? "删除";
  if (String(input?.confirm ?? "").trim().toLowerCase() !== expected.toLowerCase()) return fail(`请输入“${expected}”来确认。`);
  const limited = await enforce(LIMITS.accountDelete, user.id);
  if (!limited.ok) return fail("操作太频繁，请明天再试。");

  // for the caches: the posts that are about to go
  const posts = await supabase.from("posts").select("id").eq("author", user.id).limit(500);

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return failLogged("account.delete", error, "删除失败，请稍后再试。", { user: user.id });

  await removeImagesOf(user.id);
  await supabase.auth.signOut(); // the session belonged to somebody who is gone: clears its cookies

  updateTag("feed");
  for (const post of posts.data ?? []) updateTag(`post:${post.id as string}`);
  return { ok: true };
}
