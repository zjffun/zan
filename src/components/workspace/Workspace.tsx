"use client";

import { useRef, useState } from "react";
import { deleteNote, setNoteHidden } from "@/app/actions/notes";
import { removeSource, renameSource } from "@/app/actions/sources";
import { anchorLabel, compareAnchors } from "@/lib/anchor";
import type { JarBundle, PublicationInfo } from "@/lib/dal";
import type { ChipAttrs } from "@/lib/doc/schema";
import { sourceTitle, PROVIDER_LABEL } from "@/lib/sources";
import { WORK_KIND_LABEL, type Note, type Source } from "@/lib/types";
import { workLinks } from "@/lib/works/external";
import { Cover } from "../Cover";
import { SourcePlayer } from "../players/SourcePlayer";
import type { PlayerHandle } from "../players/types";
import { AddSource } from "./AddSource";
import { NoteCard } from "./NoteCard";
import { NoteForm, type NoteFormHandle } from "./NoteForm";
import { PublishPanel } from "./PublishPanel";

export function Workspace({ initial, origin }: { initial: JarBundle; origin: string }) {
  const { jar, work } = initial;
  const [sources, setSources] = useState<Source[]>(initial.sources);
  const [notes, setNotes] = useState<Note[]>(initial.notes);
  const [publication, setPublication] = useState<PublicationInfo | null>(initial.publication);
  const [active, setActive] = useState<{ id: string | null; startAt?: number }>({ id: initial.sources[0]?.id ?? null });
  const [adding, setAdding] = useState(initial.sources.length === 0);
  const [scope, setScope] = useState<"current" | "all">("current");
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const playerRef = useRef<PlayerHandle>(null);
  const formRef = useRef<NoteFormHandle>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeSource = sources.find((s) => s.id === active.id) ?? null;
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  function notify(text: string) {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 5000);
  }

  // ---- playback ----------------------------------------------------------

  function seek(attrs: ChipAttrs, sourceId: string | null) {
    if (attrs.t === undefined) {
      if (attrs.page !== undefined) notify(`p.${attrs.page}`);
      return;
    }
    if (sourceId && sourceId !== active.id) {
      setActive({ id: sourceId, startAt: attrs.t }); // the new player starts there
      return;
    }
    if (!playerRef.current) return notify("这个资源不能在页面内播放。");
    playerRef.current.seekTo(attrs.t);
  }

  function recordTime() {
    const t = playerRef.current?.getCurrentTime();
    if (t == null) {
      return notify(timeHint(activeSource));
    }
    formRef.current?.insertTime(t);
  }

  // ---- sources -----------------------------------------------------------

  function sourceAdded(source: Source, startAt?: number) {
    setSources((prev) => [...prev, source]);
    setActive({ id: source.id, startAt });
    setAdding(false);
  }

  async function remove(source: Source) {
    const attached = notes.filter((n) => n.source_id === source.id).length;
    const warning = attached
      ? `移除“${sourceTitle(source)}”？它的 ${attached} 条笔记会保留，但不再关联任何资源。`
      : `移除“${sourceTitle(source)}”？`;
    if (!confirm(warning)) return;
    const result = await removeSource(source.id);
    if (!result.ok) return notify(result.error);
    setSources((prev) => prev.filter((s) => s.id !== source.id));
    setNotes((prev) => prev.map((n) => (n.source_id === source.id ? { ...n, source_id: null } : n)));
    if (active.id === source.id) setActive({ id: sources.find((s) => s.id !== source.id)?.id ?? null });
  }

  async function rename(source: Source, title: string) {
    setRenaming(null);
    if (!title.trim() || title.trim() === source.meta?.title) return;
    const result = await renameSource(source.id, title);
    if (!result.ok) return notify(result.error);
    setSources((prev) => prev.map((s) => (s.id === source.id ? result.source : s)));
  }

  // ---- notes -------------------------------------------------------------

  function noteSaved(note: Note) {
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev.map((n) => (n.id === note.id ? note : n)) : [...prev, note]));
    setEditingId(null);
  }

  async function removeNote(note: Note) {
    if (!confirm("删除这条笔记？")) return;
    const result = await deleteNote(note.id);
    if (!result.ok) return notify(result.error);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  }

  async function toggleHidden(note: Note) {
    const result = await setNoteHidden(note.id, !note.hide_on_publish);
    if (!result.ok) return notify(result.error);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? result.note : n)));
  }

  const visibleNotes = (() => {
    const needle = filter.trim().toLowerCase();
    const order = new Map(sources.map((s, i) => [s.id, i]));
    return notes
      .filter((n) => scope === "all" || !activeSource || n.source_id === activeSource.id)
      .filter((n) => !needle || n.plain_text.toLowerCase().includes(needle) || (n.anchor && anchorLabel(n.anchor).toLowerCase().includes(needle)))
      .sort(
        (a, b) =>
          (a.source_id ? (order.get(a.source_id) ?? 1e6) : 1e6 + 1) - (b.source_id ? (order.get(b.source_id) ?? 1e6) : 1e6 + 1) ||
          compareAnchors(a.anchor, b.anchor) ||
          a.created_at.localeCompare(b.created_at),
      );
  })();

  const links = workLinks(work);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* work header */}
      <div className="flex items-center gap-4">
        <Cover src={work.cover_url} kind={work.kind} className="h-16 w-11" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{work.title}</h1>
          <p className="truncate text-sm text-muted">
            {[work.title_original, WORK_KIND_LABEL[work.kind]].filter(Boolean).join(" · ")}
            {links.map((l) => (
              <span key={l.url}>
                {" · "}
                <a className="underline underline-offset-2" href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* left: sources + player + publish */}
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="资源">
            {sources.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={s.id === active.id}
                onClick={() => setActive({ id: s.id })}
                className={`btn btn-sm max-w-[14rem] ${s.id === active.id ? "!border-accent !bg-accent-soft !text-accent" : ""}`}
                title={sourceTitle(s)}
              >
                <span className="shrink-0 text-xs opacity-70">{PROVIDER_LABEL[s.provider]}</span>
                <span className="truncate">{sourceTitle(s)}</span>
                {s.status === "dead" ? <span className="chip !bg-warn-soft !text-warn-ink">失效</span> : null}
              </button>
            ))}
            <button className="btn btn-sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
              ＋ 添加资源
            </button>
          </div>

          {adding ? <AddSource jarId={jar.id} work={work} onAdded={sourceAdded} onClose={() => setAdding(false)} /> : null}

          {activeSource ? (
            <div className="mt-3">
              <SourcePlayer key={`${activeSource.id}:${active.startAt ?? 0}`} source={activeSource} startAt={active.startAt} handleRef={playerRef} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {renaming === activeSource.id ? (
                  <form
                    className="flex min-w-0 flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename(activeSource, new FormData(e.currentTarget).get("title") as string);
                    }}
                  >
                    <input name="title" className="input !min-h-8 !py-1" defaultValue={activeSource.meta?.title ?? ""} autoFocus maxLength={300} aria-label="资源标题" />
                    <button className="btn btn-sm">保存</button>
                  </form>
                ) : (
                  <p className="min-w-0 flex-1 truncate text-sm font-medium" title={sourceTitle(activeSource)}>
                    {sourceTitle(activeSource)}
                  </p>
                )}
                {activeSource.provider === "youtube" && activeSource.status !== "dead" ? (
                  <button className="btn btn-sm" onClick={recordTime} title="Alt + T">
                    ⏱ 记录当前时间
                  </button>
                ) : null}
                <button className="btn btn-quiet btn-sm" onClick={() => setRenaming(activeSource.id)}>
                  改名
                </button>
                <button className="btn btn-quiet btn-danger btn-sm" onClick={() => remove(activeSource)}>
                  移除
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex aspect-video items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
              {sources.length === 0 ? "先添加一个资源：视频链接、剧集或书的版本" : "选择一个资源"}
            </div>
          )}

          <PublishPanel jar={jar} notes={notes} sources={sources} publication={publication} onChange={setPublication} origin={origin} />
        </div>

        {/* right: notes */}
        <div className="min-w-0">
          <section className="card p-3.5" aria-label="新笔记">
            <NoteForm
              ref={formRef}
              jarId={jar.id}
              sources={sources}
              defaultSourceId={activeSource?.id ?? null}
              onSaved={noteSaved}
              onChipClick={seek}
              readTime={() => playerRef.current?.getCurrentTime() ?? null}
              timeHint={timeHint(activeSource)}
            />
          </section>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">笔记 <span className="text-sm font-normal text-muted">{visibleNotes.length}</span></h2>
            <div className="ml-auto flex items-center gap-2">
              <input
                className="input !min-h-8 !w-40 !py-1 text-sm"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="在这个罐子里搜索"
                aria-label="搜索笔记"
              />
              <div className="flex rounded-lg border border-line p-0.5 text-sm" role="group" aria-label="笔记范围">
                {(["current", "all"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={scope === value}
                    onClick={() => setScope(value)}
                    className={`rounded-md px-2.5 py-0.5 ${scope === value ? "bg-accent-soft text-accent" : "text-muted"}`}
                  >
                    {value === "current" ? "当前资源" : "全部"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {visibleNotes.map((note) =>
              editingId === note.id ? (
                <div key={note.id} className="card p-3.5">
                  <NoteForm
                    jarId={jar.id}
                    sources={sources}
                    defaultSourceId={note.source_id}
                    note={note}
                    onSaved={noteSaved}
                    onCancel={() => setEditingId(null)}
                    onChipClick={seek}
                    readTime={() => playerRef.current?.getCurrentTime() ?? null}
                    timeHint={timeHint(activeSource)}
                  />
                </div>
              ) : (
                <NoteCard
                  key={note.id}
                  note={note}
                  source={note.source_id ? (sourceById.get(note.source_id) ?? null) : null}
                  showSource={scope === "all" || !activeSource}
                  onSeek={seek}
                  onEdit={() => setEditingId(note.id)}
                  onDelete={() => removeNote(note)}
                  onToggleHidden={() => toggleHidden(note)}
                />
              ),
            )}
            {visibleNotes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                {notes.length === 0 ? "还没有笔记。看到有意思的地方，按 Alt+T 记下时间。" : "没有符合条件的笔记。"}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {message ? (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-paper shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function timeHint(source: Source | null): string {
  if (!source) return "先添加一个资源，才能在笔记里记录位置。";
  switch (source.provider) {
    case "youtube":
      return "Alt+T 或“记录当前时间”插入当前播放时间；也可以输入 @12:34 加空格。";
    case "bilibili":
      return "B 站播放器读不到当前时间：输入 @12:34 加空格，或把带 ?t= 的链接粘贴到“位置”框。";
    case "book":
      return "输入 p.132 加空格插入页码；摘录请控制在 200 字以内。";
    case "episode":
      return "输入 @12:34 记录这一集里的时间点，例如 E5@12:34。";
    default:
      return "输入 @12:34 或 p.132 加空格，会变成可点击的位置标签。";
  }
}
