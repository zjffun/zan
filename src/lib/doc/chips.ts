import type { DocNode } from "./schema";

/** The time of the first time label in a (sanitized) document, or undefined when it has none. */
export function firstChipTime(doc: DocNode): number | undefined {
  if (doc.type === "anchorChip" && typeof doc.attrs?.t === "number") return doc.attrs.t;
  for (const child of doc.content ?? []) {
    const found = firstChipTime(child);
    if (found !== undefined) return found;
  }
  return undefined;
}
