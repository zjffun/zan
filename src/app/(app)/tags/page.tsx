import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { Pager } from "@/components/Pager";
import { buildHref, parsePage } from "@/lib/feed";
import { listTags } from "@/lib/tags";
import { TAG_KINDS, TAG_KIND_LABEL, type TagKind } from "@/lib/types";

export const metadata: Metadata = { title: "全部标签", description: "按作品、类型和话题浏览所有标签。" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function Directory({ searchParams }: Pick<PageProps<"/tags">, "searchParams">) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").trim().slice(0, 60);
  const kindParam = first(params.kind);
  const kind = (TAG_KINDS as readonly string[]).includes(kindParam ?? "") ? (kindParam as TagKind) : null;
  const sort = first(params.sort) === "new" ? "new" : "hot";
  const page = parsePage(params.page);

  const { items, hasMore } = await listTags({ q, kind, sort, page }).catch(() => ({ items: [], hasMore: false }));
  const keep = { q, kind, sort: sort === "hot" ? null : sort };

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`btn btn-sm shrink-0 ${active ? "!border-accent !bg-accent-soft !text-accent" : ""}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <form className="mt-5 flex gap-2" role="search">
        <input className="input" type="search" name="q" defaultValue={q} placeholder="搜索标签" aria-label="搜索标签" />
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        {sort === "new" ? <input type="hidden" name="sort" value="new" /> : null}
        <button className="btn btn-primary shrink-0">搜索</button>
      </form>

      <div className="-mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
        {chip("全部", buildHref("/tags", { ...keep, kind: null }), kind === null)}
        {TAG_KINDS.map((k) => chip(TAG_KIND_LABEL[k], buildHref("/tags", { ...keep, kind: k }), kind === k))}
        <span className="mx-1 h-4 w-px shrink-0 bg-line" />
        {chip("最热", buildHref("/tags", { ...keep, sort: null }), sort === "hot")}
        {chip("最新", buildHref("/tags", { ...keep, sort: "new" }), sort === "new")}
      </div>

      {items.length === 0 ? (
        <div className="card mt-4 px-6 py-12 text-center">
          <p className="font-medium">{q ? `没有找到“${q}”` : "还没有标签"}</p>
          <p className="mt-1 text-sm text-muted">自己建一个吧。</p>
          <Link href="/new/tag" className="btn btn-primary mt-5">
            新建标签
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((tag) => (
              <li key={tag.id}>
                <Link href={`/t/${tag.slug}`} className="card flex h-full gap-3 p-3.5 transition-colors hover:bg-sunken">
                  <Cover src={tag.cover_url} kind={tag.kind} label={tag.kind ? undefined : Array.from(tag.name)[0]} className="h-20 w-14" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">#{tag.name}</h2>
                    {tag.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{tag.description}</p> : null}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {tag.kind ? <span className="chip">{TAG_KIND_LABEL[tag.kind]}</span> : null}
                      <span>{tag.post_count} 条内容</span>
                      <span>{tag.follower_count} 人关注</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pager path="/tags" page={page} hasMore={hasMore} params={keep} />
        </>
      )}
    </>
  );
}

export default function TagsPage(props: PageProps<"/tags">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">全部标签</h1>
        <Link href="/new/tag" className="btn btn-primary">
          新建标签
        </Link>
      </div>
      <Suspense fallback={<div className="mt-5 h-40 animate-pulse rounded-xl bg-sunken" />}>
        <Directory searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
