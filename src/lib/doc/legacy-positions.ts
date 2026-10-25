import { anchorLabel, type Anchor } from "../anchor";
import { cleanChipAttrs, sanitizeDocOrEmpty, type DocNode } from "./schema";

/**
 * One line of text for a position from the time when a post had a separate list of them: the
 * label, as a clickable label when it is a time (the only thing the editor has a label for, with an
 * episode or page, if it had one, written out in front) and as plain text otherwise (a page, an
 * episode, a time range, a chapter, a percentage), then its description.
 */
function paragraphFor(anchor: Anchor): DocNode {
  const plain =
    anchor.t === undefined || anchor.t_end !== undefined || anchor.chapter !== undefined || anchor.percent !== undefined;
  const chip = plain ? null : cleanChipAttrs({ t: anchor.t });
  const before = anchor.ep !== undefined || anchor.page !== undefined ? `${anchorLabel({ ep: anchor.ep, page: anchor.page })} ` : "";
  const content: DocNode[] = chip
    ? [...(before ? [{ type: "text", text: before }] : []), { type: "anchorChip", attrs: { ...chip } }]
    : [{ type: "text", text: anchorLabel(anchor) }];
  if (anchor.note) content.push({ type: "text", text: ` ${anchor.note}` });
  return { type: "paragraph", content };
}

/**
 * The text of a post for the editor. Posts used to carry their positions in a list of their own,
 * which the editor no longer has, so opening such a post puts them at the top of its text, one per
 * line, where they can be edited or deleted like any other text. Saving then stores them in the
 * text (and an empty list), so nothing is lost and nothing is shown twice.
 */
export function withLegacyPositions(body: unknown, anchors: Anchor[]): DocNode {
  const doc = sanitizeDocOrEmpty(body);
  if (anchors.length === 0) return doc;
  return { type: "doc", content: [...anchors.map(paragraphFor), ...(doc.content ?? [])] };
}
