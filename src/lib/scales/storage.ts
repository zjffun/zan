import type { KeyValueStorage } from "../browser-storage";
import { cleanAnswers } from "./score";
import type { Scale } from "./types";

/**
 * What a reader has answered, kept in this browser (and only there; it is never sent anywhere): the
 * questionnaire in progress, so that closing the tab does not lose it, and the last finished result.
 * What is read back is checked like anything else that comes from outside: it must be the same version of
 * the same scale, and every value must still be one of the answers on offer.
 */

/** A questionnaire left unfinished for this long is forgotten. */
export const PROGRESS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const PREFIX = "zan:scale:";
export const progressKey = (scaleId: string) => `${PREFIX}${scaleId}:progress`;
export const resultKey = (scaleId: string) => `${PREFIX}${scaleId}:result`;

export interface Progress {
  /** one value per item, null where not answered yet */
  answers: (number | null)[];
  /** the question the reader was on */
  index: number;
  /** milliseconds since 1970 */
  savedAt: number;
}

export interface SavedResult {
  /** one value per item: only a complete questionnaire is saved as a result */
  answers: number[];
  /** milliseconds since 1970 */
  finishedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function parse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/** `now` is for tests; the clock is read only once there is something saved to date (not while the server prerenders a page that shows this). */
export function parseProgress(scale: Scale, raw: string | null, now?: number): Progress | null {
  const value = parse(raw);
  if (!value || value.v !== 1 || value.version !== scale.version || typeof value.savedAt !== "number") return null;
  if ((now ?? Date.now()) - value.savedAt > PROGRESS_MAX_AGE_MS) return null;
  const answers = cleanAnswers(scale, value.answers);
  if (answers.every((answer) => answer === null)) return null;
  const index = typeof value.index === "number" && Number.isInteger(value.index) ? value.index : 0;
  return { answers, index: Math.min(Math.max(index, 0), scale.items.length - 1), savedAt: value.savedAt };
}

export function parseResult(scale: Scale, raw: string | null): SavedResult | null {
  const value = parse(raw);
  if (!value || value.v !== 1 || value.version !== scale.version || typeof value.finishedAt !== "number") return null;
  const answers = cleanAnswers(scale, value.answers);
  return answers.every((answer): answer is number => answer !== null) ? { answers, finishedAt: value.finishedAt } : null;
}

/** The raw text kept for a key, or null (nothing saved, or storage is not available). */
export function readRaw(storage: KeyValueStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

// Pages that show what is saved (the list of scales) listen, so that they are right the moment
// a questionnaire in another part of the page, or another tab, changes it.
const listeners = new Set<() => void>();

/** For useSyncExternalStore: called after anything saved here changes, in this tab or another. */
export function subscribeScaleStorage(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const changed = () => listeners.forEach((notify) => notify());

/** Never throws: a full or blocked storage just means nothing is kept. */
function quietly(action: () => void) {
  try {
    action();
  } catch {
    // no storage, or no room: what is kept here is a convenience
  }
  changed();
}

export function writeProgress(storage: KeyValueStorage, scale: Scale, progress: Omit<Progress, "savedAt">, now = Date.now()): void {
  quietly(() => {
    if (progress.answers.every((answer) => answer === null)) storage.removeItem(progressKey(scale.id));
    else storage.setItem(progressKey(scale.id), JSON.stringify({ v: 1, version: scale.version, ...progress, savedAt: now }));
  });
}

/** Saves a finished questionnaire as the result and forgets the one in progress. */
export function writeResult(storage: KeyValueStorage, scale: Scale, answers: number[], now = Date.now()): void {
  quietly(() => {
    storage.setItem(resultKey(scale.id), JSON.stringify({ v: 1, version: scale.version, answers, finishedAt: now }));
    storage.removeItem(progressKey(scale.id));
  });
}

/** Forgets everything kept for a scale. */
export function clearScale(storage: KeyValueStorage, scaleId: string): void {
  quietly(() => {
    storage.removeItem(progressKey(scaleId));
    storage.removeItem(resultKey(scaleId));
  });
}
