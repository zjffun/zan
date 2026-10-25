import { Extension } from "@tiptap/core";

/**
 * Enter at the end of a quoted line starts the next line outside the quote, so that a quote covers
 * the line it was made for and not everything that is typed after it. (By default the quote goes on
 * until Enter is pressed a second time on an empty line, which looks as if the rest of the post had
 * become a quote.) Shift+Enter still breaks the line inside the quote, and the quote button on a
 * selection of several lines quotes them together.
 *
 * Anywhere else in a quote (the middle of a line, a list inside a quote) Enter does what it always does.
 */
export const QuoteExit = Extension.create({
  name: "quoteExit",
  priority: 150, // before the default Enter handling

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        if (!selection.empty || $from.depth < 2) return false;

        const line = $from.parent;
        const inQuote = $from.node($from.depth - 1).type.name === "blockquote";
        const atEnd = $from.parentOffset === line.content.size;
        // an empty line in a quote is left to the default, which already steps out of the quote
        if (!inQuote || line.type.name !== "paragraph" || line.content.size === 0 || !atEnd) return false;

        return editor.chain().splitBlock().liftEmptyBlock().run();
      },
    };
  },
});
