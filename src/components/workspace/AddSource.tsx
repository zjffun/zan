"use client";

import { useEffect, useState } from "react";
import { listEpisodes } from "@/app/actions/jars";
import { addSource, previewLink } from "@/app/actions/sources";
import { formatTimestamp } from "@/lib/time";
import type { ResolvedLink } from "@/lib/links/resolve";
import type { Source, Work } from "@/lib/types";
import type { BangumiEpisode } from "@/lib/works/bangumi";

type Tab = "link" | "episode" | "book";

export function AddSource({
  jarId,
  work,
  onAdded,
  onClose,
}: {
  jarId: string;
  work: Work;
  /** `startAt`: the time that was in the pasted link, if any */
  onAdded: (source: Source, startAt?: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(work.kind === "book" || work.kind === "manga" ? "book" : "link");
  const tabs: { id: Tab; label: string }[] = [
    { id: "link", label: "视频 / 链接" },
    { id: "episode", label: "剧集" },
    { id: "book", label: "书 / 版本" },
  ];

  return (
    <div className="card mt-3 p-4">
      <div className="mb-3 flex items-center gap-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`btn btn-sm ${tab === t.id ? "!bg-accent-soft !text-accent" : "btn-quiet"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="btn btn-quiet btn-sm ml-auto" onClick={onClose} aria-label="关闭">
          ✕
        </button>
      </div>
      {tab === "link" ? <LinkTab jarId={jarId} onAdded={onAdded} /> : null}
      {tab === "episode" ? <EpisodeTab jarId={jarId} work={work} onAdded={onAdded} /> : null}
      {tab === "book" ? <BookTab jarId={jarId} work={work} onAdded={onAdded} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LinkTab({ jarId, onAdded }: { jarId: string; onAdded: (s: Source, startAt?: number) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResolvedLink | null>(null);
  const [title, setTitle] = useState("");

  async function resolve() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    const result = await previewLink(url.trim());
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setPreview(result.preview);
    setTitle(result.preview.source.meta?.title ?? "");
  }

  async function add() {
    if (!preview || busy) return;
    setBusy(true);
    const result = await addSource({ jarId, source: preview.source, title: title.trim() || undefined });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onAdded(result.source, preview.t);
  }

  const meta = preview?.source.meta;
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void resolve();
        }}
      >
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴 YouTube / B 站（含 b23.tv 短链）/ 其他网页链接"
          aria-label="视频或网页链接"
          autoFocus
        />
        <button className="btn btn-primary shrink-0" disabled={busy || !url.trim()}>
          {busy && !preview ? "解析中…" : "解析"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-3 rounded-lg bg-sunken p-3">
          <div className="flex gap-3">
            {meta?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- hotlink-protected third-party thumbnail
              <img src={meta.thumbnail} alt="" referrerPolicy="no-referrer" className="h-16 w-28 shrink-0 rounded object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <label className="text-xs font-medium text-muted" htmlFor="source-title">
                标题{preview.needsTitle ? "（需要手动填写）" : "（可修改）"}
              </label>
              <input
                id="source-title"
                className="input mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
              />
              <p className="mt-1 text-xs text-muted">
                {[meta?.author, meta?.part, meta?.duration ? formatTimestamp(meta.duration) : null, preview.t ? `从 ${formatTimestamp(preview.t)} 开始` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {preview.warnings.map((warning) => (
            <p key={warning} className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn-ink">
              {warning}
            </p>
          ))}
          <button className="btn btn-primary btn-sm" onClick={add} disabled={busy || (preview.needsTitle && !title.trim())}>
            {busy ? "添加中…" : "添加到罐子"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function EpisodeTab({ jarId, work, onAdded }: { jarId: string; work: Work; onAdded: (s: Source) => void }) {
  const subject = work.external.bangumi;
  const [episodes, setEpisodes] = useState<BangumiEpisode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(subject));
  const [error, setError] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState("");
  const [busyEp, setBusyEp] = useState<number | null>(null);
  const [manualEp, setManualEp] = useState("");

  function apply(result: Awaited<ReturnType<typeof listEpisodes>>, offset: number) {
    setLoading(false);
    if (!result.ok) return setError(result.error);
    setEpisodes((prev) => (offset === 0 ? result.episodes : [...prev, ...result.episodes]));
    setTotal(result.total);
  }

  function loadMore() {
    if (!subject) return;
    const offset = episodes.length;
    setLoading(true);
    void listEpisodes(subject, offset).then((result) => apply(result, offset));
  }

  useEffect(() => {
    if (!subject) return;
    let cancelled = false; // `loading` starts out true when there is a subject
    void listEpisodes(subject, 0).then((result) => {
      if (!cancelled) apply(result, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  async function add(ep: number, label: string, extra: { bgm_ep?: number; duration?: number | null }) {
    setBusyEp(ep);
    setError(null);
    const result = await addSource({
      jarId,
      source: {
        provider: "episode",
        ref: {
          ep,
          ...(extra.bgm_ep ? { bgm_ep: extra.bgm_ep } : {}),
          ...(subject ? { subject: Number(subject) } : {}),
          ...(watchUrl.trim() ? { url: watchUrl.trim() } : {}),
        },
        meta: { title: label, ...(extra.duration ? { duration: extra.duration } : {}) },
      },
    });
    setBusyEp(null);
    if (!result.ok) return setError(result.error);
    onAdded(result.source);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        正版番剧大多不能外嵌，所以只记“第几集 + 时间码”，可以附一个正版平台的观看链接。
      </p>
      <input
        className="input"
        value={watchUrl}
        onChange={(e) => setWatchUrl(e.target.value)}
        placeholder="正版观看链接（可选，之后添加的剧集都会带上）"
        aria-label="正版观看链接"
        type="url"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {subject ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
          <ul className="divide-y divide-line">
            {episodes.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="w-9 shrink-0 font-medium tabular-nums">E{e.ep}</span>
                <span className="min-w-0 flex-1 truncate">{e.title || "（无标题）"}</span>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">{e.airdate}</span>
                <button
                  className="btn btn-sm shrink-0"
                  disabled={busyEp !== null}
                  onClick={() => add(e.ep, `第 ${e.ep} 集${e.title ? ` · ${e.title}` : ""}`, { bgm_ep: e.id, duration: e.duration })}
                >
                  {busyEp === e.ep ? "…" : "添加"}
                </button>
              </li>
            ))}
          </ul>
          {loading ? <p className="p-3 text-center text-xs text-muted">加载中…</p> : null}
          {!loading && episodes.length < total ? (
            <button className="btn btn-quiet btn-sm w-full" onClick={loadMore}>
              加载更多（{episodes.length}/{total}）
            </button>
          ) : null}
          {!loading && episodes.length === 0 && !error ? <p className="p-3 text-center text-xs text-muted">Bangumi 上还没有这部作品的剧集。</p> : null}
        </div>
      ) : (
        <p className="text-xs text-muted">这部作品不在 Bangumi，无法列出剧集，请手动输入集数。</p>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const ep = Number(manualEp);
          if (Number.isInteger(ep) && ep >= 0) void add(ep, `第 ${ep} 集`, {});
        }}
      >
        <input
          className="input !w-28"
          inputMode="numeric"
          value={manualEp}
          onChange={(e) => setManualEp(e.target.value.replace(/\D/g, ""))}
          placeholder="第几集"
          aria-label="手动输入集数"
        />
        <button className="btn btn-sm" disabled={manualEp === "" || busyEp !== null}>
          手动添加
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BookTab({ jarId, work, onAdded }: { jarId: string; work: Work; onAdded: (s: Source) => void }) {
  const [edition, setEdition] = useState("");
  const [isbn, setIsbn] = useState(work.external.isbn ?? "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const result = await addSource({
      jarId,
      source: {
        provider: "book",
        ref: {
          ...(edition.trim() ? { edition: edition.trim() } : {}),
          ...(isbn.trim() ? { isbn: isbn.trim() } : {}),
          ...(url.trim() ? { url: url.trim() } : {}),
        },
        meta: { title: edition.trim() || work.title },
      },
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onAdded(result.source);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <p className="text-xs text-muted">书只记页码，加一句你自己摘的短句（200 字以内）。这里登记你在读的版本。</p>
      <input className="input" value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="版本（如：中文版 · 人民文学出版社 / Kindle）" aria-label="版本" maxLength={200} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="ISBN（可选）" aria-label="ISBN" />
        <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="购买 / 在线阅读链接（可选）" aria-label="链接" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary btn-sm" disabled={busy || (!edition.trim() && !isbn.trim() && !url.trim())}>
        {busy ? "添加中…" : "添加版本"}
      </button>
    </form>
  );
}
