import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import { parseClock } from "@/lib/time";
import { cleanChipAttrs, type ChipAttrs } from "@/lib/doc/schema";
import { chipLabel } from "@/lib/doc/text";

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

const TIME = String.raw`((?:\d{1,2}:)?\d{1,3}:[0-5]\d)`;

/**
 * Inline, atomic "anchor chip": a clickable 12:34 / p.132 / E5 12:34 label that
 * points into the work. It is created by the Alt+T shortcut, the "record time"
 * button, or by typing @12:34, p.132 or E5@12:34 followed by a space.
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

  addInputRules() {
    const nodeType = this.type;
    const rule = (find: RegExp, attrs: (m: RegExpMatchArray) => ChipAttrs | null) =>
      new InputRule({
        find,
        handler: ({ state, range, match }) => {
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
      // E5@12:34 must come before the plain @12:34 rule, which would also match its tail
      rule(new RegExp(String.raw`\bE(\d{1,4})@${TIME}\s$`, "i"), (m) => {
        const t = parseClock(m[2]);
        return t === null ? null : { ep: Number(m[1]), t };
      }),
      rule(new RegExp(String.raw`@${TIME}\s$`), (m) => {
        const t = parseClock(m[1]);
        return t === null ? null : { t };
      }),
      rule(/\bp\.(\d{1,5})\s$/i, (m) => ({ page: Number(m[1]) })),
    ];
  },
});
