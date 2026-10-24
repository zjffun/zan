import { z } from "zod";
import { formatTimestamp, MAX_SECONDS } from "./time";

/** A quote is a citation, not a reproduction: keep it short. */
export const MAX_QUOTE_LENGTH = 200;

/** Code points, to agree with Postgres' char_length() check on notes.anchor. */
const codePoints = (text: string) => Array.from(text).length;

const seconds = z.number().int().min(0).max(MAX_SECONDS);

/**
 * One shape for every kind of anchor:
 *   video          {"t":754,"t_end":760}
 *   book           {"page":132,"quote":"...","chapter":"3","percent":41}
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
    quote: z
      .string()
      .trim()
      .min(1)
      .refine((q) => codePoints(q) <= MAX_QUOTE_LENGTH, {
        message: `quote must be at most ${MAX_QUOTE_LENGTH} characters`,
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
