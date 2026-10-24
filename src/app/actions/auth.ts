"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestSiteUrl, safeNextPath } from "@/lib/site";
import { supabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/server/ratelimit";
import { headers } from "next/headers";

export interface AuthState {
  error?: string;
  message?: string;
}

const credentials = z.object({
  email: z.email("请输入有效的邮箱地址").max(254),
  password: z.string().min(8, "密码至少 8 位").max(200),
});

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

/** One action for the three buttons of the login form: `intent` says which was pressed. */
export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!supabaseConfig()) return { error: "服务器还没有配置 Supabase：请先设置 SUPABASE_URL 和 SUPABASE_ANON_KEY（见 .env.example）。" };
  const intent = String(formData.get("intent") ?? "signin");
  const next = safeNextPath(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim();

  const limited = rateLimit(`auth:${await clientKey()}`, 20, 10 * 60_000);
  if (!limited.ok) return { error: `尝试次数太多，请 ${limited.retryAfter} 秒后再试。` };

  const supabase = await createClient();
  const emailRedirectTo = `${await requestSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  if (intent === "magic") {
    const parsed = z.email("请输入有效的邮箱地址").safeParse(email);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
    if (error) return { error: "发送失败，请稍后再试。" };
    return { message: "登录链接已发送，请查收邮件。" };
  }

  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo },
    });
    if (error) return { error: "注册失败：" + error.message };
    if (!data.session) return { message: "确认邮件已发送，点击邮件里的链接即可完成注册。" };
    redirect(next);
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "邮箱或密码不正确。" };
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
