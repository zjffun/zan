"use client";

import { useState } from "react";
import { deleteJar } from "@/app/actions/jars";
import { publishJar, unpublishJar } from "@/app/actions/publish";
import type { PublicationInfo } from "@/lib/dal";
import type { Jar, Note, Source } from "@/lib/types";

export function PublishPanel({
  jar,
  notes,
  sources,
  publication,
  onChange,
  origin,
}: {
  jar: Jar;
  notes: Note[];
  sources: Source[];
  publication: PublicationInfo | null;
  onChange: (publication: PublicationInfo | null) => void;
  /** e.g. https://zan.example, for the copyable public URL */
  origin: string;
}) {
  const [choice, setChoice] = useState<"unlisted" | "public">(publication?.visibility ?? "unlisted");
  const [busy, setBusy] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hiddenCount = notes.filter((n) => n.hide_on_publish).length;
  const publishedAt = publication ? new Date(publication.published_at).getTime() : 0;
  const dirty =
    publication !== null &&
    (notes.some((n) => new Date(n.updated_at).getTime() > publishedAt + 1000) ||
      sources.some((s) => new Date(s.created_at).getTime() > publishedAt + 1000));
  const url = publication ? `${origin}/p/${publication.slug}` : null;

  async function publish() {
    setBusy("publish");
    setError(null);
    const result = await publishJar(jar.id, choice);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onChange(result.publication);
  }

  async function unpublish() {
    if (!confirm("取消发布后，公开页会立刻失效（链接打不开）。你的私人笔记不受影响。继续吗？")) return;
    setBusy("unpublish");
    setError(null);
    const result = await unpublishJar(jar.id);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onChange(null);
  }

  async function remove() {
    if (!confirm("删除这部作品下的所有资源和笔记，并撤下公开页。此操作无法撤销。")) return;
    setBusy("delete");
    const result = await deleteJar(jar.id);
    if (result && !result.ok) {
      setBusy(null);
      setError(result.error);
    }
  }

  return (
    <section className="card mt-4 p-4" aria-labelledby="publish-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="publish-heading" className="font-semibold">
          发布
        </h2>
        <span className={`chip ${publication ? "!bg-accent-soft !text-accent" : ""}`}>
          {publication ? (publication.visibility === "public" ? "公开" : "仅链接可见") : "私人"}
        </span>
      </div>

      {!publication ? (
        <p className="mt-1 text-sm text-muted">你攒的内容默认只有自己看得到。发布会生成一份只读快照页，之后你继续改笔记不会影响它。</p>
      ) : (
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <a className="min-w-0 flex-1 truncate text-accent underline underline-offset-2" href={url!} target="_blank" rel="noopener">
              {url}
            </a>
            <button
              className="btn btn-sm shrink-0"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard blocked: the link is selectable above */
                }
              }}
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <p className="text-xs text-muted">
            版本 {publication.version} · 发布于 {new Date(publication.published_at).toLocaleString("zh-CN")}
          </p>
          {dirty ? <p className="rounded-md bg-warn-soft px-2.5 py-1.5 text-xs text-warn-ink">有改动还没发布到公开页，点“更新快照”。</p> : null}
        </div>
      )}

      <fieldset className="mt-3 space-y-1.5 text-sm" disabled={busy !== null}>
        <legend className="sr-only">公开程度</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" className="mt-1" checked={choice === "unlisted"} onChange={() => setChoice("unlisted")} />
          <span>
            仅链接可见
            <span className="block text-xs text-muted">随机地址，不进搜索引擎（noindex），拿到链接的人才能看。</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" className="mt-1" checked={choice === "public"} onChange={() => setChoice("public")} />
          <span>
            公开
            <span className="block text-xs text-muted">收进 sitemap，允许搜索引擎收录。</span>
          </span>
        </label>
      </fieldset>

      {hiddenCount > 0 ? <p className="mt-2 text-xs text-muted">🔒 {hiddenCount} 条笔记标记了“发布时隐藏”，不会进入快照。</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={publish} disabled={busy !== null}>
          {busy === "publish" ? "发布中…" : publication ? "更新快照" : "发布"}
        </button>
        {publication ? (
          <button className="btn btn-sm" onClick={unpublish} disabled={busy !== null}>
            取消发布
          </button>
        ) : null}
        <a className="btn btn-sm" href={`/api/jars/${jar.id}/export`} download>
          导出 Markdown
        </a>
        <button className="btn btn-quiet btn-danger btn-sm ml-auto" onClick={remove} disabled={busy !== null}>
          删除全部笔记
        </button>
      </div>
    </section>
  );
}
