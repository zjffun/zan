import type { DocNode } from "./schema";

export interface ImageAttrs {
  key: string;
  alt?: string;
  width?: number;
  height?: number;
}

/** Every image in a (sanitized) document, in reading order. */
export function collectImages(doc: DocNode): ImageAttrs[] {
  const found: ImageAttrs[] = [];
  const walk = (node: DocNode) => {
    if (node.type === "image" && node.attrs) found.push(node.attrs as unknown as ImageAttrs);
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return found;
}
