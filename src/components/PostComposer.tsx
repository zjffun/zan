"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPost, updatePost } from "@/app/actions/posts";
import { attempt } from "@/lib/attempt";
import { firstChipTime } from "@/lib/doc/chips";
import { browserStorage, clearDraft, draftKey, hasContent, readDraft, writeDraft, type Draft } from "@/lib/draft";
import { EMPTY_DOC, sanitizeDocOrEmpty, type ChipAttrs, type DocNode } from "@/lib/doc/schema";
import { MAX_POST_TAGS } from "@/lib/post-input";
import type { PostDetailData, Visibility } from "@/lib/types";
import { NoteEditor, type NoteEditorHandle } from "./editor/NoteEditor";
import { LinkAttach, type Attached } from "./LinkAttach";
import { RelativeTime } from "./RelativeTime";
import { Select } from "./Select";
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

/** What a saved draft says about the attached link, as the form holds it. */
function attachedFromDraft(draft: Draft): Attached | null {
  if (!draft.source) return null;
  return { source: { ...draft.source, meta: draft.source.meta ?? null } as Attached["source"], title: draft.title, needsTitle: false, warnings: [] };
}

interface ComposerProps {
  post?: PostDetailData;
  presetTags?: TagPick[];
}

const alwaysTrue = () => true;
const never = () => () => undefined;

/**
 * Write a post, or edit one: text (with clickable time labels), an optional
 * video or link, up to five tags, and who can see it. What is written is kept in this browser
 * while it is written, so that closing the tab does not lose it.
 */
export function PostComposer(props: ComposerProps) {
  // The server cannot know what is in this browser's storage, so it renders an empty form; once the page is
  // in the browser the form is swapped (once, before anything has been typed) for one that starts from the draft.
  const inBrowser = useSyncExternalStore(never, alwaysTrue, () => false);
  return inBrowser ? <WithDraft {...props} /> : <ComposerForm {...props} draft={null} onDiscard={() => undefined} />;
}

function WithDraft(props: ComposerProps) {
  const key = draftKey(props.post?.id);
  const [state, setState] = useState(() => {
    const draft = readDraft(browserStorage(), key);
    // a draft of an edit counts only when it is newer than what is saved
    const newer = draft && (!props.post || draft.savedAt > Date.parse(props.post.updated_at));
    return { draft: newer ? draft : null, epoch: 0 };
  });
  return (
    <ComposerForm
      key={state.epoch}
      {...props}
      draft={state.draft}
      onDiscard={() => {
        clearDraft(browserStorage(), key);
        setState((previous) => ({ draft: null, epoch: previous.epoch + 1 }));
      }}
    />
  );
}

function ComposerForm({ post, presetTags = [], draft, onDiscard }: ComposerProps & { draft: Draft | null; onDiscard: () => void }) {
  const router = useRouter();
  const initial = post ? fromPost(post) : null;
  const key = draftKey(post?.id);

  const editorRef = useRef<NoteEditorHandle>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const [startDoc] = useState(() => (draft ? draft.body : post ? sanitizeDocOrEmpty(post.body) : undefined));
  const doc = useRef<DocNode>(startDoc ?? EMPTY_DOC);
  const [isEmpty, setIsEmpty] = useState(draft ? !hasContent({ body: draft.body, source: null }) : !post);

  const [attached, setAttachedState] = useState<Attached | null>(draft ? attachedFromDraft(draft) : (initial?.attached ?? null));
  const [tags, setTagsState] = useState<TagPick[]>(draft ? draft.tags : (initial?.tags ?? presetTags));
  const [visibility, setVisibilityState] = useState<Visibility>(draft?.visibility ?? post?.visibility ?? "public");
  const [restored, setRestored] = useState(draft !== null);

  // Draft: saved a moment after the last change, and when the page is hidden (a phone may not give the
  // timer the chance). `touched`: only what the person changed is saved, not the form as it was opened.
  const touched = useRef(false);
  const finished = useRef(false);
  const [revision, setRevision] = useState(0);
  const touch = () => {
    touched.current = true;
    setRevision((n) => n + 1);
  };
  const setAttached = (next: Attached | null) => {
    setAttachedState(next);
    touch();
  };
  const setTags = (next: TagPick[]) => {
    setTagsState(next);
    touch();
  };
  const setVisibility = (next: Visibility) => {
    setVisibilityState(next);
    touch();
  };
  useEffect(() => {
    if (!touched.current) return;
    const save = () => {
      if (finished.current) return;
      writeDraft(browserStorage(), key, {
        body: doc.current,
        source: attached ? ({ provider: attached.source.provider, ref: attached.source.ref, meta: attached.source.meta ?? null } as Draft["source"]) : null,
        title: attached?.title ?? "",
        tags,
        visibility,
      });
    };
    const timer = setTimeout(save, 800);
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", save);
    };
  }, [revision, attached, tags, visibility, key]);
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // The page stays alive (hidden) after navigating away. Once the post is saved, put the form back to
  // how it should look the next time it is opened: not stuck on "saving", and, for a new post, empty.
  const resetWhenLeft = useResetOnHide(() => {
    setSaving(false);
    setError(null);
    setRestored(false);
    finished.current = false;
    touched.current = false;
    if (post) return; // an edited post keeps what was just saved
    editorRef.current?.clear();
    doc.current = EMPTY_DOC;
    setIsEmpty(true);
    setAttachedState(null);
    setTagsState(presetTags);
    setVisibilityState("public");
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
    const result = await attempt(() => (post ? updatePost(post.id, input) : createPost(input)));
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }
    finished.current = true; // nothing after this is a draft
    clearDraft(browserStorage(), key);
    resetWhenLeft();
    router.push(`/p/${result.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {restored && draft ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          <span>
            已恢复上次没发布的草稿（<RelativeTime iso={new Date(draft.savedAt).toISOString()} />）。
          </span>
          <button type="button" className="tap underline underline-offset-2" onClick={onDiscard}>
            放弃草稿
          </button>
        </p>
      ) : null}

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
          touch();
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
          <Select className="!inline-block" name="visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}>
            <option value="public">所有人</option>
            <option value="private">仅自己可见</option>
          </Select>
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
