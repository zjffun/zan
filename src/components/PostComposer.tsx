"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPost, updatePost } from "@/app/actions/posts";
import { EMPTY_DOC, type ChipAttrs, type DocNode } from "@/lib/doc/schema";
import { chipLabel } from "@/lib/doc/text";
import { MAX_POST_TAGS } from "@/lib/post-input";
import { newRowId, rowsFromAnchors, rowsToAnchors, type PositionRow } from "@/lib/position-rows";
import type { PostDetailData, Visibility } from "@/lib/types";
import { NoteEditor, type NoteEditorHandle } from "./editor/NoteEditor";
import { LinkAttach, type Attached } from "./LinkAttach";
import { PositionsEditor } from "./PositionsEditor";
import { SourcePlayer } from "./players/SourcePlayer";
import type { PlayerHandle } from "./players/types";
import { TagPicker, type TagPick } from "./TagPicker";
import { formatTimestamp } from "@/lib/time";
import { useResetOnHide } from "@/lib/use-reset-on-hide";

const TIME_HINT: Record<string, string> = {
  youtube: "“记录当前时间”会按播放器的当前时间加一个位置，可以接着写描述；写内容时按 Alt+T，会在光标处放一个可点击的时间标签。",
  bilibili: "B 站播放器读不到当前时间：在下面的“位置”里手动输入 12:34，或贴一个带 ?t= 的链接；写内容时输入 @12:34 加空格，会变成可点击的时间标签。",
};

/** Turns a saved post back into what the composer edits. */
function fromPost(post: PostDetailData): {
  attached: Attached | null;
  tags: TagPick[];
} {
  return {
    attached: post.source
      ? {
          source: { provider: post.source.provider, ref: post.source.ref, meta: post.source.meta },
          title: post.source.meta?.title ?? "",
          needsTitle: false,
          warnings: [],
        }
      : null,
    tags: post.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  };
}

/**
 * Write a post, or edit one: text (with clickable time/page labels), an optional
 * video or link, up to five tags, and who can see it.
 */
export function PostComposer({ post, presetTags = [] }: { post?: PostDetailData; presetTags?: TagPick[] }) {
  const router = useRouter();
  const initial = post ? fromPost(post) : null;

  const editorRef = useRef<NoteEditorHandle>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const doc = useRef<DocNode>((post?.body as DocNode | undefined) ?? EMPTY_DOC);
  const [isEmpty, setIsEmpty] = useState(!post);

  const [attached, setAttached] = useState<Attached | null>(initial?.attached ?? null);
  const [tags, setTags] = useState<TagPick[]>(initial?.tags ?? presetTags);
  const [visibility, setVisibility] = useState<Visibility>(post?.visibility ?? "public");
  const [rows, setRows] = useState<PositionRow[]>(() => (post ? rowsFromAnchors(post.anchors) : []));
  const rowsRef = useRef(rows); // the latest list, for callbacks that fire in quick succession
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // The page stays alive (hidden) after navigating away. Once the post is saved, put the form back to
  // how it should look the next time it is opened: not stuck on "saving", and, for a new post, empty.
  const resetWhenLeft = useResetOnHide(() => {
    setSaving(false);
    setError(null);
    if (post) return; // an edited post keeps what was just saved
    editorRef.current?.clear();
    doc.current = EMPTY_DOC;
    setIsEmpty(true);
    setAttached(null);
    setTags(presetTags);
    setVisibility("public");
    changeRows([]);
    setStartAt(undefined);
  });

  const provider = attached?.source.provider;
  const playable = provider === "youtube" || provider === "bilibili";

  function changeRows(next: PositionRow[]) {
    rowsRef.current = next;
    setRows(next);
  }

  /** A time label in the text or a link with a start time becomes the post's first position, unless it has one already. */
  function adopt(label: string) {
    if (rowsRef.current.length === 0) changeRows([{ id: newRowId(), position: label, note: "" }]);
  }

  /** The player's current time, or null (with the reason shown) when it cannot be read. */
  function currentTime(): number | null {
    const t = playerRef.current?.getCurrentTime();
    if (t == null) {
      setError(TIME_HINT[provider ?? ""] ?? "这个播放器读不到当前时间：请手动输入，如 12:34。");
      return null;
    }
    setError(null);
    return t;
  }

  /** "Record current time": a new position at the player's time, with the cursor in its description. */
  function recordPosition() {
    const t = currentTime();
    if (t === null) return;
    changeRows([...rowsRef.current, { id: newRowId(), position: formatTimestamp(Math.floor(t)), note: "", focus: "note" }]);
  }

  /** Alt+T while writing: a clickable time label at the cursor. */
  function recordChip() {
    const t = currentTime();
    if (t !== null) editorRef.current?.insertChip({ t });
  }

  function seek(attrs: ChipAttrs) {
    if (attrs.t !== undefined) playerRef.current?.seekTo(attrs.t);
  }

  function linkAttached(next: Attached) {
    if (next.startAt) {
      setStartAt(next.startAt);
      adopt(formatTimestamp(next.startAt));
    } else {
      setStartAt(undefined);
    }
  }

  async function submit() {
    if (saving) return;
    setError(null);
    if (uploading > 0) {
      setError("图片还在上传，等一下再发布。");
      return;
    }

    const positions = rowsToAnchors(rows);
    if (!positions.ok) {
      setError(positions.error);
      return;
    }
    const anchors = positions.anchors;
    if (isEmpty && !attached && anchors.length === 0) {
      setError("先写点什么，或者贴一个链接。");
      return;
    }

    const input = {
      body: doc.current,
      anchors,
      source: attached
        ? {
            provider: attached.source.provider,
            ref: attached.source.ref,
            meta: { ...(attached.source.meta ?? {}), ...(attached.title.trim() ? { title: attached.title.trim() } : {}) },
          }
        : null,
      visibility,
      tagIds: tags.flatMap((tag) => (tag.id ? [tag.id] : [])),
      newTags: tags.flatMap((tag) => (tag.id ? [] : [tag.name])),
    };

    setSaving(true);
    const result = post ? await updatePost(post.id, input) : await createPost(input);
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }
    resetWhenLeft();
    router.push(`/p/${result.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {attached && playable ? (
        <div className="space-y-2">
          <SourcePlayer
            key={`${attached.source.provider}:${JSON.stringify(attached.source.ref)}:${startAt ?? 0}`}
            source={{ ...attached.source, meta: attached.source.meta ?? null, status: "ok" }}
            startAt={startAt}
            handleRef={playerRef}
          />
          <div className="flex flex-wrap items-center gap-2">
            {/* only YouTube's player can tell us the time; Bilibili's cannot, so there is nothing to click there */}
            {provider === "youtube" ? (
              <button type="button" className="btn btn-sm" onClick={recordPosition}>
                记录当前时间
              </button>
            ) : null}
            <span className="min-w-0 flex-1 text-xs text-muted">{TIME_HINT[provider!]}</span>
          </div>
        </div>
      ) : null}

      <NoteEditor
        ref={editorRef}
        initial={post?.body as DocNode | undefined}
        placeholder="写点什么… 输入 @12:34 或 p.132 加空格，会变成可点击的位置标签"
        autofocus
        onChange={(next, empty) => {
          doc.current = next;
          setIsEmpty(empty);
        }}
        onChipAdded={(attrs) => adopt(chipLabel(attrs))}
        onChipClick={seek}
        onTimeShortcut={recordChip}
        onSubmit={submit}
        onUploadingChange={setUploading}
      />

      <LinkAttach value={attached} onChange={setAttached} onAttached={linkAttached} />

      <div>
        <p className="mb-1 text-xs font-medium text-muted">
          标签 <span className="font-normal">（最多 {MAX_POST_TAGS} 个，选已有的或新建）</span>
        </p>
        <TagPicker value={tags} onChange={setTags} />
      </div>

      <PositionsEditor rows={rows} onChange={changeRows} />

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm">
          谁能看到
          <select
            className="input !w-auto"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            <option value="public">所有人</option>
            <option value="private">仅自己可见</option>
          </select>
        </label>
        <span className="ml-auto flex gap-2">
          <button type="button" className="btn" onClick={() => router.back()} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving || uploading > 0} title="Cmd/Ctrl + Enter">
            {saving ? (post ? "保存中…" : "发布中…") : uploading > 0 ? "图片上传中…" : post ? "保存修改" : "发布"}
          </button>
        </span>
      </div>
    </div>
  );
}
