import { renderDocHtml } from "./doc/render";
import { sanitizeComment, type DocNode } from "./doc/schema";

/** A comment from before the editor (no document): each line of its text is a paragraph. */
function plainTextDoc(text: string): DocNode {
  return {
    type: "doc",
    content: text.split("\n").map((line): DocNode => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}

/** The clean editor document for a stored comment, including comments from before rich text existed. */
export function commentDocument(comment: { body: string; doc: unknown }): DocNode {
  if (comment.doc !== null) {
    try {
      return sanitizeComment(comment.doc);
    } catch {
      // A malformed historical value is still editable as the plain-text body.
    }
  }
  return plainTextDoc(comment.body);
}

/**
 * A comment as HTML, on the server, from the whitelist only. `seekable`: the post has a player that a
 * time label can jump (see RenderOptions).
 */
export function commentHtml(comment: { body: string; doc: unknown }, seekable: boolean): string {
  return renderDocHtml(commentDocument(comment), { seekable });
}
