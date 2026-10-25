/* eslint-disable @next/next/no-img-element -- video thumbnails come from third-party hosts that block hotlinking; pictures are already scaled down when they are uploaded */
import Link from "next/link";
import { IMAGE_ONLY_TEXT, mediaPath } from "@/lib/image";
import { PROVIDER_LABEL, sourceTitle } from "@/lib/sources";
import type { PostCardData } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CommentIcon, LockIcon, PlayIcon } from "./icons";
import { LikeButton } from "./LikeButton";
import { RelativeTime } from "./RelativeTime";
import { TagChip } from "./TagChip";

const dateTimeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" });

/**
 * One post in a feed: a thumbnail if it points at a video, a teaser of the
 * text, its tags and a footer with the author and the counters. The whole card
 * is a link to the post (a stretched link underneath); the author, the tags and
 * the heart sit above it and keep their own targets.
 */
export function PostCard({ post, liked, signedIn }: { post: PostCardData; liked: boolean; signedIn: boolean }) {
  const source = post.source;
  const thumbnail = source?.meta?.thumbnail;
  const title = source ? sourceTitle(source) : "";
  const dead = post.source_status === "dead";
  // a post that is only a picture has "[图片]" for its text: the picture says it better
  const excerpt = post.cover && post.excerpt === IMAGE_ONLY_TEXT ? "" : post.excerpt;

  return (
    <article className="card relative mb-3 break-inside-avoid overflow-hidden transition-colors hover:bg-sunken">
      <Link href={`/p/${post.id}`} className="absolute inset-0 z-10" aria-label={excerpt.replace(/\s+/g, " ") || title || (post.cover ? "查看图片" : "查看详情")} />

      {thumbnail ? (
        <div className="relative aspect-video bg-sunken">
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`size-full object-cover ${dead ? "opacity-40 grayscale" : ""}`}
          />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            <PlayIcon className="size-3" />
            {PROVIDER_LABEL[source!.provider]}
          </span>
          {dead ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">视频已失效</span>
          ) : null}
        </div>
      ) : post.cover ? (
        <div className="relative aspect-video bg-sunken">
          <img src={mediaPath(post.cover)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        </div>
      ) : null}

      <div className="space-y-2 p-3.5">
        {excerpt ? (
          <p className={`whitespace-pre-line break-words text-sm ${thumbnail || post.cover ? "line-clamp-3" : "line-clamp-6"}`}>{excerpt}</p>
        ) : null}
        {source && !thumbnail ? (
          <p className="truncate text-xs text-muted">
            {PROVIDER_LABEL[source.provider]} · {title}
          </p>
        ) : null}

        {post.tags.length > 0 || post.visibility === "private" ? (
          <div className="relative z-20 flex flex-wrap items-center gap-1.5">
            {post.visibility === "private" ? (
              <span className="chip" title="只有你自己能看到">
                <LockIcon className="size-3" />
                仅自己可见
              </span>
            ) : null}
            {post.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
            {post.tags.length > 3 ? <span className="text-xs text-muted">+{post.tags.length - 3}</span> : null}
          </div>
        ) : null}

        <div className="relative z-20 flex items-center gap-3 pt-1 text-xs text-muted">
          <Link href={`/u/${post.author.id}`} className="tap flex min-w-0 items-center gap-1.5 hover:text-ink">
            <Avatar id={post.author.id} name={post.author.nickname} size="sm" />
            <span className="truncate">{post.author.nickname}</span>
          </Link>
          <RelativeTime className="shrink-0" iso={post.created_at} title={dateTimeFormat.format(new Date(post.created_at))} />
          <span className="ml-auto flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1 tabular-nums" title="评论">
              <CommentIcon className="size-4" />
              {post.comment_count}
            </span>
            <LikeButton postId={post.id} count={post.like_count} liked={liked} signedIn={signedIn} />
          </span>
        </div>
      </div>
    </article>
  );
}
