"use client";

import { useEffect, useRef, useState } from "react";
import { searchTags } from "@/app/actions/tags";
import { MAX_POST_TAGS } from "@/lib/post-input";
import { normalizeTagName, tagKey } from "@/lib/tag-name";
import { TAG_KIND_LABEL, type TagListItem } from "@/lib/types";

/** A tag in the picker: an existing one (has an id) or one that will be created when the post is published. */
export interface TagPick {
  id?: string;
  name: string;
}

const sameTag = (a: TagPick, b: TagPick) => (a.id && b.id ? a.id === b.id : tagKey(a.name) === tagKey(b.name));

/**
 * Pick up to five tags: type to search the existing ones, or make a new one
 * on the spot. Nothing is created until the post is published.
 */
export function TagPicker({ value, onChange }: { value: TagPick[]; onChange: (next: TagPick[]) => void }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<TagListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  const query = text.replace(/^[#＃\s]+/, "").trim();
  const typedName = normalizeTagName(text);

  // debounced search; `latest` drops answers to outdated queries
  useEffect(() => {
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      const response = await searchTags(query);
      if (ticket === latest.current && response.ok) setResults(response.tags);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function add(tag: TagPick) {
    setError(null);
    if (value.some((t) => sameTag(t, tag))) return reset();
    if (value.length >= MAX_POST_TAGS) return setError(`最多带 ${MAX_POST_TAGS} 个标签。`);
    onChange([...value, tag]);
    reset();
  }

  function reset() {
    setText("");
    setOpen(false);
  }

  function addTyped() {
    if (!text.trim()) return;
    if (!typedName) return setError("标签名要 1–30 个字，不能包含 #。");
    const exact = results.find((t) => tagKey(t.name) === tagKey(typedName));
    add(exact ? { id: exact.id, name: exact.name } : { name: typedName });
  }

  const exactMatch = typedName ? results.some((t) => tagKey(t.name) === tagKey(typedName)) : false;
  const shown = results.filter((t) => !value.some((v) => v.id === t.id));

  return (
    <div ref={root} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-accent">
        {value.map((tag) => (
          <span key={tag.id ?? `new:${tag.name}`} className="chip !bg-accent-soft !text-accent">
            #{tag.name}
            {tag.id ? null : <span className="opacity-70">（新）</span>}
            <button
              type="button"
              className="ml-0.5 opacity-70 hover:opacity-100"
              aria-label={`去掉标签 ${tag.name}`}
              onClick={() => onChange(value.filter((t) => !sameTag(t, tag)))}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTyped();
            } else if (event.key === "Backspace" && text === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length === 0 ? "加标签：搜索已有的，或直接新建" : value.length < MAX_POST_TAGS ? "再加一个" : ""}
          disabled={value.length >= MAX_POST_TAGS}
          aria-label="标签"
          autoComplete="off"
        />
      </div>

      {open && (shown.length > 0 || (typedName && !exactMatch)) ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg" role="listbox">
          {shown.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken"
                onClick={() => add({ id: tag.id, name: tag.name })}
              >
                <span className="min-w-0 flex-1 truncate">#{tag.name}</span>
                {tag.kind ? <span className="chip">{TAG_KIND_LABEL[tag.kind]}</span> : null}
                <span className="shrink-0 text-xs text-muted">{tag.post_count} 条内容</span>
              </button>
            </li>
          ))}
          {typedName && !exactMatch ? (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-accent hover:bg-sunken"
                onClick={addTyped}
              >
                新建标签 “#{typedName}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
