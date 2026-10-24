"use client";

import { useRef, useState, type Ref, useImperativeHandle } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import { anchorToText, MAX_QUOTE_LENGTH } from "@/lib/anchor";
import { parseAnchorText } from "@/lib/anchor-text";
import { EMPTY_DOC, type ChipAttrs, type DocNode } from "@/lib/doc/schema";
import { chipLabel } from "@/lib/doc/text";
import { sourceTitle } from "@/lib/sources";
import type { Note, Source } from "@/lib/types";
import { NoteEditor, type NoteEditorHandle } from "../editor/NoteEditor";

export interface NoteFormHandle {
  /** Put a timestamp chip into the note (and adopt it as the note's position if none is set). */
  insertTime(seconds: number): void;
  focus(): void;
}

interface NoteFormProps {
  jarId: string;
  sources: Source[];
  /** New notes attach to this source by default. */
  defaultSourceId: string | null;
  /** Editing an existing note instead of writing a new one. */
  note?: Note;
  ref?: Ref<NoteFormHandle>;
  onSaved: (note: Note) => void;
  onCancel?: () => void;
  /** Chip clicked inside the editor. */
  onChipClick?: (attrs: ChipAttrs, sourceId: string | null) => void;
  /** Alt+T: the player's current time, if it can tell. */
  readTime?: () => number | null;
  /** Hint about how times work for the selected source. */
  timeHint?: string;
}

export function NoteForm({ ref, ...props }: NoteFormProps) {
  const { jarId, sources, note } = props;
  const editorRef = useRef<NoteEditorHandle>(null);
  const doc = useRef<DocNode>(note?.body ?? EMPTY_DOC);
  const [isEmpty, setIsEmpty] = useState(!note);

  const [sourceId, setSourceId] = useState<string | null>(note ? note.source_id : props.defaultSourceId);
  // a new note follows the player's current source, without losing the draft
  const [seenDefault, setSeenDefault] = useState(props.defaultSourceId);
  if (!note && seenDefault !== props.defaultSourceId) {
    setSeenDefault(props.defaultSourceId);
    setSourceId(props.defaultSourceId);
  }
  const [anchorText, setAnchorText] = useState(note?.anchor ? anchorToText(note.anchor) : "");
  const anchorTextRef = useRef(anchorText);
  const [quote, setQuote] = useState(note?.anchor?.quote ?? "");
  const [quoteOpen, setQuoteOpen] = useState(Boolean(note?.anchor?.quote));
  const [hidden, setHidden] = useState(note?.hide_on_publish ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeAnchor(text: string) {
    anchorTextRef.current = text;
    setAnchorText(text);
  }

  function adoptChip(attrs: ChipAttrs) {
    if (!anchorTextRef.current.trim()) changeAnchor(chipLabel(attrs));
  }

  useImperativeHandle(
    ref,
    () => ({
      insertTime: (seconds) => editorRef.current?.insertChip({ t: seconds }),
      focus: () => editorRef.current?.focus(),
    }),
    [],
  );

  function timeShortcut() {
    const t = props.readTime?.();
    if (t == null) setError(props.timeHint ?? "这个播放器读不到当前时间：请手动输入，如 @12:34。");
    else {
      setError(null);
      editorRef.current?.insertChip({ t });
    }
  }

  async function save() {
    if (saving) return;
    setError(null);

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
    if (isEmpty && !parsed) {
      setError("先写点什么，或者设一个位置。");
      return;
    }

    const input = {
      sourceId,
      anchor: parsed ? { ...parsed, ...(quoted ? { quote: quoted } : {}) } : null,
      body: doc.current,
      hideOnPublish: hidden,
    };
    setSaving(true);
    const result = note ? await updateNote(note.id, input) : await createNote(jarId, input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    props.onSaved(result.note);
    if (!note) {
      editorRef.current?.clear();
      doc.current = EMPTY_DOC;
      setIsEmpty(true);
      changeAnchor("");
      setQuote("");
      setQuoteOpen(false);
      setHidden(false);
    }
  }

  const quoteLength = Array.from(quote).length;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`src-${note?.id ?? "new"}`}>
          关联资源
        </label>
        <select
          id={`src-${note?.id ?? "new"}`}
          className="input !w-auto max-w-[14rem] !min-h-8 !py-1 text-sm"
          value={sourceId ?? ""}
          onChange={(e) => setSourceId(e.target.value || null)}
        >
          <option value="">未关联资源</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {sourceTitle(s)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`pos-${note?.id ?? "new"}`}>
          位置
        </label>
        <input
          id={`pos-${note?.id ?? "new"}`}
          className="input !w-44 !min-h-8 !py-1 text-sm"
          value={anchorText}
          onChange={(e) => changeAnchor(e.target.value)}
          onPaste={(e) => {
            // a pasted video link with ?t= becomes its timestamp
            const parsed = parseAnchorText(e.clipboardData.getData("text"));
            if (parsed) {
              e.preventDefault();
              changeAnchor(anchorToText(parsed));
            }
          }}
          placeholder="位置：12:34 · E5 12:34 · p.132"
          autoComplete="off"
        />
      </div>

      <NoteEditor
        ref={editorRef}
        initial={note?.body}
        autofocus={Boolean(note)}
        onChange={(next, empty) => {
          doc.current = next;
          setIsEmpty(empty);
        }}
        onChipAdded={adoptChip}
        onChipClick={(attrs) => props.onChipClick?.(attrs, sourceId)}
        onTimeShortcut={timeShortcut}
        onSubmit={save}
      />

      {quoteOpen ? (
        <div>
          <label className="block text-xs font-medium text-muted" htmlFor={`quote-${note?.id ?? "new"}`}>
            摘录（你自己摘的原文短句）
            <span className={`float-right tabular-nums ${quoteLength > MAX_QUOTE_LENGTH ? "text-danger" : ""}`}>
              {quoteLength}/{MAX_QUOTE_LENGTH}
            </span>
          </label>
          <textarea
            id={`quote-${note?.id ?? "new"}`}
            className="input mt-1 min-h-16 text-sm"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={2}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" className="text-xs text-muted underline underline-offset-2" onClick={() => setQuoteOpen((v) => !v)}>
          {quoteOpen ? "不要摘录" : "＋ 摘录"}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          发布时隐藏
        </label>
        <span className="ml-auto flex gap-2">
          {props.onCancel ? (
            <button type="button" className="btn btn-sm" onClick={props.onCancel} disabled={saving}>
              取消
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving} title="Cmd/Ctrl + Enter">
            {saving ? "保存中…" : note ? "保存修改" : "保存笔记"}
          </button>
        </span>
      </div>
      {props.timeHint && !note ? <p className="text-xs text-muted">{props.timeHint}</p> : null}
    </div>
  );
}
