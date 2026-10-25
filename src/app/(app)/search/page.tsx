import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { Pager } from "@/components/Pager";
import { PostList } from "@/components/PostList";
import { parsePage } from "@/lib/feed";
import { logError } from "@/lib/server/log";
import { searchPosts, type PostPage } from "@/lib/posts";
import { listTags } from "@/lib/tags";
import { TAG_KIND_LABEL, type TagListItem } from "@/lib/types";

export const metadata: Metadata = { title: "搜索", robots: { index: false, follow: false } };

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 100) ?? "";
  const page = parsePage(params.page);

  let posts: PostPage | null = null;
  let tags: TagListItem[] = [];
  let failed = false;
  // anybody may search, signed in or not: the per-address limit is applied in proxy.ts (this page is rendered twice per request)
  if (q) {
    try {
      [posts, tags] = await Promise.all([
        searchPosts(q, page),
        page === 1 ? listTags({ q, sort: "hot" }, 6).then((r) => r.items) : Promise.resolve([]),
      ]);
    } catch (error) {
      logError("search", error);
      failed = true;
    }
  }

  return (
    <>
      <form className="mt-5 flex gap-2" role="search">
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="搜索内容和标签"
          aria-label="搜索关键词"
          autoFocus
        />
        <button className="btn btn-primary shrink-0">搜索</button>
      </form>

      {failed ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          搜索失败，请稍后再试。
        </p>
      ) : null}

      {tags.length > 0 ? (
        <section className="mt-5" aria-label="标签">
          <h2 className="text-sm font-medium text-muted">标签</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link href={`/t/${tag.slug}`} className="card flex items-center gap-3 p-2.5 transition-colors hover:bg-sunken">
                  <Cover src={tag.cover_url} kind={tag.kind} label={tag.kind ? undefined : Array.from(tag.name)[0]} className="h-12 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">#{tag.name}</span>
                    <span className="block text-xs text-muted">
                      {tag.kind ? `${TAG_KIND_LABEL[tag.kind]} · ` : ""}
                      {tag.post_count} 条内容
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q && posts && !failed ? (
        posts.items.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">
            {page > 1 ? "这一页没有内容了。" : tags.length > 0 ? "没有匹配的内容。" : `没有找到“${q}”。`}
          </p>
        ) : (
          <section className="mt-6" aria-label="内容">
            {tags.length > 0 ? <h2 className="mb-2 text-sm font-medium text-muted">内容</h2> : null}
            <PostList items={posts.items} />
            <Pager path="/search" page={page} hasMore={posts.hasMore} params={{ q }} />
          </section>
        )
      ) : null}
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">搜索</h1>
      <Suspense fallback={<div className="mt-5 h-10 animate-pulse rounded-lg bg-sunken" />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
