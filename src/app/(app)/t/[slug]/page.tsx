import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { FollowButton } from "@/components/FollowButton";
import { Pager } from "@/components/Pager";
import { PostList } from "@/components/PostList";
import { getCurrentUser } from "@/lib/dal";
import { buildHref, parsePage } from "@/lib/feed";
import { getPublicFeed } from "@/lib/posts";
import { getTag, isFollowing } from "@/lib/tags";
import { TAG_KIND_LABEL } from "@/lib/types";
import { workLinks } from "@/lib/works/external";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug).catch(() => null);
  if (!tag) return { title: "未找到", robots: { index: false, follow: false } };
  const description = tag.description || `${tag.name}：${tag.post_count} 条内容，${tag.follower_count} 人关注。`;
  return {
    title: `#${tag.name}`,
    description,
    alternates: { canonical: `/t/${slug}` },
    openGraph: { title: `#${tag.name}`, description, type: "website", url: `/t/${slug}` },
  };
}

async function TagPage({ params, searchParams }: Pick<PageProps<"/t/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const page = parsePage((await searchParams).page);
  const tag = await getTag(slug);
  if (!tag) notFound();

  const user = await getCurrentUser();
  const [following, feed] = await Promise.all([
    user ? isFollowing(user.id, tag.id) : Promise.resolve(false),
    getPublicFeed({ tagId: tag.id, page }),
  ]);
  const links = workLinks(tag);

  return (
    <>
      <header className="flex items-start gap-4">
        <Cover src={tag.cover_url} kind={tag.kind} label={tag.kind ? undefined : Array.from(tag.name)[0]} className="h-28 w-20" />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">#{tag.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {tag.kind ? <span className="chip">{TAG_KIND_LABEL[tag.kind]}</span> : null}
            <span>{tag.post_count} 条内容</span>
            <span>·</span>
            <span>{tag.follower_count} 人关注</span>
            {links.map((link) => (
              <a key={link.url} className="underline underline-offset-2" href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                {link.label}
              </a>
            ))}
          </p>
          {tag.description ? <p className="mt-2 whitespace-pre-line break-words text-sm">{tag.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FollowButton tagId={tag.id} following={following} signedIn={Boolean(user)} />
            <Link href={`/new/post?tag=${tag.slug}`} className="btn">
              在这个标签下发布
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6">
        {feed.items.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="font-medium">{page > 1 ? "这一页没有内容了" : "这个标签下还没有内容"}</p>
            <p className="mt-1 text-sm text-muted">{page > 1 ? "回到第一页看看。" : "发布第一条吧。"}</p>
            <Link
              href={page > 1 ? buildHref(`/t/${tag.slug}`, {}) : `/new/post?tag=${tag.slug}`}
              className="btn btn-primary mt-5"
            >
              {page > 1 ? "回到第一页" : "发布内容"}
            </Link>
          </div>
        ) : (
          <>
            <PostList items={feed.items} />
            <Pager path={`/t/${tag.slug}`} page={page} hasMore={feed.hasMore} />
          </>
        )}
      </div>
    </>
  );
}

export default function TagRoute(props: PageProps<"/t/[slug]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-sunken" />}>
        <TagPage params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
