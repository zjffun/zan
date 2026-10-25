import { renderDocHtml } from "./doc/render";
import type { DocNode } from "./doc/schema";

/** A comment from before the editor (no document): each line of its text is a paragraph. */
function plainTextDoc(text: string): DocNode {
  return {
    type: "doc",
    content: text.split("\n").map((line): DocNode => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}

/**
 * A comment as HTML, on the server, from the whitelist only. `seekable`: the post has a player that a
 * time label can jump (see RenderOptions).
 */
export function commentHtml(comment: { body: string; doc: unknown }, seekable: boolean): string {
  return renderDocHtml(comment.doc ?? plainTextDoc(comment.body), { seekable });
}
