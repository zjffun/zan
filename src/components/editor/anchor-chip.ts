import { InputRule, Node, PasteRule, mergeAttributes } from "@tiptap/core";
import { parseClock } from "@/lib/time";
import { cleanChipAttrs, type ChipAttrs } from "@/lib/doc/schema";
import { chipLabel } from "@/lib/doc/text";
import { findTimeMarks } from "@/lib/doc/time-marks";

export interface AnchorChipOptions {
  /** Alt+T: put the player's current time into the note. */
  onTimeShortcut?: () => void;
}

const numberAttribute = (name: "t" | "page" | "ep") => ({
  default: null,
  parseHTML: (element: HTMLElement) => {
    const value = element.getAttribute(`data-${name}`);
    return value === null || value === "" ? null : Number(value);
  },
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[name] == null ? {} : { [`data-${name}`]: String(attributes[name]) },
});

// "：" is what Chinese input methods write for ":"
const TIME = String.raw`((?:\d{1,2}[:：])?\d{1,3}[:：][0-5]\d)`;

/**
 * Inline, atomic "anchor chip": a clickable 12:34 label that points into the video.
 * It is created by the Alt+T shortcut, the "record time" button, or by typing @12:34
 * followed by a space. (Page numbers and episodes are plain text.)
 */
export const AnchorChip = Node.create<AnchorChipOptions>({
  name: "anchorChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { onTimeShortcut: undefined };
  },

  addAttributes() {
    return { t: numberAttribute("t"), page: numberAttribute("page"), ep: numberAttribute("ep") };
  },

  parseHTML() {
    return [{ tag: "span[data-anchor-chip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-anchor-chip": "", class: "anchor-chip" }),
      chipLabel(node.attrs),
    ];
  },

  renderText({ node }) {
    return chipLabel(node.attrs);
  },

  addKeyboardShortcuts() {
    return {
      "Alt-t": () => {
        if (!this.options.onTimeShortcut) return false;
        this.options.onTimeShortcut();
        return true;
      },
    };
  },

  /** Pasted text: "@4:16" becomes a label right away (typing is handled by the input rules below). */
  addPasteRules() {
    const nodeType = this.type;
    return [
      new PasteRule({
        find: (text) =>
          findTimeMarks(text).map((mark) => ({
            index: mark.index,
            text: text.slice(mark.index, mark.index + mark.length),
            data: { chip: mark.chip },
          })),
        handler: ({ match, range, chain }) => {
          const chip = (match as unknown as { data?: { chip?: ChipAttrs } }).data?.chip;
          const clean = chip ? cleanChipAttrs(chip) : null;
          if (!clean) return null;
          chain()
            .deleteRange(range)
            .insertContentAt(range.from, { type: nodeType.name, attrs: { t: null, page: null, ep: null, ...clean } });
          return undefined;
        },
      }),
    ];
  },

  addInputRules() {
    const nodeType = this.type;
    const rule = (find: RegExp, attrs: (m: RegExpMatchArray) => ChipAttrs | null) =>
      new InputRule({
        find,
        handler: ({ state, range, match }) => {
          // "name@4:16" or "E5@12:34" is not a time label: it must not be glued to the end of a word
          const at = state.doc.resolve(range.from);
          const before = at.parentOffset > 0 ? at.parent.textBetween(at.parentOffset - 1, at.parentOffset, undefined, "\ufffc") : "";
          if (/[A-Za-z0-9_]/.test(before)) return null;
          const clean = cleanChipAttrs(attrs(match));
          if (!clean) return null;
          // the typed space is consumed by the rule: put one back after the chip
          state.tr.replaceWith(range.from, range.to, [
            nodeType.create({ t: null, page: null, ep: null, ...clean }),
            state.schema.text(" "),
          ]);
          return undefined;
        },
      });

    return [
      rule(new RegExp(String.raw`@${TIME}\s$`), (m) => {
        const t = parseClock(m[1].replace(/：/g, ":"));
        return t === null ? null : { t };
      }),
    ];
  },
});
