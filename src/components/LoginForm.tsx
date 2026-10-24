"use client";

import { useActionState } from "react";
import { authenticate, type AuthState } from "@/app/actions/auth";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {
    error: linkError ? "登录链接已失效，请重新发送。" : undefined,
  });

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
    </form>
  );
}
