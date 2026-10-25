// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildExtensions } from "@/components/editor/extensions";
import { sanitizeComment, sanitizeDoc, type DocNode } from "@/lib/doc/schema";
import { docToPlainText } from "@/lib/doc/text";

let editors: Editor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors = [];
});

function create(variant: "note" | "comment" = "note", content = ""): Editor {
  const editor = new Editor({ element: document.createElement("div"), extensions: buildExtensions({ variant }), content });
  editors.push(editor);
  return editor;
}

/** Types like a person: each character goes through the editor's text input handlers, which is where input rules live. */
function type(editor: Editor, text: string) {
  for (const char of Array.from(text)) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) => handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to)));
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
  }
}

function press(editor: Editor, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
  return Boolean(editor.view.someProp("handleKeyDown", (handler) => handler(editor.view, event)));
}

/** The document, without the empty paragraph that the editor keeps after a quote, list or code block at the end so that there is somewhere to click. */
const json = (editor: Editor): DocNode => {
  const doc = editor.getJSON() as DocNode;
  const blocks = [...(doc.content ?? [])];
  const last = blocks[blocks.length - 1];
  if (blocks.length > 1 && last?.type === "paragraph" && !last.content) blocks.pop();
  return { ...doc, content: blocks };
};
const kinds = (node: DocNode | undefined) => (node?.content ?? []).map((child) => child.type);
const chips = (editor: Editor) => {
  const found: unknown[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "anchorChip") found.push(node.attrs.t);
  });
  return found;
};

describe("time labels while typing", () => {
  it("turns @12:34 and a space into a label, and keeps the space", () => {
    const editor = create();
    type(editor, "看 @12:34 这里");
    expect(chips(editor)).toEqual([754]);
    expect(editor.getText()).toBe("看 12:34 这里");
  });

  it("does not make a label of what is glued to a word (E5@12:34, name@1:00)", () => {
    const editor = create();
    type(editor, "E5@12:34 和 name@1:00 ");
    expect(chips(editor)).toEqual([]);
    expect(editor.getText()).toBe("E5@12:34 和 name@1:00 ");
  });

  it("makes one after punctuation and at the start of a line", () => {
    const editor = create();
    type(editor, "@0:43 ，然后（@1:05 ");
    expect(chips(editor)).toEqual([43, 65]);
  });

  it("reads what an input method writes: a full-width colon", () => {
    const editor = create();
    type(editor, "@12：34 ");
    expect(chips(editor)).toEqual([754]);
  });

  it("does not make a label of a time that is not one", () => {
    const editor = create();
    type(editor, "@12:75 @1:2 @abc ");
    expect(chips(editor)).toEqual([]);
  });

  it("makes a label of a time in pasted text, not of the glued ones", () => {
    const editor = create();
    editor.view.pasteText("看 @4:16 和 E5@12:34 再 @0:30", new Event("paste") as ClipboardEvent);
    expect(chips(editor)).toEqual([256, 30]);
    expect(editor.getText()).toBe("看 4:16 和 E5@12:34 再 0:30");
  });
});

describe("one kind of line break", () => {
  it("turns Shift+Enter (a hard break) into a new paragraph", () => {
    const editor = create();
    type(editor, "第一行");
    editor.commands.setHardBreak();
    type(editor, "第二行");
    const doc = json(editor);
    expect(kinds(doc)).toEqual(["paragraph", "paragraph"]);
    expect(JSON.stringify(doc)).not.toContain("hardBreak");
  });

  it("does the same for a <br> in pasted HTML", () => {
    const editor = create();
    editor.view.pasteHTML("<p>网页里的第一句。<br>网页里的第二句。</p>", new Event("paste") as ClipboardEvent);
    expect(kinds(json(editor))).toEqual(["paragraph", "paragraph"]);
    expect(editor.getText({ blockSeparator: "\n" })).toBe("网页里的第一句。\n网页里的第二句。");
  });
});

describe("quotes", () => {
  it("Enter at the end of a quoted line starts the next line outside the quote", () => {
    const editor = create();
    type(editor, "引一句");
    editor.commands.toggleBlockquote();
    expect(press(editor, "Enter")).toBe(true);
    type(editor, "接着写");
    expect(kinds(json(editor))).toEqual(["blockquote", "paragraph"]);
    expect(docToPlainText({ type: "doc", content: [json(editor).content![1]] })).toBe("接着写");
  });

  it("Enter in the middle of a quoted line splits it inside the quote, as it always did", () => {
    const editor = create();
    type(editor, "前后");
    editor.commands.toggleBlockquote();
    editor.commands.setTextSelection(editor.state.selection.from - 1);
    press(editor, "Enter");
    expect(kinds(json(editor))).toEqual(["blockquote"]);
    expect(json(editor).content![0].content).toHaveLength(2);
  });
});

describe("what the editor makes is what the server keeps", () => {
  const written = (editor: Editor) => {
    type(editor, "标题行");
    editor.commands.toggleHeading({ level: 2 });
    press(editor, "Enter");
    type(editor, "**粗体** 和 `代码` 和 @1:30 ");
    press(editor, "Enter");
    type(editor, "- 一项");
    press(editor, "Enter");
    type(editor, "二项");
    return json(editor);
  };

  it("for a post", () => {
    const doc = written(create("note"));
    const clean = sanitizeDoc(doc);
    expect(docToPlainText(clean)).toBe(docToPlainText(doc));
    expect(kinds(clean)).toEqual(kinds(doc)); // no block was dropped
    expect(JSON.stringify(clean)).toContain("anchorChip");
    expect(JSON.stringify(clean)).toContain('"bold"');
    expect(JSON.stringify(clean)).toContain('"code"');
  });

  it("for a comment: the same, without the heading it cannot have", () => {
    const editor = create("comment");
    expect(editor.schema.nodes.heading).toBeUndefined();
    expect(editor.schema.nodes.horizontalRule).toBeUndefined();
    expect(editor.schema.nodes.image).toBeUndefined();
    type(editor, "**粗体** 和 @1:30 ");
    press(editor, "Enter");
    type(editor, "> 引用");
    type(editor, "");
    const doc = json(editor);
    const clean = sanitizeComment(doc);
    expect(docToPlainText(clean)).toBe(docToPlainText(doc));
    expect(kinds(clean)).toEqual(kinds(doc));
  });

  it("a post can have headings, rules and pictures, a comment cannot", () => {
    const post = create("note");
    expect(post.schema.nodes.heading).toBeDefined();
    expect(post.schema.nodes.horizontalRule).toBeDefined();
    expect(post.schema.nodes.image).toBeDefined();
  });
});
