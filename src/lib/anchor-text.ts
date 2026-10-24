import { anchorSchema, type Anchor } from "./anchor";
import { parseLink } from "./links/parse";
import { parseClock } from "./time";

const TIME = String.raw`(?:\d{1,2}:)?\d{1,3}:[0-5]\d`;

const RULES: { pattern: RegExp; build: (m: RegExpExecArray) => Partial<Anchor> | null }[] = [
  // E5 / ep5 / 第5集, optionally followed by a time: "E5 12:34", "e5@12:34"
  {
    pattern: new RegExp(String.raw`^(?:e|ep\.?)\s*(\d{1,4})(?:\s*[@\s]\s*(${TIME}))?$`, "i"),
    build: (m) => withEpisode(m[1], m[2]),
  },
  {
    pattern: new RegExp(String.raw`^第\s*(\d{1,4})\s*[集话話](?:\s*[@\s]\s*(${TIME}))?$`),
    build: (m) => withEpisode(m[1], m[2]),
  },
  // 12:34 or 12:34-12:40
  {
    pattern: new RegExp(String.raw`^(${TIME})(?:\s*[-–—~]\s*(${TIME}))?$`),
    build: (m) => {
      const t = parseClock(m[1]);
      const tEnd = m[2] ? parseClock(m[2]) : undefined;
      if (t === null || tEnd === null) return null;
      return tEnd === undefined ? { t } : { t, t_end: tEnd };
    },
  },
  // p.132 / p132 / 132页 / 第132页
  { pattern: /^p\.?\s*(\d{1,5})$/i, build: (m) => ({ page: Number(m[1]) }) },
  { pattern: /^第?\s*(\d{1,5})\s*[页頁]$/, build: (m) => ({ page: Number(m[1]) }) },
  // ch.3 / chapter 3 / 第3章
  { pattern: /^(?:ch\.?|chapter)\s*([\w.-]{1,40})$/i, build: (m) => ({ chapter: m[1] }) },
  { pattern: /^第\s*(\S{1,40}?)\s*章$/, build: (m) => ({ chapter: m[1] }) },
  // 41% (e-books and Kindle report progress as a percentage)
  { pattern: /^(\d{1,3}(?:\.\d+)?)\s*%$/, build: (m) => ({ percent: Number(m[1]) }) },
];

function withEpisode(ep: string, time: string | undefined): Partial<Anchor> | null {
  const t = time ? parseClock(time) : undefined;
  if (t === null) return null;
  return t === undefined ? { ep: Number(ep) } : { ep: Number(ep), t };
}

/**
 * Parses what a person types into the "position" box:
 * `12:34`, `12:34-12:40`, `E5 12:34`, `p.132`, `132页`, `ch.3`, `41%`, or a
 * pasted YouTube/Bilibili link that carries a `?t=` time.
 * Returns null when the text is not a position.
 */
export function parseAnchorText(input: string): Anchor | null {
  const text = input.trim();
  if (!text) return null;

  if (/^(?:https?:\/\/|[\w-]+(?:\.[\w-]+)+\/)/i.test(text)) {
    const link = parseLink(text);
    if ((link?.provider === "youtube" || link?.provider === "bilibili") && link.t) return { t: link.t };
    return null;
  }

  for (const { pattern, build } of RULES) {
    const match = pattern.exec(text);
    if (!match) continue;
    const anchor = build(match);
    const checked = anchor ? anchorSchema.safeParse(anchor) : null;
    return checked?.success ? checked.data : null;
  }
  return null;
}
