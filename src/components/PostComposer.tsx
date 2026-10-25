"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPost, updatePost } from "@/app/actions/posts";
import { firstChipTime } from "@/lib/doc/chips";
import { withLegacyPositions } from "@/lib/doc/legacy-positions";
import { EMPTY_DOC, type ChipAttrs, type DocNode } from "@/lib/doc/schema";
import { MAX_POST_TAGS } from "@/lib/post-input";
import type { PostDetailData, Visibility } from "@/lib/types";
import { NoteEditor, type NoteEditorHandle } from "./editor/NoteEditor";
import { LinkAttach, type Attached } from "./LinkAttach";
import { SourcePlayer } from "./players/SourcePlayer";
import type { PlayerHandle } from "./players/types";
import { TagPicker, type TagPick } from "./TagPicker";
import { useResetOnHide } from "@/lib/use-reset-on-hide";

const YOUTUBE_HINT = "“记录当前时间”或按 Alt+T，会在光标处放一个可点击的时间标签。";

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
 * Write a post, or edit one: text (with clickable time labels), an optional
 * video or link, up to five tags, and who can see it.
 */
export function PostComposer({ post, presetTags = [] }: { post?: PostDetailData; presetTags?: TagPick[] }) {
  const router = useRouter();
  const initial = post ? fromPost(post) : null;

  const editorRef = useRef<NoteEditorHandle>(null);
  const playerRef = useRef<PlayerHandle>(null);
  // an older post kept its positions in a list of their own: they open as lines at the top of the text
  const [startDoc] = useState(() => (post ? withLegacyPositions(post.body, post.anchors) : undefined));
  const doc = useRef<DocNode>(startDoc ?? EMPTY_DOC);
  const [isEmpty, setIsEmpty] = useState(!post);

  const [attached, setAttached] = useState<Attached | null>(initial?.attached ?? null);
  const [tags, setTags] = useState<TagPick[]>(initial?.tags ?? presetTags);
  const [visibility, setVisibility] = useState<Visibility>(post?.visibility ?? "public");
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
    setStartAt(undefined);
  });

  const provider = attached?.source.provider;
  const playable = provider === "youtube" || provider === "bilibili";

  /** The button and Alt+T: a clickable label with the player's current time, at the cursor. */
  function recordTime() {
    const t = playerRef.current?.getCurrentTime();
    if (t == null) {
      setError("读不到播放器的当前时间，请手动输入，如 @12:34 加空格。");
      return;
    }
    setError(null);
    editorRef.current?.insertChip({ t });
  }

  function seek(attrs: ChipAttrs) {
    if (attrs.t !== undefined) playerRef.current?.seekTo(attrs.t);
  }

  function linkAttached(next: Attached) {
    setStartAt(next.startAt);
    // a link that starts at 1:30 leaves a label for it in the text (so the post's player starts there too),
    // unless the text already has a time of its own
    if (next.startAt && firstChipTime(doc.current) === undefined) editorRef.current?.insertChip({ t: next.startAt });
  }

  async function submit() {
    if (saving) return;
    setError(null);
    if (uploading > 0) {
      setError("图片还在上传，等一下再发布。");
      return;
    }

    if (isEmpty && !attached) {
      setError("先写点什么，或者贴一个链接。");
      return;
    }

    const input = {
      body: doc.current,
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
          {/* only YouTube's player can tell us the time; Bilibili's cannot, so there is nothing to click there */}
          {provider === "youtube" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-sm" onClick={recordTime}>
                记录当前时间
              </button>
              <span className="min-w-0 flex-1 text-xs text-muted">{YOUTUBE_HINT}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <NoteEditor
        ref={editorRef}
        initial={startDoc}
        placeholder="写点什么… 输入 @12:34 加空格，会变成可点击的时间标签"
        autofocus
        onChange={(next, empty) => {
          doc.current = next;
          setIsEmpty(empty);
        }}
        onChipClick={seek}
        onTimeShortcut={recordTime}
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
