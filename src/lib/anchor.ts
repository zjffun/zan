import { z } from "zod";
import { formatTimestamp, MAX_SECONDS } from "./time";

/** What you say about a position stays a remark or a citation, never a reproduction: keep it short. */
export const MAX_NOTE_LENGTH = 200;
/** A post can point at this many positions. */
export const MAX_POSITIONS = 20;

/** Code points, to agree with Postgres' char_length() check on posts.anchors. */
const codePoints = (text: string) => Array.from(text).length;

const seconds = z.number().int().min(0).max(MAX_SECONDS);

/**
 * One shape for every kind of position (a post has a list of them, each with an optional note):
 *   video          {"t":754,"t_end":760,"note":"开场"}
 *   book           {"page":132,"note":"...","chapter":"3","percent":41}
 *   episode        {"ep":5,"t":754}
 */
export const anchorSchema = z
  .object({
    t: seconds.optional(),
    t_end: seconds.optional(),
    ep: z.number().int().min(0).max(9999).optional(),
    page: z.number().int().min(1).max(99999).optional(),
    chapter: z.string().trim().min(1).max(100).optional(),
    percent: z.number().min(0).max(100).optional(),
    note: z
      .string()
      .trim()
      .min(1)
      .refine((q) => codePoints(q) <= MAX_NOTE_LENGTH, {
        message: `note must be at most ${MAX_NOTE_LENGTH} characters`,
      })
      .optional(),
  })
  .strict()
  .refine(
    (a) =>
      a.t !== undefined ||
      a.ep !== undefined ||
      a.page !== undefined ||
      a.chapter !== undefined ||
      a.percent !== undefined,
    { message: "an anchor needs a time, episode, page, chapter or percent" },
  )
  .refine((a) => a.t_end === undefined || (a.t !== undefined && a.t_end >= a.t), {
    message: "t_end needs t and must not be before it",
  });

export type Anchor = z.infer<typeof anchorSchema>;

/** Validates untrusted input. Returns null for "no anchor", throws ZodError otherwise. */
export function parseAnchor(input: unknown): Anchor | null {
  if (input === null || input === undefined) return null;
  return anchorSchema.parse(input);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The positions of a stored post. `anchors` is the list; posts from before the list existed have only
 * the old single `anchor` (whose "quote" is now the "note"), which is used while the list is empty.
 * Entries that do not validate are dropped rather than failing the whole page.
 */
export function readAnchors(anchors: unknown, legacy: unknown = null): Anchor[] {
  if (Array.isArray(anchors) && anchors.length > 0) {
    return anchors.slice(0, MAX_POSITIONS).flatMap((item) => {
      const parsed = anchorSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }
  if (!isRecord(legacy)) return [];
  const { quote, ...rest } = legacy;
  const parsed = anchorSchema.safeParse(quote !== undefined && rest.note === undefined ? { ...rest, note: quote } : legacy);
  return parsed.success ? [parsed.data] : [];
}

/**
 * Short human label: "12:34", "12:34–12:40", "p.132", "E5 12:34", "ch.3", "41%".
 * `rangeSeparator` lets `anchorToText` produce the ASCII form people type.
 */
export function anchorLabel(anchor: Anchor, rangeSeparator = "–"): string {
  const parts: string[] = [];
  if (anchor.ep !== undefined) parts.push(`E${anchor.ep}`);
  if (anchor.t !== undefined) {
    parts.push(
      anchor.t_end !== undefined && anchor.t_end !== anchor.t
        ? `${formatTimestamp(anchor.t)}${rangeSeparator}${formatTimestamp(anchor.t_end)}`
        : formatTimestamp(anchor.t),
    );
  }
  if (anchor.page !== undefined) parts.push(`p.${anchor.page}`);
  if (anchor.chapter !== undefined && anchor.page === undefined) parts.push(`ch.${anchor.chapter}`);
  if (anchor.percent !== undefined && anchor.page === undefined) {
    parts.push(`${Math.round(anchor.percent * 10) / 10}%`);
  }
  return parts.join(" ");
}

/** One label for a whole list of positions: the first one, and how many more there are ("12:34 等 3 处"). */
export function anchorsLabel(anchors: Anchor[]): string {
  if (anchors.length === 0) return "";
  const first = anchorLabel(anchors[0]);
  return anchors.length > 1 ? `${first} 等 ${anchors.length} 处` : first;
}

/** Orders anchors the way you consume the work: episode, then position. */
export function compareAnchors(a: Anchor | null, b: Anchor | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const key = (x: Anchor) => [x.ep ?? 0, x.t ?? x.page ?? x.percent ?? 0] as const;
  const [ae, ap] = key(a);
  const [be, bp] = key(b);
  return ae - be || ap - bp;
}

/** The inverse of `parseAnchorText`: what to put in the position box for an existing anchor. */
export function anchorToText(anchor: Anchor): string {
  return anchorLabel(anchor, "-");
}
