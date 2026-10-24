import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { anchorSchema, anchorLabel } from "@/lib/anchor";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "搜索笔记", robots: { index: false, follow: false } };

interface Hit {
  note_id: string;
  jar_id: string;
  anchor: unknown;
  plain_text: string;
  work_title: string;
}

/** A short excerpt around the first match. */
function excerpt(text: string, query: string): string {
  const flat = text.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, (at < 0 ? 0 : at) - 30);
  const slice = Array.from(flat.slice(start)).slice(0, 120).join("");
  return `${start > 0 ? "…" : ""}${slice}${flat.length - start > slice.length ? "…" : ""}`;
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 100) ?? "";
  await requireUser(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);

  let hits: Hit[] = [];
  let failed = false;
  if (query) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_notes", { q: query, lim: 50 });
    if (error) failed = true;
    else hits = (data ?? []) as Hit[];
  }

  return (
    <>
      <form className="mt-5 flex gap-2" role="search">
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="搜索所有罐子里的笔记和作品名"
          aria-label="搜索关键词"
          autoFocus
        />
        <button className="btn btn-primary shrink-0">搜索</button>
      </form>

      {failed ? <p role="alert" className="mt-4 text-sm text-danger">搜索失败，请稍后再试。</p> : null}
      {query && !failed ? (
        <p className="mt-4 text-sm text-muted">
          “{query}”：{hits.length} 条结果
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {hits.map((hit) => {
          const anchor = anchorSchema.safeParse(hit.anchor);
          return (
            <li key={hit.note_id}>
              <Link href={`/jars/${hit.jar_id}`} className="card block p-3.5 transition-colors hover:bg-sunken">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{hit.work_title}</span>
                  {anchor.success ? <span className="anchor-chip !m-0 !cursor-pointer">{anchorLabel(anchor.data)}</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted">{excerpt(hit.plain_text, query)}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">搜索笔记</h1>
      <Suspense fallback={<div className="mt-5 h-10 animate-pulse rounded-lg bg-sunken" />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
