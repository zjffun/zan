"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addComment, deleteComment } from "@/app/actions/comments";
import { MAX_COMMENT_LENGTH } from "@/lib/post-input";
import type { CommentData } from "@/lib/types";
import { Avatar } from "./Avatar";

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" });

/**
 * The discussion under a post: comments, with one level of replies. Visitors
 * can read; writing needs an account. The post's author can remove any comment.
 */
export function Comments({
  postId,
  postAuthorId,
  viewerId,
  initial,
}: {
  postId: string;
  postAuthorId: string;
  viewerId: string | null;
  initial: CommentData[];
}) {
  const [comments, setComments] = useState(initial);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  async function remove(comment: CommentData) {
    if (!confirm(comment.parent_id ? "删除这条回复？" : "删除这条评论？它下面的回复也会一起删除。")) return;
    setError(null);
    const result = await deleteComment(comment.id);
    if (!result.ok) return setError(result.error);
    setComments((prev) => prev.filter((c) => c.id !== comment.id && c.parent_id !== comment.id));
  }

  function renderComment(comment: CommentData) {
    const canDelete = viewerId !== null && (viewerId === comment.author.id || viewerId === postAuthorId);
    return (
      <li key={comment.id} className="flex gap-2.5">
        <Link href={`/u/${comment.author.id}`} className="shrink-0">
          <Avatar id={comment.author.id} name={comment.author.nickname} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <Link href={`/u/${comment.author.id}`} className="font-medium text-ink hover:underline">
              {comment.author.nickname}
            </Link>
            {comment.author.id === postAuthorId ? <span className="chip ml-1.5">作者</span> : null}
            <time className="ml-2" dateTime={comment.created_at}>
              {timeFormat.format(new Date(comment.created_at))}
            </time>
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words text-sm">{comment.body}</p>
          <p className="mt-1 flex gap-3 text-xs text-muted">
            {comment.parent_id === null ? (
              <button type="button" className="hover:text-ink" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
                回复
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className="hover:text-danger" onClick={() => remove(comment)}>
                删除
              </button>
            ) : null}
          </p>
          {comment.parent_id === null ? (
            <>
              {repliesOf(comment.id).length > 0 ? (
                <ul className="mt-3 space-y-3 border-l-2 border-line pl-3">{repliesOf(comment.id).map(renderComment)}</ul>
              ) : null}
              {replyTo === comment.id ? (
                <div className="mt-2">
                  <CommentForm
                    postId={postId}
                    parentId={comment.id}
                    viewerId={viewerId}
                    autoFocus
                    placeholder={`回复 ${comment.author.nickname}`}
                    onAdded={(added) => {
                      setComments((prev) => [...prev, added]);
                      setReplyTo(null);
                    }}
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <section aria-label="评论" className="mt-8 border-t border-line pt-6">
      <h2 className="font-semibold">
        评论 <span className="text-sm font-normal text-muted">{comments.length}</span>
      </h2>
      <div className="mt-3">
        <CommentForm
          postId={postId}
          parentId={null}
          viewerId={viewerId}
          placeholder="说点什么…"
          onAdded={(added) => {
            setComments((prev) => [...prev, added]);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {topLevel.length > 0 ? (
        <ul className="mt-5 space-y-5">{topLevel.map(renderComment)}</ul>
      ) : (
        <p className="mt-5 text-center text-sm text-muted">还没有评论，来说第一句。</p>
      )}
    </section>
  );
}

function CommentForm({
  postId,
  parentId,
  viewerId,
  placeholder,
  autoFocus = false,
  onAdded,
  onCancel,
}: {
  postId: string;
  parentId: string | null;
  viewerId: string | null;
  placeholder: string;
  autoFocus?: boolean;
  onAdded: (comment: CommentData) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!viewerId) {
    return (
      <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
        <Link href={`/login?next=${encodeURIComponent(`/p/${postId}`)}`} className="text-accent underline underline-offset-2">
          登录
        </Link>{" "}
        后参与讨论。
      </p>
    );
  }

  async function submit() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    const result = await addComment({ postId, parentId, body: text });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setText("");
    onAdded(result.comment);
    router.refresh();
  }

  return (
    <div>
      <textarea
        className="input min-h-16"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        autoFocus={autoFocus}
      />
      <div className="mt-1.5 flex items-center gap-2">
        {error ? (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        ) : (
          <span className={`text-xs tabular-nums ${Array.from(text).length > MAX_COMMENT_LENGTH ? "text-danger" : "text-muted"}`}>
            {Array.from(text).length}/{MAX_COMMENT_LENGTH}
          </span>
        )}
        <span className="ml-auto flex gap-2">
          {onCancel ? (
            <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
              取消
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !text.trim()} title="Cmd/Ctrl + Enter">
            {busy ? "发送中…" : "发送"}
          </button>
        </span>
      </div>
    </div>
  );
}
