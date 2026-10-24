import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/Workspace";
import { loadJar, requireUser } from "@/lib/dal";
import { requestSiteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "笔记", robots: { index: false, follow: false } };

async function Editor({ params }: Pick<PageProps<"/jars/[id]">, "params">) {
  const { id } = await params;
  await requireUser(`/jars/${id}`);
  const bundle = await loadJar(id);
  if (!bundle) notFound();
  return <Workspace initial={bundle} origin={await requestSiteUrl()} />;
}

export default function JarPage(props: PageProps<"/jars/[id]">) {
  return (
    <main>
      <Suspense fallback={<div className="mx-auto mt-6 h-96 max-w-7xl animate-pulse rounded-xl bg-sunken" />}>
        <Editor params={props.params} />
      </Suspense>
    </main>
  );
}
