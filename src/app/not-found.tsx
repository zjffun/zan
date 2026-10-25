import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "找不到页面", robots: { index: false, follow: false } };

/** An address that matches no page at all. (A missing post or tag gets the one in (app), with the top bar.) */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">找不到这个页面</h1>
      <p className="mt-2 text-sm text-muted">地址可能写错了。</p>
      <div className="mt-6">
        <Link href="/" className="btn btn-primary">
          回首页
        </Link>
      </div>
    </main>
  );
}
