import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { Comments } from "@/components/Comments";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { LockIcon } from "@/components/icons";
import { LikeButton } from "@/components/LikeButton";
import { PlayerProvider } from "@/components/players/player-context";
import { PostBody } from "@/components/PostBody";
import { PostMenu } from "@/components/PostMenu";
import { TagChip } from "@/components/TagChip";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { firstChipTime } from "@/lib/doc/chips";
import { renderDocHtml } from "@/lib/doc/render";
import { sanitizeDocOrEmpty } from "@/lib/doc/schema";
import { excerptOf } from "@/lib/feed";
import { getComments, getPost, getPublicPost, getViewerState } from "@/lib/posts";
import { canSeek, PROVIDER_LABEL, sourceTitle } from "@/lib/sources";
import { formatTimestamp } from "@/lib/time";

const dateFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Shanghai" });

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = isUuid(id) ? await getPublicPost(id).catch(() => null) : null;
  // private posts and unknown ids get no preview (the page itself is still shown to the author)
  if (!post) return { title: "内容", robots: { index: false, follow: false } };

  const title = post.source ? sourceTitle(post.source) : excerptOf(post.plain_text, 40) || "内容";
  const description = excerptOf(post.plain_text, 140) || `${post.author.nickname} 发布的内容`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${id}` },
    openGraph: { title, description, type: "article", url: `/p/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * The post's title: the video's or page's own title, which is the first thing to know about a post that
 * is a video. Where the player (or the placeholder that stands in for it) already says it, or there is
 * no title, it is still there for screen readers and for the page outline.
 */
function PostHeading({ post }: { post: NonNullable<Awaited<ReturnType<typeof getPost>>> }) {
  const source = post.source;
  if (!source) return <h1 className="sr-only">{excerptOf(post.plain_text, 40) || "内容"}</h1>;

  const title = sourceTitle(source);
  // a player carries no title of its own; the placeholders (dead video, link, failed embed) do
  const shown = Boolean(source.meta?.title) && canSeek(source, post.source_status);
  if (!shown) return <h1 className="sr-only">{title}</h1>;

  const details = [PROVIDER_LABEL[source.provider], source.meta?.author, source.meta?.duration ? formatTimestamp(source.meta.duration) : null].filter(Boolean);
  return (
    <div className="mt-5">
      <h1 className="text-xl font-semibold leading-snug">{title}</h1>
      <p className="mt-1 text-xs text-muted">{details.join(" · ")}</p>
    </div>
  );
}

async function PostPage({ params }: Pick<PageProps<"/p/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const post = await getPost(id);
  if (!post) notFound();

  const user = await getCurrentUser();
  const seekable = canSeek(post.source, post.source_status);
  const [comments, state] = await Promise.all([getComments(id, seekable), getViewerState([id], user?.id ?? null)]);
  const isAuthor = user?.id === post.author.id;

  return (
    <PlayerProvider>
      <article>
        <header className="flex items-center gap-3">
          {/* the same link as the name beside it: only for the eye, not for screen readers or the Tab key */}
          <Link href={`/u/${post.author.id}`} aria-hidden="true" tabIndex={-1}>
            <Avatar id={post.author.id} name={post.author.nickname} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/u/${post.author.id}`} className="font-medium hover:underline">
              {post.author.nickname}
            </Link>
            <p className="text-xs text-muted">
              <time dateTime={post.created_at}>{dateFormat.format(new Date(post.created_at))}</time>
              {post.updated_at !== post.created_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000
                ? " · 已编辑"
                : ""}
            </p>
          </div>
          {post.visibility === "private" ? (
            <span className="chip" title="只有你自己能看到">
              <LockIcon className="size-3" />
              仅自己可见
            </span>
          ) : null}
          {isAuthor ? <PostMenu postId={post.id} /> : null}
        </header>

        <PostHeading post={post} />

        <div className="mt-5">
          <PostBody
            source={post.source}
            status={post.source_status}
            startAt={firstChipTime(sanitizeDocOrEmpty(post.body))}
            html={renderDocHtml(post.body, { seekable })}
          />
        </div>

        {post.tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-5 border-t border-line pt-4">
          <LikeButton postId={post.id} count={post.like_count} liked={state.liked.includes(post.id)} signedIn={Boolean(user)} />
          <FavoriteButton postId={post.id} favorited={state.favorited.includes(post.id)} signedIn={Boolean(user)} />
          <span className="ml-auto flex items-center gap-4">
            <CopyLinkButton />
            {isAuthor ? null : (
              <Link href={`/report?post=${post.id}`} className="tap inline-flex items-center text-sm text-muted transition-colors hover:text-danger">
                举报
              </Link>
            )}
          </span>
        </div>

        <Comments postId={post.id} postAuthorId={post.author.id} viewerId={user?.id ?? null} seekable={seekable} initial={comments} />
      </article>
    </PlayerProvider>
  );
}

export default function PostRoute(props: PageProps<"/p/[id]">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-sunken" />}>
        <PostPage params={props.params} />
      </Suspense>
    </main>
  );
}
