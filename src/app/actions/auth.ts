"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isOAuthProvider, OAUTH_LABELS } from "@/lib/auth-providers";
import { requestSiteUrl, safeNextPath } from "@/lib/site";
import { supabaseConfig } from "@/lib/supabase/config";
import { enabledOAuthProviders } from "@/lib/supabase/providers";
import { createClient } from "@/lib/supabase/server";
import { enforce, LIMITS } from "@/lib/server/limits";
import { clientKey } from "@/lib/server/request";

export interface AuthState {
  error?: string;
  message?: string;
}

const credentials = z.object({
  email: z.email("请输入有效的邮箱地址").max(254),
  password: z.string().min(8, "密码至少 8 位").max(200),
});

/** One action for the buttons of the login form: `intent` says which was pressed (sign in, sign up, a link by e-mail, or an outside account). */
export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!supabaseConfig()) return { error: "服务器还没有配置 Supabase：请先设置 SUPABASE_URL 和 SUPABASE_ANON_KEY（见 .env.example）。" };
  const intent = String(formData.get("intent") ?? "signin");
  const next = safeNextPath(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim();

  const limited = await enforce(LIMITS.signIn, await clientKey());
  if (!limited.ok) return { error: `尝试次数太多，请 ${limited.retryAfter} 秒后再试。` };

  const supabase = await createClient();
  // where the e-mail links and the outside accounts send the person back to; Supabase only follows addresses it
  // has been told about (Authentication → URL Configuration)
  const callback = `${await requestSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  if (isOAuthProvider(intent)) {
    // The buttons are only shown for the providers that are on. A form sent by hand, or a moment after one was
    // switched off, gets this answer instead of Supabase's own error page.
    if (!(await enabledOAuthProviders()).includes(intent)) return { error: `暂时不能用 ${OAUTH_LABELS[intent]} 登录。` };
    // On the server this only makes the address (and keeps the code verifier in a cookie, see /auth/callback).
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: intent, options: { redirectTo: callback, skipBrowserRedirect: true } });
    if (error || !data.url) return { error: `连接 ${OAUTH_LABELS[intent]} 失败，请稍后再试。` };
    redirect(data.url);
  }

  if (intent === "magic") {
    const parsed = z.email("请输入有效的邮箱地址").safeParse(email);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback } });
    if (error) return { error: "发送失败，请稍后再试。" };
    return { message: "登录链接已发送，请查收邮件。" };
  }

  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: callback },
    });
    if (error) return { error: "注册失败：" + error.message };
    if (!data.session) return { message: "确认邮件已发送，点击邮件里的链接即可完成注册。" };
    redirect(next);
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "邮箱或密码不正确。" };
  redirect(next);
}
