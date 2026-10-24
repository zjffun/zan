import Link from "next/link";
import { Suspense } from "react";
import { FeedCard } from "@/components/FeedCard";
import { feedHref, parseFeedQuery } from "@/lib/feed";
import { listPublicFeed, type FeedPage } from "@/lib/public";
import { WORK_KINDS, WORK_KIND_LABEL } from "@/lib/types";

/** The way in to writing: always on top, for visitors too (they are asked to sign in first). */
function ComposeBar() {
  return (
    <Link
      href="/jars/new"
      className="card flex items-center gap-3 px-4 py-3 text-muted transition-colors hover:bg-sunken"
    >
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg text-accent">
        +
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">攒一部作品：动画、书、游戏、一个视频系列……</span>
      <span className="btn btn-primary btn-sm shrink-0">新建</span>
    </Link>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden>
      <div className="mt-5 h-8 w-64 animate-pulse rounded-lg bg-sunken" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-sunken" />
        ))}
      </div>
    </div>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const query = parseFeedQuery(await searchParams);

  let feed: FeedPage | null = null;
  try {
    feed = await listPublicFeed(query);
  } catch {
    // database unreachable: say so instead of failing the whole page
  }

  const tabs = [{ kind: null, label: "全部" }, ...WORK_KINDS.map((kind) => ({ kind, label: WORK_KIND_LABEL[kind] }))];

  return (
    <>
      <nav aria-label="分类" className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {tabs.map((tab) => {
          const active = tab.kind === query.kind;
          return (
            <Link
              key={tab.label}
              href={feedHref({ kind: tab.kind, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={`btn btn-sm shrink-0 ${active ? "!border-accent !bg-accent-soft !text-accent" : ""}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {!feed ? (
        <p role="alert" className="card mt-4 px-6 py-12 text-center text-sm text-muted">
          内容暂时无法加载，请稍后刷新重试。
        </p>
      ) : feed.items.length === 0 ? (
        <div className="card mt-4 px-6 py-12 text-center">
          <p className="font-medium">{query.page > 1 ? "这一页没有内容了" : "这里还没有内容"}</p>
          <p className="mt-1 text-sm text-muted">
            {query.page > 1 ? "回到第一页看看。" : "发布你攒的笔记，它就会出现在这里。"}
          </p>
          {query.page > 1 ? (
            <Link href={feedHref({ kind: query.kind, page: 1 })} className="btn mt-5">
              回到第一页
            </Link>
          ) : (
            <Link href="/jars/new" className="btn btn-primary mt-5">
              攒一部作品
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {feed.items.map((item) => (
              <li key={item.slug}>
                <FeedCard item={item} />
              </li>
            ))}
          </ul>
          {query.page > 1 || feed.hasMore ? (
            <nav aria-label="翻页" className="mt-6 flex items-center justify-between">
              {query.page > 1 ? (
                <Link href={feedHref({ ...query, page: query.page - 1 })} className="btn">
                  上一页
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">第 {query.page} 页</span>
              {feed.hasMore ? (
                <Link href={feedHref({ ...query, page: query.page + 1 })} className="btn">
                  下一页
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="sr-only">发现</h1>
      <ComposeBar />
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
