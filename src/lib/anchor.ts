import { formatTimestamp } from "./time";

/** Where a time label, a page or an episode points (the parts of it that the application still has a use for). */
export interface Anchor {
  t?: number;
  t_end?: number;
  ep?: number;
  page?: number;
  chapter?: string;
  percent?: number;
}

/** Short human label: "12:34", "12:34–12:40", "p.132", "E5 12:34", "ch.3", "41%". */
export function anchorLabel(anchor: Anchor): string {
  const parts: string[] = [];
  if (anchor.ep !== undefined) parts.push(`E${anchor.ep}`);
  if (anchor.t !== undefined) {
    parts.push(
      anchor.t_end !== undefined && anchor.t_end !== anchor.t
        ? `${formatTimestamp(anchor.t)}–${formatTimestamp(anchor.t_end)}`
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
