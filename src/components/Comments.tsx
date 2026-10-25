"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addComment, deleteComment } from "@/app/actions/comments";
import { attempt } from "@/lib/attempt";
import { EMPTY_DOC, type DocNode } from "@/lib/doc/schema";
import { docToPlainText } from "@/lib/doc/text";
import { MAX_COMMENT_LENGTH } from "@/lib/post-limits";
import type { CommentData } from "@/lib/types";
import { Avatar } from "./Avatar";
import type { NoteEditorHandle } from "./editor/NoteEditor";
import { usePlayer } from "./players/player-context";
import { RelativeTime } from "./RelativeTime";
import { RichHtml } from "./RichHtml";

// The editor is most of what a post's author needs and nothing a reader does: it is fetched when somebody starts writing.
const NoteEditor = dynamic(() => import("./editor/NoteEditor").then((module) => module.NoteEditor), {
  ssr: false,
  loading: () => <div className="h-[6.5rem] rounded-lg border border-line bg-surface" aria-hidden="true" />,
});

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" });

/**
 * The discussion under a post: comments, with one level of replies. Visitors
 * can read; writing needs an account. The post's author can remove any comment.
 */
export function Comments({
  postId,
  postAuthorId,
  viewerId,
  seekable,
  initial,
}: {
  postId: string;
  postAuthorId: string;
  viewerId: string | null;
  /** the post has a player that a time label can jump */
  seekable: boolean;
  initial: CommentData[];
}) {
  const { seek } = usePlayer();
  const [comments, setComments] = useState(initial);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  async function remove(comment: CommentData) {
    if (!confirm(comment.parent_id ? "删除这条回复？" : "删除这条评论？它下面的回复也会一起删除。")) return;
    setError(null);
    const result = await attempt(() => deleteComment(comment.id));
    if (!result.ok) return setError(result.error);
    setComments((prev) => prev.filter((c) => c.id !== comment.id && c.parent_id !== comment.id));
  }

  function renderComment(comment: CommentData) {
    const canDelete = viewerId !== null && (viewerId === comment.author.id || viewerId === postAuthorId);
    return (
      <li key={comment.id} className="flex gap-2.5">
        {/* the same link as the name beside it: only for the eye, not for screen readers or the Tab key */}
        <Link href={`/u/${comment.author.id}`} className="shrink-0" aria-hidden="true" tabIndex={-1}>
          <Avatar id={comment.author.id} name={comment.author.nickname} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <Link href={`/u/${comment.author.id}`} className="font-medium text-ink hover:underline">
              {comment.author.nickname}
            </Link>
            {comment.author.id === postAuthorId ? <span className="chip ml-1.5">作者</span> : null}
            <RelativeTime className="ml-2" iso={comment.created_at} title={timeFormat.format(new Date(comment.created_at))} />
          </p>
          <RichHtml html={comment.html} onChip={seek} className="comment-body mt-0.5" />
          <p className="mt-1 flex gap-3 text-xs text-muted">
            {comment.parent_id === null ? (
              <button type="button" className="tap hover:text-ink" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
                回复
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className="tap hover:text-danger" onClick={() => remove(comment)}>
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
                    seekable={seekable}
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
          seekable={seekable}
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
  seekable,
  placeholder,
  autoFocus = false,
  onAdded,
  onCancel,
}: {
  postId: string;
  parentId: string | null;
  viewerId: string | null;
  seekable: boolean;
  placeholder: string;
  autoFocus?: boolean;
  onAdded: (comment: CommentData) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const editor = useRef<NoteEditorHandle>(null);
  // the editor is only loaded once somebody wants to write: until then this is a box that looks like it
  const [open, setOpen] = useState(autoFocus);
  const [doc, setDoc] = useState<DocNode>(EMPTY_DOC);
  const [empty, setEmpty] = useState(true);
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

  const length = empty ? 0 : Array.from(docToPlainText(doc)).length;

  async function submit() {
    if (busy || empty) return;
    setBusy(true);
    setError(null);
    const result = await attempt(() => addComment({ postId, parentId, doc, seekable }));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    editor.current?.clear();
    onAdded(result.comment);
    router.refresh();
  }

  return (
    <div>
      {open ? (
        <NoteEditor
          ref={editor}
          variant="comment"
          autofocus
          label={placeholder}
          placeholder={placeholder}
          onChange={(next, isEmpty) => {
            setDoc(next);
            setEmpty(isEmpty);
          }}
          onSubmit={() => void submit()}
        />
      ) : (
        <button
          type="button"
          className="input block w-full text-left text-muted"
          onClick={() => setOpen(true)}
        >
          {placeholder}
        </button>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        {error ? (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        ) : (
          <span className={`text-xs tabular-nums ${length > MAX_COMMENT_LENGTH ? "text-danger" : "text-muted"}`}>
            {length}/{MAX_COMMENT_LENGTH}
          </span>
        )}
        <span className="ml-auto flex gap-2">
          {onCancel ? (
            <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
              取消
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy || empty} title="Cmd/Ctrl + Enter">
            {busy ? "发送中…" : "发送"}
          </button>
        </span>
      </div>
    </div>
  );
}
