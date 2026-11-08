"use client";

import { useActionState } from "react";
import { authenticate, type AuthState } from "@/app/actions/auth";
import { OAUTH_LABELS, type OAuthProvider } from "@/lib/auth-providers";
import { useHydrated } from "@/lib/use-hydrated";

/** `providers`: the outside accounts that can be used (the ones switched on in Supabase). `error`: what the page was sent here for. */
export function LoginForm({ next, error, providers }: { next: string; error?: string; providers: OAuthProvider[] }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, { error });
  const hydrated = useHydrated();

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium">
        邮箱
        <input
          className="input mt-1"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </label>
      <label className="block text-sm font-medium">
        密码
        <input
          className="input mt-1"
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={8}
          placeholder="至少 8 位（用邮件链接登录可不填）"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" name="intent" value="signin" disabled={pending}>
          登录
        </button>
        <button className="btn" name="intent" value="signup" disabled={pending}>
          注册
        </button>
        <button
          className="btn btn-quiet"
          name="intent"
          value="magic"
          disabled={pending}
          formNoValidate
          title="不用密码：我们把登录链接发到你的邮箱"
        >
          发送登录链接
        </button>
      </div>

      {providers.length > 0 ? (
        <>
          <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            或使用第三方账号
          </p>
          {/* formNoValidate: the e-mail box above is "required", and these do not use it. `hydrated`: the way on goes
              through a redirect to another site, which only the running page can follow (sent as a plain form, the
              page's own rules (form-action 'self') stop it and nothing seems to happen), so they wait for it. */}
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <button key={provider} className="btn" name="intent" value={provider} disabled={pending || !hydrated} formNoValidate>
                使用 {OAUTH_LABELS[provider]} 登录
              </button>
            ))}
          </div>
        </>
      ) : null}
    </form>
  );
}
