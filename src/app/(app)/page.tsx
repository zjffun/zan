import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PlusIcon } from "@/components/icons";
import { PostList } from "@/components/PostList";
import { Pager } from "@/components/Pager";
import { getCurrentUser } from "@/lib/dal";
import { buildHref, parseFeedTab, parsePage } from "@/lib/feed";
import { getFollowingFeed, getPublicFeed, type PostPage } from "@/lib/posts";
import { getFollowedTagIds, getHotTags } from "@/lib/tags";
import { TAG_KIND_LABEL } from "@/lib/types";

/** The way in to writing: always on top, for visitors too (they are asked to sign in first). */
function ComposeBar() {
  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <Link href="/new/post" className="flex min-w-0 flex-1 items-center gap-3 text-muted hover:text-ink">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <PlusIcon className="size-4" />
        </span>
        <span className="truncate text-sm">写点什么，或贴一个视频链接……</span>
      </Link>
      <Link href="/new/post" className="btn btn-primary btn-sm shrink-0">
        发布
      </Link>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden>
      <div className="mt-5 h-8 w-64 animate-pulse rounded-lg bg-sunken" />
      <div className="mt-4 columns-1 gap-3 sm:columns-2 lg:columns-3">
        {[40, 56, 32, 48, 36, 52].map((height, i) => (
          <div key={i} className="mb-3 animate-pulse break-inside-avoid rounded-xl bg-sunken" style={{ height: `${height * 4}px` }} />
        ))}
      </div>
    </div>
  );
}

function Empty({ title, hint, href, action }: { title: string; hint: string; href: string; action: string }) {
  return (
    <div className="card mt-4 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <Link href={href} className="btn btn-primary mt-5">
        {action}
      </Link>
    </div>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const tab = parseFeedTab(params.tab);
  const page = parsePage(params.page);
  const user = await getCurrentUser();
  if (tab === "following" && !user) redirect(`/login?next=${encodeURIComponent("/?tab=following")}`);

  let feed: PostPage | null = null;
  let followsNothing = false;
  try {
    if (tab === "following" && user) {
      const ids = await getFollowedTagIds(user.id);
      followsNothing = ids.length === 0;
      feed = await getFollowingFeed(ids, page);
    } else {
      feed = await getPublicFeed({ tagId: null, page });
    }
  } catch {
    // database unreachable: say so instead of failing the whole page
  }
  const hotTags = await getHotTags().catch(() => []);

  const tabs = [
    { id: "latest", label: "最新", href: "/" },
    { id: "following", label: "关注", href: buildHref("/", { tab: "following" }) },
  ] as const;

  return (
    <>
      <div className="mt-5 flex items-center gap-1 border-b border-line">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.id === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${item.id === tab ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "latest" && hotTags.length > 0 ? (
        <div className="-mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
          <span className="shrink-0 text-xs text-muted">热门标签</span>
          {hotTags.map((tag) => (
            <Link key={tag.id} href={`/t/${tag.slug}`} className="chip shrink-0 hover:!bg-accent-soft hover:!text-accent">
              #{tag.name}
              {tag.kind ? <span>· {TAG_KIND_LABEL[tag.kind]}</span> : null}
            </Link>
          ))}
          <Link href="/tags" className="tap inline-flex shrink-0 items-center text-xs text-accent underline-offset-2 hover:underline">
            全部标签 →
          </Link>
        </div>
      ) : null}

      <div className="mt-4">
        {!feed ? (
          <p role="alert" className="card px-6 py-12 text-center text-sm text-muted">
            内容暂时无法加载，请稍后刷新重试。
          </p>
        ) : feed.items.length === 0 ? (
          tab === "following" && followsNothing ? (
            <Empty title="还没有关注的标签" hint="关注感兴趣的标签，它们下面的新内容会出现在这里。" href="/tags" action="去看看标签" />
          ) : tab === "following" ? (
            <Empty title="你关注的标签下还没有内容" hint="发布一条，让它热闹起来。" href="/new/post" action="发布内容" />
          ) : page > 1 ? (
            <Empty title="这一页没有内容了" hint="回到第一页看看。" href={buildHref("/", { tab })} action="回到第一页" />
          ) : (
            <Empty title="这里还没有内容" hint="发布第一条，它就会出现在这里。" href="/new/post" action="发布内容" />
          )
        ) : (
          <>
            <PostList items={feed.items} />
            <Pager path="/" page={page} hasMore={feed.hasMore} params={{ tab }} />
          </>
        )}
      </div>
    </>
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <h1 className="sr-only">发现</h1>
      <ComposeBar />
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
