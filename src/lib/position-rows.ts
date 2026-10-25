import { anchorToText, MAX_NOTE_LENGTH, type Anchor } from "./anchor";
import { parseAnchorText } from "./anchor-text";

/** One line of the composer's position list: what the person typed, before it is checked. */
export interface PositionRow {
  /** only for React keys */
  id: number;
  /** "12:34", "E5 12:34", "p.132" … */
  position: string;
  /** what they have to say about it */
  note: string;
  /** which field should grab the cursor when the row appears */
  focus?: "position" | "note";
}

export const POSITION_HELP = "可以写 12:34、12:34-12:40、E5 12:34、p.132、ch.3 或 41%。";

let lastId = 0;
/** A fresh key for a row. Only React sees it, so it does not matter that the server and the browser count separately. */
export const newRowId = () => ++lastId;

/** Turns saved positions back into rows to edit. */
export function rowsFromAnchors(anchors: Anchor[]): PositionRow[] {
  return anchors.map((anchor) => ({ id: newRowId(), position: anchorToText(anchor), note: anchor.note ?? "" }));
}

/**
 * Checks the rows and turns them into positions. A row with nothing in it is skipped; a row with a
 * description but no position, or a position that cannot be read, is an error that names the row.
 */
export function rowsToAnchors(
  rows: Pick<PositionRow, "position" | "note">[],
): { ok: true; anchors: Anchor[] } | { ok: false; error: string } {
  const anchors: Anchor[] = [];
  for (const [index, row] of rows.entries()) {
    const position = row.position.trim();
    const note = row.note.trim();
    if (!position && !note) continue;

    const nth = `第 ${index + 1} 个位置`;
    if (!position) return { ok: false, error: `${nth}需要填位置，比如 12:34 或 p.132。` };
    const parsed = parseAnchorText(position);
    if (!parsed) return { ok: false, error: `${nth}的格式不对。${POSITION_HELP}` };
    if (Array.from(note).length > MAX_NOTE_LENGTH) {
      return { ok: false, error: `${nth}的描述最多 ${MAX_NOTE_LENGTH} 字。` };
    }
    anchors.push(note ? { ...parsed, note } : parsed);
  }
  return { ok: true, anchors };
}
