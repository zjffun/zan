"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createJar, searchWorks } from "@/app/actions/jars";
import { Cover } from "@/components/Cover";
import { WORK_KINDS, WORK_KIND_LABEL, type WorkKind } from "@/lib/types";
import type { WorkCandidate } from "@/lib/works/types";

const ORIGIN_LABEL = { bangumi: "Bangumi", openlibrary: "Open Library" } as const;

export function NewJar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const latest = useRef(0);

  // debounced search; `latest` drops answers to outdated queries
  useEffect(() => {
    const text = query.trim();
    const ticket = ++latest.current;
    if (!text) return;
    const timer = setTimeout(async () => {
      const response = await searchWorks(text);
      if (ticket !== latest.current) return;
      setSearching(false);
      if (response.ok) {
        setResults(response.candidates);
        setError(null);
      } else {
        setError(response.error);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  function open(input: unknown, key: string) {
    setError(null);
    setBusyId(key);
    startCreating(async () => {
      const response = await createJar(input);
      if (response.ok) router.push(`/jars/${response.jarId}`);
      else {
        setError(response.error);
        setBusyId(null);
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <label htmlFor="work-search" className="sr-only">
          搜索作品
        </label>
        <input
          id="work-search"
          className="input"
          type="search"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearching(e.target.value.trim() !== "");
            if (!e.target.value.trim()) setResults(null);
          }}
          placeholder="作品名，或书的 ISBN"
          autoComplete="off"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {searching ? <p className="text-sm text-muted">搜索中…</p> : null}

      {results && !searching ? (
        results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((work) => {
              const key = `${work.origin}:${work.id}`;
              return (
                <li key={key} className="card flex items-center gap-4 p-3">
                  <Cover src={work.cover_url} kind={work.kind} className="h-20 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{work.title}</p>
                    {work.title_original ? <p className="truncate text-sm text-muted">{work.title_original}</p> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="chip">{WORK_KIND_LABEL[work.kind]}</span>
                      <span className="chip">{ORIGIN_LABEL[work.origin]}</span>
                      {work.subtitle ? <span className="text-xs text-muted">{work.subtitle}</span> : null}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={creating}
                    onClick={() =>
                      open(
                        work.origin === "openlibrary"
                          ? { origin: "openlibrary", id: work.id, ...(work.isbn ? { isbn: work.isbn } : {}) }
                          : { origin: "bangumi", id: work.id },
                        key,
                      )
                    }
                  >
                    {busyId === key ? "创建中…" : "创建罐子"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">没有找到。换个关键词，或者在下面手动创建。</p>
        )
      ) : null}

      <ManualForm disabled={creating} busy={busyId === "manual"} onSubmit={(input) => open(input, "manual")} />
    </div>
  );
}

function ManualForm({
  disabled,
  busy,
  onSubmit,
}: {
  disabled: boolean;
  busy: boolean;
  onSubmit: (input: unknown) => void;
}) {
  const [kind, setKind] = useState<WorkKind>("other");
  const [title, setTitle] = useState("");
  const [original, setOriginal] = useState("");
  const [cover, setCover] = useState("");

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium">找不到？手动创建</summary>
      <p className="mt-2 text-xs text-muted">
        适合不在任何数据库里的东西，比如某个 YouTube 系列或同人游戏。封面链接可选，仅支持 Bangumi / Open Library / YouTube / B
        站的图片。
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            origin: "manual",
            kind,
            title,
            ...(original.trim() ? { title_original: original } : {}),
            ...(cover.trim() ? { cover_url: cover } : {}),
          });
        }}
      >
        <label className="text-sm font-medium sm:col-span-2">
          标题
          <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
        </label>
        <label className="text-sm font-medium">
          类型
          <select className="input mt-1" value={kind} onChange={(e) => setKind(e.target.value as WorkKind)}>
            {WORK_KINDS.map((k) => (
              <option key={k} value={k}>
                {WORK_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          原名（可选）
          <input className="input mt-1" value={original} onChange={(e) => setOriginal(e.target.value)} maxLength={300} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          封面链接（可选）
          <input className="input mt-1" type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://" />
        </label>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={disabled || !title.trim()}>
            {busy ? "创建中…" : "创建罐子"}
          </button>
        </div>
      </form>
    </details>
  );
}
