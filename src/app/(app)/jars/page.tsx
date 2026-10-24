import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { listJars, requireUser } from "@/lib/dal";
import { WORK_KIND_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "我的罐子" };

const dateFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" });

async function JarList() {
  await requireUser("/jars");
  const jars = await listJars();

  if (jars.length === 0) {
    return (
      <div className="card mt-6 px-6 py-12 text-center">
        <p className="font-medium">还没有罐子</p>
        <p className="mt-1 text-sm text-muted">选一部作品，开始记第一条笔记。</p>
        <Link href="/jars/new" className="btn btn-primary mt-5">
          新建罐子
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {jars.map((jar) => (
        <li key={jar.id}>
          <Link href={`/jars/${jar.id}`} className="card flex gap-4 p-4 transition-colors hover:bg-sunken">
            <Cover src={jar.work.cover_url} kind={jar.work.kind} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{jar.work.title}</h2>
              {jar.work.title_original ? (
                <p className="truncate text-sm text-muted">{jar.work.title_original}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="chip">{WORK_KIND_LABEL[jar.work.kind]}</span>
                <VisibilityBadge visibility={jar.visibility} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {jar.sources} 个资源 · {jar.notes} 条笔记 · {dateFormat.format(new Date(jar.updated_at))}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function JarsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">我的罐子</h1>
        <Link href="/jars/new" className="btn btn-primary">
          新建罐子
        </Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-xl bg-sunken" />}>
        <JarList />
      </Suspense>
    </main>
  );
}
