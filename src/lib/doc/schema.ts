import { MAX_UPLOAD_EDGE, parseImageKey } from "../image";
import { MAX_SECONDS } from "../time";
import { splitTimeMarks } from "./time-marks";

/**
 * The note format is TipTap/ProseMirror JSON, but the server never trusts what
 * the browser sends. Everything that is stored or rendered goes through
 * `sanitizeDoc`, which keeps only the node and mark types below (and only the
 * attributes we know). There is no raw-HTML node, so there is nothing to XSS.
 * Images are the one thing that loads from a URL, so they carry only the key of a file
 * in our own bucket (see lib/image.ts), never an address.
 */

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

export class DocError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocError";
  }
}

export const MAX_DEPTH = 12;
export const MAX_NODES = 5000;
export const MAX_TEXT_NODE_LENGTH = 20_000;

const BLOCKS = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "codeBlock",
  "horizontalRule",
  "image",
] as const;
const INLINES = ["text", "hardBreak", "anchorChip"] as const;

/** node type -> node types allowed as direct children */
const CHILDREN: Record<string, readonly string[]> = {
  doc: BLOCKS,
  paragraph: INLINES,
  heading: INLINES,
  blockquote: BLOCKS,
  bulletList: ["listItem"],
  orderedList: ["listItem"],
  listItem: BLOCKS,
  codeBlock: ["text"],
  horizontalRule: [],
  image: [],
  hardBreak: [],
  anchorChip: [],
  text: [],
};

/** Nodes that are invalid when they end up with no children. */
const NEEDS_CONTENT = new Set(["blockquote", "bulletList", "orderedList", "listItem"]);

export const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Only schemes that cannot run script. Relative URLs are rejected too. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function intIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

export interface ChipAttrs {
  t?: number;
  page?: number;
  ep?: number;
}

/** Clean chip attributes; at least one locator is required. */
export function cleanChipAttrs(attrs: unknown): ChipAttrs | null {
  if (!isRecord(attrs)) return null;
  const chip: ChipAttrs = {};
  const t = intIn(attrs.t, 0, MAX_SECONDS);
  const page = intIn(attrs.page, 1, 99_999);
  const ep = intIn(attrs.ep, 0, 9999);
  if (t !== undefined) chip.t = t;
  if (page !== undefined) chip.page = page;
  if (ep !== undefined) chip.ep = ep;
  return Object.keys(chip).length > 0 ? chip : null;
}

export const MAX_ALT_LENGTH = 200;

/** Clean image attributes; a valid key (one of our own files) is required, the rest is optional. */
export function cleanImageAttrs(attrs: unknown): { key: string; alt?: string; width?: number; height?: number } | null {
  if (!isRecord(attrs) || !parseImageKey(attrs.key)) return null;
  const image: { key: string; alt?: string; width?: number; height?: number } = { key: attrs.key as string };
  if (typeof attrs.alt === "string") {
    const alt = attrs.alt.replace(/\s+/g, " ").trim();
    if (alt) image.alt = Array.from(alt).slice(0, MAX_ALT_LENGTH).join("");
  }
  const width = intIn(attrs.width, 1, MAX_UPLOAD_EDGE);
  const height = intIn(attrs.height, 1, MAX_UPLOAD_EDGE);
  if (width !== undefined && height !== undefined) {
    image.width = width;
    image.height = height;
  }
  return image;
}

function cleanMarks(marks: unknown): DocMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const seen = new Set<string>();
  const out: DocMark[] = [];
  for (const mark of marks) {
    if (!isRecord(mark) || typeof mark.type !== "string") continue;
    if (!ALLOWED_MARKS.has(mark.type) || seen.has(mark.type)) continue;
    if (mark.type === "link") {
      const href = safeHref(isRecord(mark.attrs) ? mark.attrs.href : undefined);
      if (!href) continue;
      out.push({ type: "link", attrs: { href } });
    } else {
      out.push({ type: mark.type });
    }
    seen.add(mark.type);
  }
  return out.length > 0 ? out : undefined;
}

interface Budget {
  nodes: number;
}

function cleanNode(raw: unknown, parent: string, depth: number, budget: Budget): DocNode | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  const type = raw.type;
  if (!(type in CHILDREN) || type === "doc" || !CHILDREN[parent]?.includes(type)) return null;
  if (depth > MAX_DEPTH) throw new DocError("document is nested too deeply");
  if (++budget.nodes > MAX_NODES) throw new DocError("document is too large");

  if (type === "text") {
    if (typeof raw.text !== "string" || raw.text.length === 0) return null;
    if (raw.text.length > MAX_TEXT_NODE_LENGTH) throw new DocError("text node is too long");
    const marks = parent === "codeBlock" ? undefined : cleanMarks(raw.marks);
    return marks ? { type, text: raw.text, marks } : { type, text: raw.text };
  }

  if (type === "anchorChip") {
    const attrs = cleanChipAttrs(raw.attrs);
    return attrs ? { type, attrs: { ...attrs } } : null;
  }

  if (type === "image") {
    const attrs = cleanImageAttrs(raw.attrs);
    return attrs ? { type, attrs } : null;
  }

  const node: DocNode = { type };

  if (type === "heading") {
    const level = isRecord(raw.attrs) ? intIn(raw.attrs.level, 1, 3) : undefined;
    node.attrs = { level: level ?? 1 };
  }
  if (type === "orderedList") {
    const start = isRecord(raw.attrs) ? intIn(raw.attrs.start, 1, 9999) : undefined;
    node.attrs = { start: start ?? 1 };
  }

  const allowed = CHILDREN[type];
  if (allowed.length > 0 && Array.isArray(raw.content)) {
    const content: DocNode[] = [];
    for (const child of raw.content) {
      const clean = cleanNode(child, type, depth + 1, budget);
      if (clean) content.push(clean);
    }
    const children = type === "paragraph" || type === "heading" ? withPositionLabels(content, budget) : content;
    if (children.length > 0) node.content = children;
  }

  if (NEEDS_CONTENT.has(type) && !node.content) return null;
  return node;
}

/**
 * "@4:16" and "E5@4:16" in the text of a paragraph or heading become position labels, as if they had
 * been typed in the editor. Text that is code or a link is left alone.
 */
function withPositionLabels(content: DocNode[], budget: Budget): DocNode[] {
  const out: DocNode[] = [];
  for (const node of content) {
    const plain = node.type === "text" && !node.marks?.some((mark) => mark.type === "code" || mark.type === "link");
    if (!plain || !node.text) {
      out.push(node);
      continue;
    }
    for (const piece of splitTimeMarks(node.text)) {
      if ("chip" in piece) {
        const attrs = cleanChipAttrs(piece.chip);
        if (!attrs) continue;
        if (++budget.nodes > MAX_NODES) throw new DocError("document is too large");
        out.push({ type: "anchorChip", attrs: { ...attrs } });
      } else {
        out.push(node.marks ? { type: "text", text: piece.text, marks: node.marks } : { type: "text", text: piece.text });
      }
    }
  }
  return out;
}

export const EMPTY_DOC: DocNode = { type: "doc", content: [] };

/**
 * Returns a copy of `input` containing only whitelisted nodes, marks and
 * attributes. Throws `DocError` when the root is not a document or when it is
 * absurdly large/deep. Never throws on unknown nodes: they are dropped.
 */
export function sanitizeDoc(input: unknown): DocNode {
  if (!isRecord(input) || input.type !== "doc") throw new DocError("not a document");
  const budget: Budget = { nodes: 0 };
  const content: DocNode[] = [];
  if (Array.isArray(input.content)) {
    for (const child of input.content) {
      const clean = cleanNode(child, "doc", 1, budget);
      if (clean) content.push(clean);
    }
  }
  return { type: "doc", content };
}

/** Same as `sanitizeDoc` but yields an empty document instead of throwing. */
export function sanitizeDocOrEmpty(input: unknown): DocNode {
  try {
    return sanitizeDoc(input);
  } catch {
    return { type: "doc", content: [] };
  }
}
