import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "@/lib/browser-storage";
import { getScale } from "@/lib/scales";
import {
  PROGRESS_MAX_AGE_MS,
  clearScale,
  parseProgress,
  parseResult,
  progressKey,
  readRaw,
  resultKey,
  writeProgress,
  writeResult,
} from "@/lib/scales/storage";

const scale = getScale("gad-7")!;
const NOW = Date.UTC(2026, 9, 31, 8, 0, 0);

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const blocked: KeyValueStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("progress", () => {
  const unfinished = [1, 2, null, null, null, null, null];

  it("is kept and read back", () => {
    const storage = memory();
    writeProgress(storage, scale, { answers: unfinished, index: 2 }, NOW);
    expect(parseProgress(scale, readRaw(storage, progressKey(scale.id)), NOW + 1000)).toEqual({ answers: unfinished, index: 2, savedAt: NOW });
  });

  it("keeps each scale apart", () => {
    expect(progressKey("gad-7")).not.toBe(progressKey("phq-9"));
    expect(progressKey("gad-7")).not.toBe(resultKey("gad-7"));
  });

  it("is forgotten when nothing is answered, and when it has been left for a month", () => {
    const storage = memory();
    writeProgress(storage, scale, { answers: unfinished, index: 1 }, NOW);
    writeProgress(storage, scale, { answers: scale.items.map(() => null), index: 0 }, NOW);
    expect(storage.data.size).toBe(0);

    writeProgress(storage, scale, { answers: unfinished, index: 1 }, NOW);
    const raw = readRaw(storage, progressKey(scale.id));
    expect(parseProgress(scale, raw, NOW + PROGRESS_MAX_AGE_MS)).not.toBeNull();
    expect(parseProgress(scale, raw, NOW + PROGRESS_MAX_AGE_MS + 1)).toBeNull();
  });

  it("is dropped when the scale has changed since", () => {
    const storage = memory();
    writeProgress(storage, scale, { answers: unfinished, index: 1 }, NOW);
    expect(parseProgress({ ...scale, version: scale.version + 1 }, readRaw(storage, progressKey(scale.id)), NOW)).toBeNull();
  });

  it("is checked on the way back in", () => {
    const raw = (value: unknown) => JSON.stringify({ v: 1, version: scale.version, savedAt: NOW, index: 0, answers: [1], ...(value as object) });
    expect(parseProgress(scale, "not json", NOW)).toBeNull();
    expect(parseProgress(scale, "[]", NOW)).toBeNull();
    expect(parseProgress(scale, null, NOW)).toBeNull();
    expect(parseProgress(scale, raw({ v: 2 }), NOW)).toBeNull();
    expect(parseProgress(scale, raw({ savedAt: "yesterday" }), NOW)).toBeNull();
    // values that are not answers are dropped, and the question number is kept in range
    expect(parseProgress(scale, raw({ answers: [9, 2, "x"], index: 99 }), NOW)).toEqual({
      answers: [null, 2, null, null, null, null, null],
      index: scale.items.length - 1,
      savedAt: NOW,
    });
    expect(parseProgress(scale, raw({ answers: [2], index: -3 }), NOW)?.index).toBe(0);
    expect(parseProgress(scale, raw({ answers: [2], index: 1.5 }), NOW)?.index).toBe(0);
    expect(parseProgress(scale, raw({ answers: [9, 9] }), NOW)).toBeNull();
  });
});

describe("result", () => {
  const finished = [0, 1, 2, 3, 0, 1, 2];

  it("is kept, and finishing forgets the progress", () => {
    const storage = memory();
    writeProgress(storage, scale, { answers: [1, null, null, null, null, null, null], index: 0 }, NOW);
    writeResult(storage, scale, finished, NOW + 5);
    expect(readRaw(storage, progressKey(scale.id))).toBeNull();
    expect(parseResult(scale, readRaw(storage, resultKey(scale.id)))).toEqual({ answers: finished, finishedAt: NOW + 5 });
  });

  it("does not count unless every answer is valid", () => {
    const raw = (answers: unknown, extra: object = {}) => JSON.stringify({ v: 1, version: scale.version, finishedAt: NOW, answers, ...extra });
    expect(parseResult(scale, raw([0, 1, 2, 3, 0, 1]))).toBeNull();
    expect(parseResult(scale, raw([0, 1, 2, 3, 0, 1, 7]))).toBeNull();
    expect(parseResult(scale, raw(finished, { version: 99 }))).toBeNull();
    expect(parseResult(scale, raw(finished, { finishedAt: null }))).toBeNull();
    expect(parseResult(scale, "{")).toBeNull();
    expect(parseResult(scale, raw(finished))).not.toBeNull();
  });

  it("is forgotten with everything else kept for the scale", () => {
    const storage = memory();
    writeProgress(storage, scale, { answers: [1, null, null, null, null, null, null], index: 0 }, NOW);
    writeResult(storage, scale, finished, NOW);
    writeProgress(storage, scale, { answers: [1, null, null, null, null, null, null], index: 0 }, NOW);
    storage.setItem("zan:scale:phq-9:result", "other scale");
    clearScale(storage, scale.id);
    expect([...storage.data.keys()]).toEqual(["zan:scale:phq-9:result"]);
  });
});

describe("storage that is not available", () => {
  it("never throws", () => {
    expect(() => writeProgress(blocked, scale, { answers: [1, null, null, null, null, null, null], index: 0 })).not.toThrow();
    expect(() => writeResult(blocked, scale, [0, 0, 0, 0, 0, 0, 0])).not.toThrow();
    expect(() => clearScale(blocked, scale.id)).not.toThrow();
    expect(readRaw(blocked, progressKey(scale.id))).toBeNull();
  });
});
