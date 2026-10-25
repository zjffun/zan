import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "找不到页面", robots: { index: false, follow: false } };

/** A page, post, tag or person that does not exist (or that you may not see). It sits inside the site's layout. */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">找不到这个页面</h1>
      <p className="mt-2 text-sm text-muted">它可能被删除了、只有作者自己能看到，或者地址写错了。</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          回首页
        </Link>
        <Link href="/tags" className="btn">
          看看标签
        </Link>
      </div>
    </main>
  );
}
