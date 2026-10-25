"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createTag, createTagFromWork, searchWorks } from "@/app/actions/tags";
import { MAX_TAG_NAME_LENGTH } from "@/lib/tag-name";
import { TAG_KINDS, TAG_KIND_LABEL, type TagKind } from "@/lib/types";
import { useResetOnHide } from "@/lib/use-reset-on-hide";
import type { WorkCandidate } from "@/lib/works/types";
import { Cover } from "./Cover";
import { Select } from "./Select";

const ORIGIN_LABEL = { bangumi: "Bangumi", openlibrary: "Open Library" } as const;

/**
 * Make a tag: from a work in Bangumi / Open Library (name, cover and type come
 * with it), or by hand for anything else (a topic, a series, a person).
 */
export function NewTagForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const latest = useRef(0);
  const [formKey, setFormKey] = useState(0); // a new key gives the manual form empty fields again
  // the page stays alive (hidden) after navigating to the new tag: do not bring it back half-done
  const resetWhenLeft = useResetOnHide(() => {
    setQuery("");
    setResults(null);
    setSearching(false);
    setError(null);
    setBusyId(null);
    setFormKey((n) => n + 1);
  });

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

  function make(run: () => ReturnType<typeof createTag>, key: string) {
    setError(null);
    setBusyId(key);
    startCreating(async () => {
      const response = await run();
      if (response.ok) {
        resetWhenLeft();
        router.push(`/t/${response.tag.slug}`);
      } else {
        setError(response.error);
        setBusyId(null);
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <label htmlFor="work-search" className="mb-1 block text-sm font-medium">
          从作品库创建
        </label>
        <input
          id="work-search"
          className="input"
          type="search"
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearching(event.target.value.trim() !== "");
            if (!event.target.value.trim()) setResults(null);
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
                      <span className="chip">{TAG_KIND_LABEL[work.kind]}</span>
                      <span className="chip">{ORIGIN_LABEL[work.origin]}</span>
                      {work.subtitle ? <span className="text-xs text-muted">{work.subtitle}</span> : null}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={creating}
                    onClick={() =>
                      make(
                        () =>
                          createTagFromWork(
                            work.origin === "openlibrary"
                              ? { origin: "openlibrary", id: work.id, ...(work.isbn ? { isbn: work.isbn } : {}) }
                              : { origin: "bangumi", id: work.id },
                          ),
                        key,
                      )
                    }
                  >
                    {busyId === key ? "创建中…" : "创建标签"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">没有找到。换个关键词，或者在下面手动创建。</p>
        )
      ) : null}

      <ManualForm key={formKey} disabled={creating} busy={busyId === "manual"} onSubmit={(input) => make(() => createTag(input), "manual")} />
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
  onSubmit: (input: { name: string; kind: TagKind | null; description: string }) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TagKind | "">("");
  const [description, setDescription] = useState("");

  return (
    <details className="card p-4" open>
      <summary className="cursor-pointer text-sm font-medium">手动创建</summary>
      <p className="mt-2 text-xs text-muted">适合不在任何数据库里的东西：一个话题、一个视频系列、一个人。名字重复的话会直接打开已有的标签。</p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name, kind: kind || null, description });
        }}
      >
        <label className="text-sm font-medium sm:col-span-2">
          标签名
          <input
            className="input mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={MAX_TAG_NAME_LENGTH + 1}
            placeholder="例如：读书笔记 / 心理学 / 周末随想"
          />
        </label>
        <label className="text-sm font-medium">
          类型（可选）
          <Select className="mt-1" value={kind} onChange={(event) => setKind(event.target.value as TagKind | "")}>
            <option value="">话题</option>
            {TAG_KINDS.map((k) => (
              <option key={k} value={k}>
                {TAG_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          介绍（可选）
          <textarea
            className="input mt-1 min-h-16"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="这个标签是关于什么的？"
          />
        </label>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={disabled || !name.trim()}>
            {busy ? "创建中…" : "创建标签"}
          </button>
        </div>
      </form>
    </details>
  );
}
