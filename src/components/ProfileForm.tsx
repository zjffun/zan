"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { useResetOnHide } from "@/lib/use-reset-on-hide";

export function ProfileForm({ nickname, bio }: { nickname: string; bio: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ nickname, bio });
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});
  const [busy, setBusy] = useState(false);
  // the page stays alive (hidden) when you leave it: do not greet the next visit with an old "saved"
  const clearWhenLeft = useResetOnHide(() => setState({}));

  async function submit() {
    setBusy(true);
    setState({});
    const result = await updateProfile(values);
    setBusy(false);
    if (!result.ok) return setState({ error: result.error });
    setState({ saved: true });
    clearWhenLeft();
    router.refresh();
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="block text-sm font-medium">
        昵称
        <input
          className="input mt-1"
          value={values.nickname}
          onChange={(event) => setValues({ ...values, nickname: event.target.value })}
          maxLength={24}
          required
        />
      </label>
      <label className="block text-sm font-medium">
        简介
        <textarea
          className="input mt-1 min-h-20"
          value={values.bio}
          onChange={(event) => setValues({ ...values, bio: event.target.value })}
          maxLength={200}
          rows={3}
          placeholder="一句话介绍自己（可选）"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          已保存。
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={busy || !values.nickname.trim()}>
        {busy ? "保存中…" : "保存"}
      </button>
      <p className="border-t border-line pt-4 text-sm text-muted">
        你的内容随时可以带走：
        <a className="ml-1 text-accent underline underline-offset-2" href="/api/export" download>
          导出为 Markdown
        </a>
      </p>
    </form>
  );
}
