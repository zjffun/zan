import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScaleRunner } from "@/components/scales/ScaleRunner";
import { SCALES, getScale, isIndexable } from "@/lib/scales";

export function generateStaticParams() {
  return SCALES.map((scale) => ({ id: scale.id }));
}

export async function generateMetadata({ params }: PageProps<"/scales/[id]">): Promise<Metadata> {
  const scale = getScale((await params).id);
  if (!scale) return { title: "未找到", robots: { index: false, follow: false } };
  const title = `${scale.title}（${scale.short}）`;
  return {
    title,
    description: scale.summary,
    alternates: { canonical: `/scales/${scale.id}` },
    ...(isIndexable(scale) ? {} : { robots: { index: false, follow: false } }),
    openGraph: { title, description: scale.summary, type: "website", url: `/scales/${scale.id}` },
  };
}

/** The address is URL data, so what depends on it sits behind <Suspense>; the link back is part of the static shell. */
async function Scale({ params }: Pick<PageProps<"/scales/[id]">, "params">) {
  const scale = getScale((await params).id);
  if (!scale) notFound();
  return (
    <>
      <h1 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold tracking-tight">
        {scale.title}
        <span className="chip text-sm font-normal">{scale.short}</span>
      </h1>
      <div className="mt-4">
        <ScaleRunner scale={scale} />
      </div>
    </>
  );
}

export default function ScalePage(props: PageProps<"/scales/[id]">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/scales" className="tap -ml-1 text-sm text-muted transition-colors hover:text-accent">
        ‹ 全部量表
      </Link>
      <Suspense fallback={<div className="mt-3 h-72 animate-pulse rounded-xl bg-sunken" />}>
        <Scale params={props.params} />
      </Suspense>
    </main>
  );
}
