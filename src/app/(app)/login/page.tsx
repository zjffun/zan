import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { safeNextPath } from "@/lib/site";

export const metadata: Metadata = { title: "登录" };

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const linkError = params.error === "link";
  return <LoginForm next={next} linkError={linkError} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="mx-auto max-w-sm px-4 py-14">
      <h1 className="text-2xl font-bold tracking-tight">登录 zan</h1>
      <p className="mt-1 text-sm text-muted">还没有账号？输入邮箱和密码，点“注册”即可。</p>
      <Suspense fallback={<div className="mt-6 h-64" />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
