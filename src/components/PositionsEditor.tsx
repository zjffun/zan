"use client";

import { anchorToText, MAX_NOTE_LENGTH, MAX_POSITIONS } from "@/lib/anchor";
import { parseAnchorText } from "@/lib/anchor-text";
import { newRowId, type PositionRow } from "@/lib/position-rows";

/**
 * The positions a post points at (a video time, an episode, a page), each with a short description of
 * its own. Rows are plain text here; the composer checks them when the post is published.
 */
export function PositionsEditor({ rows, onChange }: { rows: PositionRow[]; onChange: (rows: PositionRow[]) => void }) {
  const update = (id: number, patch: Partial<PositionRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, focus: undefined, ...patch } : row)));

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">
        位置与描述 <span className="font-normal">（可选：视频时间、集数、页码，可以加多个，每个写一句你自己的话）</span>
      </p>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const length = Array.from(row.note).length;
            return (
              <li key={row.id} className="flex flex-col gap-2 rounded-lg bg-sunken p-3 sm:flex-row sm:items-start">
                <input
                  className="input sm:!w-44 sm:shrink-0"
                  value={row.position}
                  onChange={(event) => update(row.id, { position: event.target.value })}
                  onPaste={(event) => {
                    // a pasted video link with ?t= becomes its timestamp
                    const parsed = parseAnchorText(event.clipboardData.getData("text"));
                    if (parsed) {
                      event.preventDefault();
                      update(row.id, { position: anchorToText(parsed) });
                    }
                  }}
                  placeholder="12:34 · E5 12:34 · p.132"
                  aria-label={`位置 ${index + 1}`}
                  autoComplete="off"
                  autoFocus={row.focus === "position"} // the row was just added by a click: the cursor belongs in it
                />
                <div className="min-w-0 flex-1">
                  <textarea
                    className="input min-h-10"
                    value={row.note}
                    onChange={(event) => update(row.id, { note: event.target.value })}
                    rows={2}
                    placeholder="描述（可选）：这里讲了什么，你想说什么"
                    aria-label={`位置 ${index + 1} 的描述`}
                    autoFocus={row.focus === "note"}
                  />
                  {length > MAX_NOTE_LENGTH - 40 ? (
                    <p className={`mt-0.5 text-right text-xs tabular-nums ${length > MAX_NOTE_LENGTH ? "text-danger" : "text-muted"}`}>
                      {length}/{MAX_NOTE_LENGTH}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm self-end sm:self-start"
                  aria-label={`删除位置 ${index + 1}`}
                  onClick={() => onChange(rows.filter((other) => other.id !== row.id))}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <button
        type="button"
        className="mt-2 text-xs text-muted underline underline-offset-2 disabled:no-underline"
        disabled={rows.length >= MAX_POSITIONS}
        onClick={() => onChange([...rows, { id: newRowId(), position: "", note: "", focus: "position" }])}
      >
        {rows.length >= MAX_POSITIONS ? `最多 ${MAX_POSITIONS} 个位置` : "＋ 添加位置"}
      </button>
    </div>
  );
}
