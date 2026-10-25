"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a page shows when it fails to render (the database is down, a query was refused …). It sits inside the
 * site's layout, so the top bar stays. A server error reaches the browser without its message, only a `digest`:
 * the same id is in the server log (instrumentation.ts), so a person can quote it and it can be found.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">出错了</h1>
      <p className="mt-2 text-sm text-muted">页面没能加载出来。可以再试一次，如果一直这样，请稍后再来。</p>
      {digest ? <p className="mt-1 text-xs text-muted">错误编号：{digest}</p> : null}
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          重试
        </button>
        <Link href="/" className="btn">
          回首页
        </Link>
      </div>
    </main>
  );
}
