import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { Pager } from "@/components/Pager";
import { PostList } from "@/components/PostList";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { parsePage } from "@/lib/feed";
import { getAuthorPosts } from "@/lib/posts";
import { getProfile } from "@/lib/tags";

export async function generateMetadata({ params }: PageProps<"/u/[id]">): Promise<Metadata> {
  const { id } = await params;
  const profile = isUuid(id) ? await getProfile(id).catch(() => null) : null;
  if (!profile) return { title: "未找到", robots: { index: false, follow: false } };
  return { title: profile.nickname, description: profile.bio || `${profile.nickname} 发布的内容` };
}

async function ProfilePage({ params, searchParams }: Pick<PageProps<"/u/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const page = parsePage((await searchParams).page);
  if (!isUuid(id)) notFound();
  const profile = await getProfile(id);
  if (!profile) notFound();

  const user = await getCurrentUser();
  const own = user?.id === profile.id;
  const posts = await getAuthorPosts(profile.id, page, own);

  return (
    <>
      <header className="flex items-center gap-4">
        <Avatar id={profile.id} name={profile.nickname} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{profile.nickname}</h1>
          {profile.bio ? <p className="mt-1 whitespace-pre-line break-words text-sm text-muted">{profile.bio}</p> : null}
        </div>
        {own ? (
          <span className="flex shrink-0 gap-2">
            <Link href="/favorites" className="btn">
              我的收藏
            </Link>
            <Link href="/settings" className="btn">
              编辑资料
            </Link>
          </span>
        ) : null}
      </header>

      <div className="mt-6">
        {posts.items.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="font-medium">{page > 1 ? "这一页没有内容了" : own ? "你还没有发布内容" : "还没有发布内容"}</p>
            {own && page === 1 ? (
              <Link href="/new/post" className="btn btn-primary mt-5">
                发布内容
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <PostList items={posts.items} />
            <Pager path={`/u/${profile.id}`} page={page} hasMore={posts.hasMore} />
          </>
        )}
      </div>
    </>
  );
}

export default function UserRoute(props: PageProps<"/u/[id]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-sunken" />}>
        <ProfilePage params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
