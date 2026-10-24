import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pager } from "@/components/Pager";
import { PostList } from "@/components/PostList";
import { requireUser } from "@/lib/dal";
import { parsePage } from "@/lib/feed";
import { getFavoritePosts } from "@/lib/posts";

export const metadata: Metadata = { title: "我的收藏", robots: { index: false, follow: false } };

async function Favorites({ searchParams }: Pick<PageProps<"/favorites">, "searchParams">) {
  const page = parsePage((await searchParams).page);
  const user = await requireUser("/favorites");
  const favorites = await getFavoritePosts(user.id, page);

  if (favorites.items.length === 0) {
    return (
      <div className="card mt-6 px-6 py-12 text-center">
        <p className="font-medium">{page > 1 ? "这一页没有内容了" : "还没有收藏"}</p>
        <p className="mt-1 text-sm text-muted">看到喜欢的内容，点“收藏”就会出现在这里。</p>
        <Link href={page > 1 ? "/favorites" : "/"} className="btn btn-primary mt-5">
          {page > 1 ? "回到第一页" : "去逛逛"}
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <PostList items={favorites.items} />
      <Pager path="/favorites" page={page} hasMore={favorites.hasMore} />
    </div>
  );
}

export default function FavoritesPage(props: PageProps<"/favorites">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">我的收藏</h1>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-xl bg-sunken" />}>
        <Favorites searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
