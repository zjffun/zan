import { parseClock } from "../time";
import type { ChipAttrs } from "./schema";

/**
 * "@12:34" written out in running text. The editor turns it into a time label when it is typed
 * followed by a space, but that cannot catch text that was pasted, typed through an input method
 * (which swallows the space, and writes "：" for ":"), or saved before the rule existed. So the same
 * marks are also recognised in saved text (sanitizeDoc), and on paste.
 */
const CLOCK = String.raw`(?:\d{1,2}[:：])?\d{1,3}[:：][0-5]\d`;
// no look-behind: older Safari refuses to even parse one. The character before is checked below.
const MARK = String.raw`@(${CLOCK})(?![\d:：])`;

export interface TimeMark {
  /** where the mark starts in the text, and how long it is */
  index: number;
  length: number;
  chip: ChipAttrs;
}

/** Marks in `text`, in order. A mark glued to the end of a word ("name@4:16", "E5@4:16") is not a mark. */
export function findTimeMarks(text: string): TimeMark[] {
  const marks: TimeMark[] = [];
  for (const match of text.matchAll(new RegExp(MARK, "gi"))) {
    const index = match.index ?? 0;
    if (index > 0 && /[A-Za-z0-9_]/.test(text[index - 1])) continue;
    const t = parseClock(match[1].replace(/：/g, ":"));
    if (t === null) continue;
    marks.push({ index, length: match[0].length, chip: { t } });
  }
  return marks;
}

export type TextPiece = { text: string } | { chip: ChipAttrs };

/** `text` cut into plain pieces and the position labels hiding in it. */
export function splitTimeMarks(text: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  let at = 0;
  for (const mark of findTimeMarks(text)) {
    if (mark.index > at) pieces.push({ text: text.slice(at, mark.index) });
    pieces.push({ chip: mark.chip });
    at = mark.index + mark.length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at) });
  return pieces;
}
