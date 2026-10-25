"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser } from "@/lib/dal";
import { enforce, LIMITS } from "@/lib/server/limits";
import { failLogged } from "@/lib/server/log";
import { createClient } from "@/lib/supabase/server";

const POSTGRES_UNIQUE_VIOLATION = "23505";

const profileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "昵称不能为空")
    .max(24, "昵称最多 24 个字")
    .refine((value) => !/[\u0000-\u001f\u007f-\u009f]/.test(value), "昵称里不能有控制字符"),
  bio: z.string().trim().max(200, "简介最多 200 个字"),
});

export async function updateProfile(input: { nickname: string; bio: string }): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  // a save clears the shared feed cache (cards show the nickname): it must not be a button to hammer
  const limited = await enforce(LIMITS.profileEdit, user.id);
  if (!limited.ok) return fail(`保存太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) return fail("这个昵称已经有人用了。");
    return failLogged("profile.update", error, "保存失败。");
  }

  updateTag("feed"); // cards show the author's nickname
  return { ok: true };
}
