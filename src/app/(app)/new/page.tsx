import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "新建", robots: { index: false, follow: false } };

export default function NewPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">新建</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/new/post" className="card p-5 transition-colors hover:bg-sunken">
          <h2 className="font-semibold">发布内容</h2>
          <p className="mt-1 text-sm text-muted">一段想法，或一个 B 站 / YouTube 视频，可以挂多个标签。</p>
        </Link>
        <Link href="/new/tag" className="card p-5 transition-colors hover:bg-sunken">
          <h2 className="font-semibold">新建标签</h2>
          <p className="mt-1 text-sm text-muted">动漫、书、一部作品或一个话题：聚在一起的地方。</p>
        </Link>
      </div>
    </main>
  );
}
