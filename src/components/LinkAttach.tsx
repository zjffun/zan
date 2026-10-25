"use client";

import { useState } from "react";
import { previewLink } from "@/app/actions/link";
import { attempt } from "@/lib/attempt";
import type { ResolvedLink } from "@/lib/links/resolve";
import { PROVIDER_LABEL } from "@/lib/sources";
import { formatTimestamp } from "@/lib/time";

/** A link that has been recognised and is ready to be saved with the post. */
export interface Attached {
  source: ResolvedLink["source"];
  /** editable: the platform's title, or what the user typed when it could not be fetched */
  title: string;
  /** the time that was in the pasted link, if any */
  startAt?: number;
  needsTitle: boolean;
  warnings: string[];
}

/** Paste a video or page link: shows what it is (title, thumbnail) before it is attached. */
export function LinkAttach({
  value,
  onChange,
  onAttached,
}: {
  value: Attached | null;
  onChange: (next: Attached | null) => void;
  /** called once, right after a new link was attached */
  onAttached?: (attached: Attached) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await attempt(() => previewLink(url.trim()));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const { preview } = result;
    const attached: Attached = {
      source: preview.source,
      title: preview.source.meta?.title ?? "",
      startAt: preview.t,
      needsTitle: preview.needsTitle,
      warnings: preview.warnings,
    };
    onChange(attached);
    onAttached?.(attached);
    setUrl("");
  }

  if (value) {
    const meta = value.source.meta;
    return (
      <div className="space-y-2 rounded-lg bg-sunken p-3">
        <div className="flex gap-3">
          {meta?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- hotlink-protected third-party thumbnail
            <img src={meta.thumbnail} alt="" referrerPolicy="no-referrer" className="h-16 w-28 shrink-0 rounded object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-muted" htmlFor="attached-title">
              {PROVIDER_LABEL[value.source.provider]} · 标题（选填）
            </label>
            <input
              id="attached-title"
              className="input mt-1"
              value={value.title}
              onChange={(event) => onChange({ ...value, title: event.target.value })}
              maxLength={300}
              placeholder={value.needsTitle ? "没能自动取到标题，可以手动写一个，也可以留空" : "留空就只显示链接来源"}
            />
            <p className="mt-1 text-xs text-muted">
              {[meta?.author, meta?.part, meta?.duration ? formatTimestamp(meta.duration) : null, value.startAt ? `从 ${formatTimestamp(value.startAt)} 开始` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button type="button" className="btn btn-quiet btn-sm self-start" onClick={() => onChange(null)} aria-label="去掉链接">
            ✕
          </button>
        </div>
        {value.warnings.map((warning) => (
          <p key={warning} className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn-ink">
            {warning}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void resolve();
            }
          }}
          placeholder="贴一个 B 站 / YouTube / 网页链接（可选）"
          aria-label="视频或网页链接"
        />
        <button type="button" className="btn shrink-0" disabled={busy || !url.trim()} onClick={() => void resolve()}>
          {busy ? "解析中…" : "添加"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
