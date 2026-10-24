"use client";

import { useMemo } from "react";
import { anchorLabel } from "@/lib/anchor";
import { renderDocHtml } from "@/lib/doc/render";
import type { ChipAttrs } from "@/lib/doc/schema";
import { sourceTitle } from "@/lib/sources";
import type { Note, Source } from "@/lib/types";
import { RichHtml } from "../RichHtml";

export function NoteCard({
  note,
  source,
  showSource,
  onSeek,
  onEdit,
  onDelete,
  onToggleHidden,
}: {
  note: Note;
  source: Source | null;
  showSource: boolean;
  onSeek: (attrs: ChipAttrs, sourceId: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
}) {
  const html = useMemo(() => renderDocHtml(note.body), [note.body]);
  const anchor = note.anchor;
  const seekable = anchor?.t !== undefined;

  return (
    <article className="card p-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {anchor ? (
          seekable ? (
            <button
              type="button"
              className="anchor-chip !m-0"
              title="跳到这里"
              onClick={() => onSeek({ t: anchor.t, ep: anchor.ep }, note.source_id)}
            >
              {anchorLabel(anchor)}
            </button>
          ) : (
            <span className="anchor-chip !m-0 !cursor-default">{anchorLabel(anchor)}</span>
          )
        ) : null}
        {showSource && source ? <span className="chip max-w-[16rem] truncate">{sourceTitle(source)}</span> : null}
        {showSource && !source ? <span className="chip">未关联资源</span> : null}
        {note.hide_on_publish ? <span className="chip" title="发布快照时不会包含这条笔记">🔒 发布时隐藏</span> : null}
      </div>

      {anchor?.quote ? (
        <blockquote className="mb-2 border-l-[3px] border-line pl-3 text-sm italic text-muted">{anchor.quote}</blockquote>
      ) : null}

      <RichHtml html={html} onChip={(attrs) => onSeek(attrs, note.source_id)} />

      <div className="mt-2 flex gap-3 text-xs text-muted">
        <button type="button" className="underline-offset-2 hover:underline" onClick={onEdit}>
          编辑
        </button>
        <button type="button" className="underline-offset-2 hover:underline" onClick={onToggleHidden}>
          {note.hide_on_publish ? "发布时显示" : "发布时隐藏"}
        </button>
        <button type="button" className="underline-offset-2 hover:underline hover:text-danger" onClick={onDelete}>
          删除
        </button>
      </div>
    </article>
  );
}
