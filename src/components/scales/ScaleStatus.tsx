"use client";

import { useMemo, useSyncExternalStore } from "react";
import { browserStorage } from "@/lib/browser-storage";
import { briefResult, scoreScale } from "@/lib/scales/score";
import { parseProgress, parseResult, progressKey, readRaw, resultKey, subscribeScaleStorage } from "@/lib/scales/storage";
import type { Scale } from "@/lib/scales/types";
import { finishedOn } from "./ScaleResultView";

/**
 * What this browser has of a scale, one line on its card: the last result, or how far an unfinished
 * questionnaire got. The server renders an empty line (it cannot know), and the browser fills it in.
 */
export function ScaleStatus({ scale }: { scale: Scale }) {
  const resultRaw = useSyncExternalStore(
    subscribeScaleStorage,
    () => readRaw(browserStorage(), resultKey(scale.id)),
    () => null,
  );
  const progressRaw = useSyncExternalStore(
    subscribeScaleStorage,
    () => readRaw(browserStorage(), progressKey(scale.id)),
    () => null,
  );

  const text = useMemo(() => {
    const saved = parseResult(scale, resultRaw);
    if (saved) return `上次：${briefResult(scoreScale(scale, saved.answers))} · ${finishedOn(saved.finishedAt)}`;
    const progress = parseProgress(scale, progressRaw);
    if (progress) return `做到一半：已答 ${progress.answers.filter((answer) => answer !== null).length} / ${scale.items.length}`;
    return "";
  }, [scale, resultRaw, progressRaw]);

  return <p className="mt-2 min-h-6 text-sm font-medium text-accent">{text}</p>;
}
