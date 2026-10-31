import type { Metadata } from "next";
import Link from "next/link";
import { ScaleStatus } from "@/components/scales/ScaleStatus";
import { SCALES, SCALE_GROUPS } from "@/lib/scales";
import { isUnconfirmed } from "@/lib/scales/rights";
import { minutesFor } from "@/lib/scales/disclaimer";

export const metadata: Metadata = {
  title: "量表",
  description: "把常用的心理量表做成可以直接在网页上作答的测验：一次一题，答完自动算分并给出解读。作答只保存在你的浏览器里。",
  alternates: { canonical: "/scales" },
};

export default function ScalesPage() {
  const groups = SCALE_GROUPS.map((group) => ({ group, scales: SCALES.filter((scale) => scale.group === group.id) })).filter(
    ({ scales }) => scales.length > 0,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">量表</h1>
        <Link href="/books" className="btn btn-sm">
          按书浏览 →
        </Link>
      </div>
      <p className="mt-2 leading-7 text-muted">
        常用的心理量表，直接在网页上作答：一次一题，可以回头改，答完自动算分并给出解读。作答和结果只保存在这台设备的浏览器里，不上传，也不需要登录。
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">量表只用于自我了解，不是诊断，不能代替专业的评估。</p>

      {groups.map(({ group, scales }) => (
        <section key={group.id} className="mt-8" aria-labelledby={`group-${group.id}`}>
          <h2 id={`group-${group.id}`} className="text-lg font-semibold">
            {group.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{group.description}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {scales.map((scale) => (
              <li key={scale.id}>
                <Link href={`/scales/${scale.id}`} prefetch className="card flex h-full flex-col p-4 transition-colors hover:bg-sunken">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{scale.title}</span>
                    <span className="chip shrink-0">{scale.short}</span>
                  </span>
                  {isUnconfirmed(scale) ? (
                    <span className="mt-1.5 self-start rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn-ink">
                      未获授权 · 个人试用
                    </span>
                  ) : null}
                  <span className="mt-1 text-sm leading-6 text-muted">{scale.summary}</span>
                  <span className="mt-2 text-xs text-muted">
                    {scale.items.length} 道题 · 约 {minutesFor(scale.items.length)} 分钟
                  </span>
                  <ScaleStatus scale={scale} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
