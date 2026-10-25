"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { changeEmail, changePassword, deleteAccount } from "@/app/actions/account";
import { attempt } from "@/lib/attempt";

type Notice = { error: string } | { done: string } | null;

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="font-semibold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {children}
    </section>
  );
}

function Message({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return "error" in notice ? (
    <p role="alert" className="text-sm text-danger">
      {notice.error}
    </p>
  ) : (
    <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
      {notice.done}
    </p>
  );
}

/** Sign-in details and leaving: the e-mail address, the password, and deleting the account. */
export function AccountSettings({ email }: { email: string | null }) {
  return (
    <>
      <Section title="登录邮箱" hint={email ? `现在是 ${email}。` : undefined}>
        <EmailForm />
      </Section>
      <Section title="密码" hint="只用邮件里的登录链接登录的话，这里可以给账号设一个密码。">
        <PasswordForm />
      </Section>
      <Section title="删除账号">
        <DeleteForm email={email} />
      </Section>
    </>
  );
}

function EmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setNotice(null);
    const result = await attempt(() => changeEmail({ email }));
    setBusy(false);
    if (!result.ok) return setNotice({ error: result.error });
    setEmail("");
    router.refresh();
    setNotice({
      done: result.pending ? `确认邮件已发到 ${result.pending}，点开里面的链接后，新邮箱才会生效。` : "邮箱已更新。",
    });
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="block text-sm font-medium">
        新邮箱
        <input
          className="input mt-1"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
        />
      </label>
      <Message notice={notice} />
      <button className="btn" disabled={busy || !email.trim()}>
        {busy ? "提交中…" : "修改邮箱"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setNotice(null);
    const result = await attempt(() => changePassword(values));
    setBusy(false);
    if (!result.ok) return setNotice({ error: result.error });
    setValues({ password: "", confirm: "" });
    setNotice({ done: "密码已修改。" });
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="block text-sm font-medium">
        新密码
        <input
          className="input mt-1"
          type="password"
          name="new-password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
          minLength={8}
          maxLength={200}
          required
        />
      </label>
      <label className="block text-sm font-medium">
        再输一遍
        <input
          className="input mt-1"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(event) => setValues({ ...values, confirm: event.target.value })}
          maxLength={200}
          required
        />
      </label>
      <Message notice={notice} />
      <button className="btn" disabled={busy || !values.password || !values.confirm}>
        {busy ? "提交中…" : "修改密码"}
      </button>
    </form>
  );
}

function DeleteForm({ email }: { email: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const expected = email ?? "删除";

  async function submit() {
    setBusy(true);
    setNotice(null);
    const result = await attempt(() => deleteAccount({ confirm }));
    if (!result.ok) {
      setBusy(false);
      return setNotice({ error: result.error });
    }
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <p className="mt-1 text-sm text-muted">
        删掉账号，以及你发布的全部内容、评论、点赞、收藏和上传的图片。
        <button type="button" className="tap ml-1 text-danger underline underline-offset-2" onClick={() => setOpen(true)}>
          我要删除账号
        </button>
      </p>
    );
  }

  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-danger/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm">
        这会<strong>永久删除</strong>你的账号，和你发布的全部内容、评论、点赞、收藏、关注，以及上传的图片，<strong>无法恢复</strong>。别人收藏过的你的内容也会一起消失。你建过的标签会留下，它们属于所有用过的人。想留一份的话，先
        <a className="mx-1 text-accent underline underline-offset-2" href="/api/export" download>
          导出为 Markdown
        </a>
        。
      </p>
      <label className="block text-sm font-medium">
        请输入“{expected}”来确认
        <input
          className="input mt-1"
          name="confirm-delete"
          autoComplete="off"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      <Message notice={notice} />
      <div className="flex gap-2">
        <button className="btn btn-danger" disabled={busy || confirm.trim().toLowerCase() !== expected.toLowerCase()}>
          {busy ? "删除中…" : "永久删除我的账号"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>
          取消
        </button>
      </div>
    </form>
  );
}
