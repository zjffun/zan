import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/core";
import { AnchorChip } from "./anchor-chip";
import { BreaksAreParagraphs } from "./breaks-are-paragraphs";
import { ImageUpload } from "./image-upload";
import { PostImage } from "./post-image";
import { QuoteExit } from "./quote-exit";

export interface ExtensionOptions {
  /**
   * What it is for. A comment has no headings, rules or pictures (the server's comment whitelist has none either).
   * Anything the editor is able to make, the server's whitelist keeps: that is what tests/editor.test.ts checks.
   */
  variant?: "note" | "comment";
  placeholder?: string;
  onTimeShortcut?: () => void;
  onUploadingChange?: (running: number) => void;
  onUploadError?: (message: string) => void;
}

/** The node and mark types of the editor: only what `sanitizeDoc` / `sanitizeComment` accept. */
export function buildExtensions({ variant = "note", placeholder, onTimeShortcut, onUploadingChange, onUploadError }: ExtensionOptions = {}): Extensions {
  const comment = variant === "comment";
  return [
    StarterKit.configure({
      ...(comment ? { heading: false, horizontalRule: false } : { heading: { levels: [1, 2] } }),
      underline: false,
      link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
    }),
    Placeholder.configure({ placeholder: placeholder ?? "写点什么… 输入 @12:34 加空格，会变成可点击的时间标签" }),
    AnchorChip.configure({ onTimeShortcut }),
    QuoteExit,
    BreaksAreParagraphs,
    ...(comment ? [] : [PostImage, ImageUpload.configure({ onBusyChange: onUploadingChange, onError: onUploadError })]),
  ];
}
