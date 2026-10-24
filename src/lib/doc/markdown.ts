import type { Anchor } from "../anchor";
import { sanitizeDocOrEmpty, safeHref, cleanChipAttrs, type DocNode } from "./schema";
import { chipLabel } from "./text";

export interface MarkdownOptions {
  /** Where a time/page chip should link to (e.g. youtu.be/ID?t=754); null = plain label. */
  chipHref?: (anchor: Anchor) => string | null;
}

/** Escape what would otherwise be read as Markdown syntax inside a line of text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>~|])/g, "\\$1").replace(/^(\s*)([#>+-]|\d+[.)])(\s)/, "$1\\$2$3");
}

function inline(node: DocNode, options: MarkdownOptions): string {
  switch (node.type) {
    case "hardBreak":
      return "  \n";
    case "anchorChip": {
      const chip = cleanChipAttrs(node.attrs);
      const label = chipLabel(node.attrs);
      const href = chip ? options.chipHref?.(chip) : null;
      return href ? `[${label}](${href})` : label;
    }
    case "text": {
      const marks = new Set((node.marks ?? []).map((m) => m.type));
      const text = node.text ?? "";
      let out = marks.has("code") ? "`" + text.replace(/`/g, "'") + "`" : escapeMarkdown(text);
      if (marks.has("bold")) out = `**${out}**`;
      if (marks.has("italic")) out = `*${out}*`;
      if (marks.has("strike")) out = `~~${out}~~`;
      const link = (node.marks ?? []).find((m) => m.type === "link");
      const href = safeHref(link?.attrs?.href);
      if (href) out = `[${out}](${href.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
      return out;
    }
    default:
      return (node.content ?? []).map((c) => inline(c, options)).join("");
  }
}

function block(node: DocNode, options: MarkdownOptions): string {
  const kids = () => (node.content ?? []).map((c) => block(c, options));
  switch (node.type) {
    case "paragraph":
      return (node.content ?? []).map((c) => inline(c, options)).join("");
    case "heading":
      // headings would collide with the export's own structure: use bold
      return `**${(node.content ?? []).map((c) => inline(c, options)).join("")}**`;
    case "blockquote":
      return kids()
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "bulletList":
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, i) => {
          const marker = node.type === "bulletList" ? "-" : `${start + i}.`;
          const body = (item.content ?? []).map((c) => block(c, options)).join("\n\n");
          const [first = "", ...rest] = body.split("\n");
          const pad = " ".repeat(marker.length + 1);
          return [`${marker} ${first}`, ...rest.map((l) => (l ? pad + l : l))].join("\n");
        })
        .join("\n");
    }
    case "codeBlock": {
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
      const fence = "`".repeat(longest + 1);
      return `${fence}\n${code}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    default:
      return "";
  }
}

/** Document -> Markdown. Anchor chips become links via `options.chipHref`. */
export function docToMarkdown(doc: unknown, options: MarkdownOptions = {}): string {
  return (sanitizeDocOrEmpty(doc).content ?? [])
    .map((node) => block(node, options))
    .filter((chunk) => chunk.length > 0)
    .join("\n\n");
}
