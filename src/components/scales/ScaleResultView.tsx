"use client";

import Link from "next/link";
import { useState } from "react";
import { SCALE_DISCLAIMER } from "@/lib/scales/disclaimer";
import { resultToText, scoreScale } from "@/lib/scales/score";
import type { SavedResult } from "@/lib/scales/storage";
import type { Scale } from "@/lib/scales/types";
import { formatDate } from "@/lib/time";
import { RightsNotice } from "./RightsNotice";
import { ScoreCard } from "./ScoreCard";
import { SourceNote } from "./SourceNote";

export const finishedOn = (finishedAt: number) => formatDate(new Date(finishedAt).toISOString());

/** What the reader scored: the total and each part with what it means, the answers to look back at, and what to do next. */
export function ScaleResultView({
  scale,
  saved,
  headingRef,
  onReview,
  onRetake,
  onClear,
}: {
  scale: Scale;
  saved: SavedResult;
  headingRef: React.Ref<HTMLHeadingElement>;
  /** go back to a question, to change the answer */
  onReview: (index: number) => void;
  onRetake: () => void;
  onClear: () => void;
}) {
  const result = scoreScale(scale, saved.answers);
  const meanOutOf = scale.reportMean ? scale.options[scale.options.length - 1].value : undefined;
  const date = finishedOn(saved.finishedAt);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | "retake" | "clear">(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold tracking-tight">
          你的结果
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {scale.title}（{scale.short}）· 完成于 {date}
        </p>
      </div>

      <RightsNotice scale={scale} />

      {result.alerts.length > 0 && scale.alertText ? (
        <aside role="alert" className="rounded-xl border border-danger bg-warn-soft p-4 text-warn-ink">
          <p className="font-semibold">请先看这一条</p>
          <p className="mt-1 leading-7">{scale.alertText}</p>
        </aside>
      ) : null}

      {result.total && scale.total ? <ScoreCard line={result.total} bands={scale.total.bands} meanOutOf={meanOutOf} /> : null}
      {result.subscales.map((line) => {
        const subscale = scale.subscales?.find((candidate) => candidate.id === line.id);
        return subscale ? <ScoreCard key={line.id} line={line} bands={subscale.bands} description={subscale.description} meanOutOf={meanOutOf} /> : null;
      })}

      <details className="card px-5 py-3">
        <summary className="tap cursor-pointer select-none text-sm font-medium">回看每一题的回答</summary>
        <ol className="mt-3 divide-y divide-line">
          {scale.items.map((item, index) => (
            <li key={index} className="flex items-start gap-3 py-2.5 text-sm">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block">{item.text}</span>
                <span className="mt-0.5 block text-muted">{scale.options.find((option) => option.value === saved.answers[index])?.label}</span>
              </span>
              <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={() => onReview(index)}>
                修改
              </button>
            </li>
          ))}
        </ol>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(resultToText(scale, result, date));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // clipboard blocked: nothing sensible to do
            }
          }}
        >
          {copied ? "已复制" : "复制结果文字"}
        </button>
        <button type="button" className="btn" onClick={() => setConfirm("retake")}>
          重新作答
        </button>
        <Link href="/scales" className="btn btn-quiet">
          全部量表
        </Link>
      </div>

      {confirm ? (
        <div role="alertdialog" aria-label="确认清除" className="card flex flex-wrap items-center gap-x-4 gap-y-2 bg-sunken px-4 py-3 text-sm">
          <p className="flex-1">{confirm === "retake" ? "重新作答会清掉这次的结果，要继续吗？" : "这会清掉这份量表在这台设备上的作答和结果，要继续吗？"}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-danger" onClick={confirm === "retake" ? onRetake : onClear}>
              {confirm === "retake" ? "清掉并重新作答" : "清除"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirm(null)}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      <p className="rounded-xl bg-sunken p-4 text-sm leading-7 text-muted">{SCALE_DISCLAIMER}</p>
      <SourceNote scale={scale} />
      <p className="text-xs text-muted">
        结果只保存在这台设备的浏览器里，不上传，也不需要登录。
        <button type="button" className="tap ml-1 underline underline-offset-2" onClick={() => setConfirm("clear")}>
          清除本机记录
        </button>
      </p>
    </div>
  );
}
