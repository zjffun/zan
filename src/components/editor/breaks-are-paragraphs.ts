import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * Shift+Enter, and a <br> in pasted HTML, make a line break inside a paragraph, which sits tighter than
 * the gap Enter makes between paragraphs. Posts only have the second kind (sanitizeDoc cuts text into
 * paragraphs at every line break), so the editor does the same as soon as one appears: what is shown
 * while writing is what is shown afterwards.
 */
export const BreaksAreParagraphs = Extension.create({
  name: "breaksAreParagraphs",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("breaksAreParagraphs"),
        appendTransaction(transactions, _before, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const breaks: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "hardBreak") breaks.push(pos);
          });
          if (breaks.length === 0) return null;
          const tr = state.tr;
          // from the end, so that the positions still to do do not move
          for (const pos of breaks.reverse()) tr.delete(pos, pos + 1).split(pos);
          return tr;
        },
      }),
    ];
  },
});
