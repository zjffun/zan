"use client";

import { useRef, useState } from "react";
import { anchorLabel, compareAnchors, type Anchor } from "@/lib/anchor";
import type { ChipAttrs } from "@/lib/doc/schema";
import { PROVIDER_LABEL, sourceTitle } from "@/lib/sources";
import { WORK_KIND_LABEL, type SourceMeta, type SourceProvider, type WorkKind } from "@/lib/types";
import { Cover } from "./Cover";
import { SourcePlayer } from "./players/SourcePlayer";
import type { PlayerHandle } from "./players/types";
import { RichHtml } from "./RichHtml";

export interface PublicSource {
  id: string;
  provider: SourceProvider;
  ref: Record<string, unknown>;
  meta: SourceMeta | null;
  status: "ok" | "dead";
}

export interface PublicNote {
  id: string;
  source_id: string | null;
  anchor: Anchor | null;
  /** rendered on the server from the whitelist */
  html: string;
}

export interface PublicViewProps {
  work: { kind: WorkKind; title: string; title_original: string | null; cover_url: string | null };
  links: { label: string; url: string }[];
  sources: PublicSource[];
  notes: PublicNote[];
  publishedAt: string;
  version: number;
  slug: string;
}

/** Read-only snapshot: embedded players, anchored notes, click a timestamp to jump. */
export function PublicView({ work, links, sources, notes, publishedAt, version, slug }: PublicViewProps) {
  const [active, setActive] = useState<{ id: string | null; startAt?: number }>({ id: sources[0]?.id ?? null });
  const [showAll, setShowAll] = useState(false);
  const playerRef = useRef<PlayerHandle>(null);

  const activeSource = sources.find((s) => s.id === active.id) ?? null;
  const order = new Map(sources.map((s, i) => [s.id, i]));
  const bySource = new Map(sources.map((s) => [s.id, s]));

  function seek(attrs: ChipAttrs, sourceId: string | null) {
    if (attrs.t === undefined) return;
    if (sourceId && sourceId !== active.id) setActive({ id: sourceId, startAt: attrs.t });
    else playerRef.current?.seekTo(attrs.t);
  }

  const shown = notes
    .filter((n) => showAll || !activeSource || n.source_id === activeSource.id)
    .sort(
      (a, b) =>
        (a.source_id ? (order.get(a.source_id) ?? 1e6) : 1e6 + 1) - (b.source_id ? (order.get(b.source_id) ?? 1e6) : 1e6 + 1) ||
        compareAnchors(a.anchor, b.anchor),
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex items-start gap-4">
        <Cover src={work.cover_url} kind={work.kind} className="h-28 w-20" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{work.title}</h1>
          {work.title_original ? <p className="text-muted">{work.title_original}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className="chip">{WORK_KIND_LABEL[work.kind]}</span>
            {links.map((l) => (
              <a key={l.url} className="underline underline-offset-2" href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                {l.label}
              </a>
            ))}
            <span>
              发布于 <time dateTime={publishedAt}>{new Date(publishedAt).toISOString().slice(0, 10)}</time>
              {version > 1 ? ` · 第 ${version} 版` : ""}
            </span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          {sources.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="资源">
              {sources.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === active.id}
                  onClick={() => setActive({ id: s.id })}
                  className={`btn btn-sm max-w-[14rem] ${s.id === active.id ? "!border-accent !bg-accent-soft !text-accent" : ""}`}
                >
                  <span className="shrink-0 text-xs opacity-70">{PROVIDER_LABEL[s.provider]}</span>
                  <span className="truncate">{sourceTitle(s)}</span>
                </button>
              ))}
            </div>
          ) : null}
          {activeSource ? (
            <SourcePlayer key={`${activeSource.id}:${active.startAt ?? 0}`} source={activeSource} startAt={active.startAt} handleRef={playerRef} />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
              这个罐子还没有资源
            </div>
          )}
        </div>

        <section className="min-w-0" aria-label="笔记">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">
              笔记 <span className="text-sm font-normal text-muted">{shown.length}</span>
            </h2>
            {sources.length > 1 ? (
              <button className="btn btn-quiet btn-sm ml-auto" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
                {showAll ? "只看当前资源" : "显示全部"}
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-3">
            {shown.map((note) => {
              const source = note.source_id ? bySource.get(note.source_id) : undefined;
              return (
                <article key={note.id} className="card p-3.5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {note.anchor ? (
                      note.anchor.t !== undefined ? (
                        <button
                          type="button"
                          className="anchor-chip !m-0"
                          onClick={() => seek({ t: note.anchor!.t }, note.source_id)}
                          title="跳到这里"
                        >
                          {anchorLabel(note.anchor)}
                        </button>
                      ) : (
                        <span className="anchor-chip !m-0 !cursor-default">{anchorLabel(note.anchor)}</span>
                      )
                    ) : null}
                    {(showAll || !activeSource) && source ? <span className="chip max-w-[16rem] truncate">{sourceTitle(source)}</span> : null}
                  </div>
                  {note.anchor?.quote ? (
                    <blockquote className="mb-2 border-l-[3px] border-line pl-3 text-sm italic text-muted">{note.anchor.quote}</blockquote>
                  ) : null}
                  <RichHtml html={note.html} onChip={(attrs) => seek(attrs, note.source_id)} />
                </article>
              );
            })}
            {shown.length === 0 ? <p className="py-8 text-center text-sm text-muted">没有笔记。</p> : null}
          </div>
        </section>
      </div>

      <p className="mt-10 border-t border-line pt-4 text-xs text-muted">
        这是 zan 用户发布的只读快照，视频由官方播放器嵌入，不由 zan 托管。{" "}
        <a className="underline underline-offset-2" href={`/report?page=${slug}`}>
          举报此页
        </a>
        {" · "}
        <a className="underline underline-offset-2" href="/terms">
          服务条款
        </a>
      </p>
    </div>
  );
}
