"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { browserStorage } from "@/lib/browser-storage";
import { SCALE_DISCLAIMER, minutesFor } from "@/lib/scales/disclaimer";
import { scoreScale } from "@/lib/scales/score";
import {
  clearScale,
  parseProgress,
  parseResult,
  progressKey,
  readRaw,
  resultKey,
  writeProgress,
  writeResult,
  type SavedResult,
} from "@/lib/scales/storage";
import type { Scale } from "@/lib/scales/types";
import { LockIcon } from "../icons";
import { RightsNotice } from "./RightsNotice";
import { ScaleResultView } from "./ScaleResultView";
import { SourceNote } from "./SourceNote";

type View = { name: "intro" } | { name: "ask"; index: number } | { name: "result" };

interface State {
  view: View;
  /** the questionnaire being filled in: one value per item, null where not answered yet */
  answers: (number | null)[];
  /** the last finished questionnaire, if any */
  saved: SavedResult | null;
}

/** How long the chosen answer shows before the next question comes. */
const ADVANCE_MS = 220;

const never = () => () => undefined;
const alwaysTrue = () => true;

/**
 * Answer a scale one statement at a time and see the result. Everything is kept in this browser's storage:
 * the questionnaire as it is filled in (so that closing the tab loses nothing) and the last result.
 */
export function ScaleRunner({ scale }: { scale: Scale }) {
  // The server cannot know what is in this browser's storage, so it renders the introduction; once the page is
  // in the browser it is swapped for the questionnaire that starts from what was saved.
  const inBrowser = useSyncExternalStore(never, alwaysTrue, () => false);
  return inBrowser ? <Session scale={scale} /> : <Intro scale={scale} answered={0} headingRef={null} />;
}

function load(scale: Scale): State {
  const storage = browserStorage();
  const saved = parseResult(scale, readRaw(storage, resultKey(scale.id)));
  if (saved) return { view: { name: "result" }, answers: saved.answers, saved };
  const progress = parseProgress(scale, readRaw(storage, progressKey(scale.id)));
  return { view: { name: "intro" }, answers: progress?.answers ?? scale.items.map(() => null), saved: null };
}

const blank = (scale: Scale) => scale.items.map(() => null);
const answeredIn = (answers: (number | null)[]) => answers.filter((answer) => answer !== null).length;

function Session({ scale }: { scale: Scale }) {
  const [state, setState] = useState(() => load(scale));
  const { view, answers, saved } = state;
  const last = scale.items.length - 1;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // After the page changes from introduction to question to result, a screen reader is taken to the new heading.
  // Not on the first render, and not from one question to the next.
  const shownView = useRef(view.name);
  useEffect(() => {
    if (shownView.current === view.name) return;
    shownView.current = view.name;
    headingRef.current?.focus();
  }, [view.name]);

  const go = (next: View, nextAnswers = answers) => {
    clearTimeout(timer.current);
    setState((previous) => ({ ...previous, view: next, answers: nextAnswers }));
    if (next.name === "ask") writeProgress(browserStorage(), scale, { answers: nextAnswers, index: next.index });
    window.scrollTo({ top: 0 });
  };

  const choose = (index: number, value: number, advance: boolean) => {
    clearTimeout(timer.current);
    const next = answers.map((answer, position) => (position === index ? value : answer));
    setState((previous) => ({ ...previous, answers: next }));
    writeProgress(browserStorage(), scale, { answers: next, index });
    if (advance && index < last) timer.current = setTimeout(() => go({ name: "ask", index: index + 1 }, next), ADVANCE_MS);
  };

  const finish = () => {
    const result = scoreScale(scale, answers);
    if (!result.complete) return go({ name: "ask", index: result.missing[0] - 1 });
    const finished = answers as number[];
    const now = Date.now();
    writeResult(browserStorage(), scale, finished, now);
    setState({ view: { name: "result" }, answers: finished, saved: { answers: finished, finishedAt: now } });
    window.scrollTo({ top: 0 });
  };

  const start = (from: "resume" | "fresh") => {
    if (from === "fresh") {
      clearScale(browserStorage(), scale.id);
      return go({ name: "ask", index: 0 }, blank(scale));
    }
    const firstOpen = answers.findIndex((answer) => answer === null);
    go({ name: "ask", index: firstOpen === -1 ? last : firstOpen });
  };

  if (view.name === "result" && saved) {
    return (
      <ScaleResultView
        scale={scale}
        saved={saved}
        headingRef={headingRef}
        onReview={(index) => go({ name: "ask", index }, saved.answers)}
        onRetake={() => {
          clearScale(browserStorage(), scale.id);
          setState({ view: { name: "ask", index: 0 }, answers: blank(scale), saved: null });
          window.scrollTo({ top: 0 });
        }}
        onClear={() => {
          clearScale(browserStorage(), scale.id);
          setState({ view: { name: "intro" }, answers: blank(scale), saved: null });
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (view.name === "ask") {
    return (
      <Question
        scale={scale}
        index={view.index}
        answers={answers}
        headingRef={headingRef}
        onChoose={choose}
        onGo={(index) => go({ name: "ask", index })}
        onExit={() => go(saved ? { name: "result" } : { name: "intro" })}
        onFinish={finish}
      />
    );
  }

  return (
    <Intro
      scale={scale}
      answered={saved ? 0 : answeredIn(answers)}
      headingRef={headingRef}
      onStart={start}
    />
  );
}

function Intro({
  scale,
  answered,
  headingRef,
  onStart,
}: {
  scale: Scale;
  /** how many statements are already answered, from an earlier visit */
  answered: number;
  headingRef: React.Ref<HTMLHeadingElement> | null;
  onStart?: (from: "resume" | "fresh") => void;
}) {
  const count = scale.items.length;
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        开始之前
      </h2>
      <RightsNotice scale={scale} />
      <p className="mt-4 text-muted">{scale.summary}</p>
      <p className="mt-3 flex flex-wrap gap-2">
        <span className="chip">{count} 道题</span>
        <span className="chip">约 {minutesFor(count)} 分钟</span>
        <span className="chip">一次一题，可以回头改</span>
      </p>

      <div className="mt-5 space-y-3 leading-7">
        {scale.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-xl bg-sunken p-3.5 text-sm leading-6 text-muted">
        <LockIcon className="mt-1 size-4 shrink-0" />
        <span>作答和结果只保存在这台设备的浏览器里，不上传，也不需要登录；清除浏览器数据会一并清掉。</span>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {answered > 0 ? (
          <>
            <button type="button" className="btn btn-primary" onClick={() => onStart?.("resume")}>
              继续作答（已答 {answered} / {count}）
            </button>
            <button type="button" className="btn" onClick={() => onStart?.("fresh")}>
              重新开始
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!onStart} onClick={() => onStart?.("fresh")}>
            开始作答
          </button>
        )}
      </div>

      <p className="mt-8 text-sm leading-7 text-muted">{SCALE_DISCLAIMER}</p>
      <div className="mt-3">
        <SourceNote scale={scale} />
      </div>
    </div>
  );
}

function Question({
  scale,
  index,
  answers,
  headingRef,
  onChoose,
  onGo,
  onExit,
  onFinish,
}: {
  scale: Scale;
  index: number;
  answers: (number | null)[];
  headingRef: React.Ref<HTMLHeadingElement>;
  onChoose: (index: number, value: number, advance: boolean) => void;
  onGo: (index: number) => void;
  onExit: () => void;
  onFinish: () => void;
}) {
  const count = scale.items.length;
  const item = scale.items[index];
  const current = answers[index];
  const answered = answeredIn(answers);
  const onLast = index === count - 1;

  // The number keys choose an answer, for those with a keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const option = scale.options[Number(event.key) - 1];
      if (option) onChoose(index, option.value, true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scale, index, onChoose]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn btn-quiet btn-sm -ml-2" onClick={onExit}>
          ‹ 先到这儿
        </button>
        <p className="text-sm tabular-nums text-muted" aria-live="polite">
          第 {index + 1} 题 / 共 {count} 题
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="作答进度"
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={answered}
        aria-valuetext={`已答 ${answered} 题，共 ${count} 题`}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${(answered / count) * 100}%` }} />
      </div>

      <section className="card mt-5 p-5 sm:p-7" aria-labelledby="statement">
        <p className="text-sm text-muted">{scale.prompt}</p>
        <h2 id="statement" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-semibold leading-snug">
          {item.text}
        </h2>
        <div role="group" aria-labelledby="statement" className="mt-6 grid gap-2.5">
          {scale.options.map((option, position) => {
            const chosen = current === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={chosen}
                // a tap or a click moves on by itself; the keyboard (detail 0) chooses and waits for "下一题"
                onClick={(event) => onChoose(index, option.value, event.detail > 0)}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                  chosen ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface hover:bg-sunken"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums ${
                    chosen ? "border-accent bg-accent text-accent-ink" : "border-line text-muted"
                  }`}
                >
                  {position + 1}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 hidden text-xs text-muted sm:block">也可以按键盘上的数字键 1–{scale.options.length} 选择。</p>
      </section>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className="btn" disabled={index === 0} onClick={() => onGo(index - 1)}>
          上一题
        </button>
        {onLast ? (
          <button type="button" className="btn btn-primary" disabled={current === null} onClick={onFinish}>
            查看结果
          </button>
        ) : (
          <button type="button" className="btn" disabled={current === null} onClick={() => onGo(index + 1)}>
            下一题
          </button>
        )}
      </div>
    </div>
  );
}
