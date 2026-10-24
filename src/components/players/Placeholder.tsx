/* eslint-disable @next/next/no-img-element -- third-party thumbnails, hotlink protected */
import { PROVIDER_LABEL, sourceTitle, sourceUrl } from "@/lib/sources";
import { formatTimestamp } from "@/lib/time";
import type { PlayerSource } from "./types";

/**
 * Stands in for a player when there is nothing to embed: dead videos, links,
 * episodes (most legit streaming sites cannot be embedded) and book editions.
 * The saved metadata snapshot keeps it recognisable.
 */
export function Placeholder({ source, reason }: { source: PlayerSource; reason: "dead" | "external" | "failed" }) {
  const title = sourceTitle(source);
  const url = sourceUrl(source);
  const meta = source.meta;
  const message =
    reason === "dead"
      ? "视频已失效（被删除、设为私享或禁止外嵌）。笔记仍然保留。"
      : reason === "failed"
        ? "播放器没能加载，可能是网络限制。可以在原站打开。"
        : source.provider === "episode"
          ? "番剧只记录“第几集 + 时间码”，请在正版平台观看。"
          : source.provider === "book"
            ? "书只记页码和你自己摘的短句。"
            : "这个资源不能在页面内播放。";

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-line bg-sunken p-6 text-center">
      {meta?.thumbnail && reason !== "external" ? (
        <img
          src={meta.thumbnail}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-24 rounded-md opacity-60 grayscale"
        />
      ) : null}
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[PROVIDER_LABEL[source.provider], meta?.author, meta?.duration ? formatTimestamp(meta.duration) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {url ? (
        <a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer nofollow">
          在原站打开 ↗
        </a>
      ) : null}
    </div>
  );
}
