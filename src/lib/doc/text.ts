import { anchorLabel } from "../anchor";
import { cleanChipAttrs, type DocNode } from "./schema";

/** Label of an inline anchor chip, e.g. "12:34" or "p.132". */
export function chipLabel(attrs: object | undefined): string {
  const chip = cleanChipAttrs(attrs);
  return chip ? anchorLabel(chip) : "";
}

/**
 * Plain text of a document, one block per line. This is what gets indexed for
 * search (notes.plain_text), so anchor chips contribute their label too.
 */
export function docToPlainText(doc: DocNode): string {
  const lines: string[] = [];

  const inline = (node: DocNode): string => {
    switch (node.type) {
      case "text":
        return node.text ?? "";
      case "hardBreak":
        return "\n";
      case "anchorChip":
        return chipLabel(node.attrs);
      default:
        return (node.content ?? []).map(inline).join("");
    }
  };

  const block = (node: DocNode) => {
    switch (node.type) {
      case "paragraph":
      case "heading":
      case "codeBlock":
        lines.push(inline(node));
        break;
      case "horizontalRule":
        break;
      default:
        for (const child of node.content ?? []) block(child);
    }
  };

  for (const child of doc.content ?? []) block(child);
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
