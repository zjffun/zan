import { tagKey } from "./tag-name";
import type { TagRef } from "./types";

/** A tag as the picker lists it. */
export interface PickerTag extends TagRef {
  /** public posts under it; null when it is only here because it is one of mine (the count was not looked up) */
  post_count: number | null;
  /** one of the tags that my own latest posts used */
  mine: boolean;
}

/** How well a name fits what was typed: 0 the same, 1 starts with it, 2 has it somewhere, null not at all. */
export function matchClass(name: string, query: string): 0 | 1 | 2 | null {
  const n = tagKey(name);
  const q = tagKey(query.trim());
  if (!q) return 2;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  return n.includes(q) ? 2 : null;
}

const recentCap = 6;

/**
 * What the tag picker lists, in order.
 *
 * Nothing typed yet: the tags I used most recently (that is what posting again and again under the
 * same tag needs), then the busiest tags of the site to fill the list.
 *
 * Something typed: an exact match first, then names that start with it, then names that have it
 * somewhere; within each, my recent tags before the others, and the others busiest first.
 *
 * `recent`: my tags, latest first. `found`: what the directory found, busiest first (for the typed
 * text, or the busiest tags when nothing is typed).
 */
export function pickerList({
  query,
  recent,
  found,
  limit = 8,
}: {
  query: string;
  recent: PickerTag[];
  found: PickerTag[];
  limit?: number;
}): PickerTag[] {
  const mineOrder = new Map(recent.map((tag, index) => [tag.id, index]));
  const marked = (tag: PickerTag): PickerTag => (mineOrder.has(tag.id) ? { ...tag, mine: true } : { ...tag, mine: false });

  if (!query.trim()) {
    const mine = recent.slice(0, recentCap);
    const taken = new Set(mine.map((tag) => tag.id));
    return [...mine, ...found.filter((tag) => !taken.has(tag.id)).map(marked)].slice(0, limit);
  }

  const seen = new Set(found.map((tag) => tag.id));
  // my recent tags that fit but are not among the busiest the directory returned
  const extra = recent.filter((tag) => !seen.has(tag.id));
  const candidates = [...found.map(marked), ...extra].map((tag, order) => ({ tag, order }));

  return candidates
    .flatMap(({ tag, order }) => {
      const kind = matchClass(tag.name, query);
      return kind === null ? [] : [{ tag, order, kind, mine: mineOrder.get(tag.id) ?? Infinity }];
    })
    .sort((a, b) => a.kind - b.kind || a.mine - b.mine || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.tag);
}
