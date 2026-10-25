"use client";

/* eslint-disable react-hooks/refs -- "latest ref" pattern: the ref is only read inside event handlers and
   editor callbacks, never to compute what is rendered. It keeps the editor from being rebuilt when
   callback identities change. */

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { EMPTY_DOC, sanitizeDocOrEmpty, safeHref, type ChipAttrs, type DocNode } from "@/lib/doc/schema";
import { chipFromElement } from "@/lib/doc/chip-dom";
import { IMAGE_TYPES, MAX_POST_IMAGES } from "@/lib/image";
import { AnchorChip } from "./anchor-chip";
import { ImageUpload } from "./image-upload";
import { PostImage } from "./post-image";

export interface NoteEditorHandle {
  insertChip(attrs: ChipAttrs): void;
  clear(): void;
  focus(): void;
}

export interface NoteEditorProps {
  initial?: DocNode;
  placeholder?: string;
  autofocus?: boolean;
  ref?: Ref<NoteEditorHandle>;
  onChange?: (doc: DocNode, isEmpty: boolean) => void;
  /** A chip in the editor was clicked: jump there. */
  onChipClick?: (attrs: ChipAttrs) => void;
  /** A chip appeared (typed shortcut or inserted): lets the form adopt it as the note's anchor. */
  onChipAdded?: (attrs: ChipAttrs) => void;
  /** Alt+T */
  onTimeShortcut?: () => void;
  /** Cmd/Ctrl+Enter */
  onSubmit?: () => void;
  /** How many pictures are still uploading; the note must not be saved while it is above 0. */
  onUploadingChange?: (running: number) => void;
}

/**
 * TipTap editor for one note. Only the node/mark types that the server's
 * whitelist (`sanitizeDoc`) accepts are enabled; whatever is pasted that does
 * not fit the schema is dropped by ProseMirror before it ever reaches us.
 */
export function NoteEditor({ ref, ...props }: NoteEditorProps) {
  // callbacks change identity every render; the editor must not be rebuilt for that
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  const initial = useMemo(() => sanitizeDocOrEmpty(props.initial ?? EMPTY_DOC), [props.initial]);
  const [notice, setNotice] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: props.autofocus ? "end" : false,
    content: initial,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        underline: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: props.placeholder ?? "写点什么… 输入 @12:34 或 p.132 加空格，会变成可点击的位置标签" }),
      AnchorChip.configure({ onTimeShortcut: () => latest.current.onTimeShortcut?.() }),
      PostImage,
      ImageUpload.configure({
        onBusyChange: (running) => latest.current.onUploadingChange?.(running),
        onError: (message) => setNotice(message),
      }),
    ],
    editorProps: {
      attributes: { class: "note-body ProseMirror px-3 py-2", "aria-label": "内容", role: "textbox", "aria-multiline": "true" },
      handleDOMEvents: {
        click: (_view, event) => {
          const chip = chipFromElement(event.target);
          if (!chip) return false;
          latest.current.onChipClick?.(chip);
          return true;
        },
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          latest.current.onSubmit?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e, transaction }) => {
      // ProseMirror node attrs are null-prototype objects, which React's Server Action
      // serializer silently drops (chips would arrive without attrs): hand out plain JSON.
      latest.current.onChange?.(JSON.parse(JSON.stringify(e.getJSON())) as DocNode, e.isEmpty);
      // report chips that this transaction introduced
      if (transaction.docChanged) {
        const before = new Set<string>();
        transaction.before.descendants((node) => {
          if (node.type.name === "anchorChip") before.add(JSON.stringify(node.attrs));
        });
        e.state.doc.descendants((node) => {
          if (node.type.name === "anchorChip" && !before.has(JSON.stringify(node.attrs))) {
            latest.current.onChipAdded?.(node.attrs as ChipAttrs);
          }
        });
      }
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      insertChip: (attrs) => {
        editor
          ?.chain()
          .focus()
          .insertContent([
            { type: "anchorChip", attrs: { t: null, page: null, ep: null, ...attrs } },
            { type: "text", text: " " },
          ])
          .run();
      },
      clear: () => {
        editor?.commands.clearContent(true);
      },
      focus: () => {
        editor?.commands.focus("end");
      },
    }),
    [editor],
  );

  return (
    <div className="rounded-lg border border-line bg-surface focus-within:border-accent">
      {editor ? <Toolbar editor={editor} /> : <div className="h-9 border-b border-line" />}
      <EditorContent editor={editor} />
      {notice ? (
        <p role="alert" className="flex items-start gap-2 border-t border-line px-3 py-1.5 text-xs text-danger">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" className="shrink-0 underline underline-offset-2" onClick={() => setNotice(null)}>
            知道了
          </button>
        </p>
      ) : null}
    </div>
  );
}

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>;

function Toolbar({ editor }: { editor: EditorInstance }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      heading: e.isActive("heading"),
    }),
  });
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const button = (label: string, title: string, active: boolean, run: () => void, extra = "") => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
      onClick={run}
      className={`h-7 min-w-7 rounded px-1.5 text-sm ${extra} ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken"}`}
    >
      {label}
    </button>
  );

  function applyLink() {
    const safe = safeHref(href.trim().match(/^[a-z][a-z0-9+.-]*:/i) ? href.trim() : `https://${href.trim()}`);
    if (safe) editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    setLinking(false);
    setHref("");
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
      {button("B", "加粗", state.bold, () => editor.chain().focus().toggleBold().run(), "font-bold")}
      {button("I", "斜体", state.italic, () => editor.chain().focus().toggleItalic().run(), "italic")}
      {button("S", "删除线", state.strike, () => editor.chain().focus().toggleStrike().run(), "line-through")}
      {button("<>", "行内代码", state.code, () => editor.chain().focus().toggleCode().run(), "font-mono text-xs")}
      {button("链接", state.link ? "取消链接" : "添加链接", state.link, () => {
        if (state.link) editor.chain().focus().unsetLink().run();
        else setLinking((v) => !v);
      }, "text-xs")}
      <span className="mx-1 h-4 w-px bg-line" />
      {button("H", "小标题", state.heading, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "font-bold")}
      {button("•", "无序列表", state.bullet, () => editor.chain().focus().toggleBulletList().run())}
      {button("1.", "有序列表", state.ordered, () => editor.chain().focus().toggleOrderedList().run(), "text-xs")}
      {button("❝", "引用", state.quote, () => editor.chain().focus().toggleBlockquote().run())}
      <span className="mx-1 h-4 w-px bg-line" />
      {button("图片", `插入图片（也可以直接粘贴或拖入，最多 ${MAX_POST_IMAGES} 张）`, false, () => fileInput.current?.click(), "text-xs")}
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          editor.chain().focus().uploadImages(Array.from(event.target.files ?? [])).run();
          event.target.value = ""; // lets the same file be picked again
        }}
      />
      {linking ? (
        <form
          className="ml-1 flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            className="input !min-h-7 !w-44 !py-0.5 text-sm"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://"
            aria-label="链接地址"
          />
          <button className="btn btn-sm" type="submit">
            确定
          </button>
        </form>
      ) : null}
    </div>
  );
}
