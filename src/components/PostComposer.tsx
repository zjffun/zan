"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPost, updatePost } from "@/app/actions/posts";
import { anchorToText, MAX_QUOTE_LENGTH } from "@/lib/anchor";
import { parseAnchorText } from "@/lib/anchor-text";
import { EMPTY_DOC, type ChipAttrs, type DocNode } from "@/lib/doc/schema";
import { chipLabel } from "@/lib/doc/text";
import { MAX_POST_TAGS } from "@/lib/post-input";
import type { PostDetailData, Visibility } from "@/lib/types";
import { NoteEditor, type NoteEditorHandle } from "./editor/NoteEditor";
import { LinkAttach, type Attached } from "./LinkAttach";
import { SourcePlayer } from "./players/SourcePlayer";
import type { PlayerHandle } from "./players/types";
import { TagPicker, type TagPick } from "./TagPicker";
import { formatTimestamp } from "@/lib/time";

const TIME_HINT: Record<string, string> = {
  youtube: "Alt+T 或“记录当前时间”会把播放器的当前时间放进内容里。",
  bilibili: "B 站播放器读不到当前时间：手动输入 @12:34，或贴一个带 ?t= 的链接。",
};

/** Turns a saved post back into what the composer edits. */
function fromPost(post: PostDetailData): {
  attached: Attached | null;
  tags: TagPick[];
  anchorText: string;
  quote: string;
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
    anchorText: post.anchor ? anchorToText(post.anchor) : "",
    quote: post.anchor?.quote ?? "",
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
  const [anchorText, setAnchorText] = useState(initial?.anchorText ?? "");
  const anchorTextRef = useRef(anchorText);
  const [quote, setQuote] = useState(initial?.quote ?? "");
  const [moreOpen, setMoreOpen] = useState(Boolean(initial?.anchorText || initial?.quote));
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const provider = attached?.source.provider;
  const playable = provider === "youtube" || provider === "bilibili";

  function changeAnchor(text: string) {
    anchorTextRef.current = text;
    setAnchorText(text);
  }

  /** A time chip or a link with a start time becomes the post's position, unless one is already set. */
  function adopt(label: string) {
    if (!anchorTextRef.current.trim()) {
      changeAnchor(label);
      setMoreOpen(true);
    }
  }

  function recordTime() {
    const t = playerRef.current?.getCurrentTime();
    if (t == null) {
      setError(TIME_HINT[provider ?? ""] ?? "这个播放器读不到当前时间：请手动输入，如 @12:34。");
      return;
    }
    setError(null);
    editorRef.current?.insertChip({ t });
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

    const trimmed = anchorText.trim();
    const parsed = trimmed ? parseAnchorText(trimmed) : null;
    if (trimmed && !parsed) {
      setError("位置格式不对。可以写 12:34、12:34-12:40、E5 12:34、p.132、ch.3 或 41%。");
      return;
    }
    const quoted = quote.trim();
    if (quoted && !parsed) {
      setError("摘录需要一个位置，比如页码 p.132。");
      return;
    }
    if (quoted && Array.from(quoted).length > MAX_QUOTE_LENGTH) {
      setError(`摘录最多 ${MAX_QUOTE_LENGTH} 字：只记引用，不转载。`);
      return;
    }
    if (attached?.needsTitle && !attached.title.trim()) {
      setError("这个链接需要手动填一个标题。");
      return;
    }
    if (isEmpty && !attached && !parsed) {
      setError("先写点什么，或者贴一个链接。");
      return;
    }

    const input = {
      body: doc.current,
      anchor: parsed ? { ...parsed, ...(quoted ? { quote: quoted } : {}) } : null,
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
            <button type="button" className="btn btn-sm" onClick={recordTime}>
              记录当前时间
            </button>
            <span className="text-xs text-muted">{TIME_HINT[provider!]}</span>
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

      <div>
        <button type="button" className="text-xs text-muted underline underline-offset-2" onClick={() => setMoreOpen((v) => !v)}>
          {moreOpen ? "收起位置与摘录" : "＋ 位置与摘录"}
        </button>
        {moreOpen ? (
          <div className="mt-2 space-y-2 rounded-lg bg-sunken p-3">
            <div>
              <label className="block text-xs font-medium text-muted" htmlFor="anchor-text">
                位置（视频时间、集数、页码）
              </label>
              <input
                id="anchor-text"
                className="input mt-1 !w-56"
                value={anchorText}
                onChange={(event) => changeAnchor(event.target.value)}
                onPaste={(event) => {
                  // a pasted video link with ?t= becomes its timestamp
                  const parsed = parseAnchorText(event.clipboardData.getData("text"));
                  if (parsed) {
                    event.preventDefault();
                    changeAnchor(anchorToText(parsed));
                  }
                }}
                placeholder="12:34 · E5 12:34 · p.132"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted" htmlFor="anchor-quote">
                摘录（你自己摘的原文短句）
                <span
                  className={`float-right tabular-nums ${Array.from(quote).length > MAX_QUOTE_LENGTH ? "text-danger" : ""}`}
                >
                  {Array.from(quote).length}/{MAX_QUOTE_LENGTH}
                </span>
              </label>
              <textarea
                id="anchor-quote"
                className="input mt-1 min-h-16"
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                rows={2}
              />
            </div>
          </div>
        ) : null}
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
            {saving ? "发布中…" : uploading > 0 ? "图片上传中…" : post ? "保存修改" : "发布"}
          </button>
        </span>
      </div>
    </div>
  );
}
