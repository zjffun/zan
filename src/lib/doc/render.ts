import { mediaPath } from "../image";
import { formatTimestamp } from "../time";
import { cleanImageAttrs, sanitizeDocOrEmpty, type DocNode } from "./schema";
import { chipLabel } from "./text";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const HEADING_TAG: Record<number, string> = { 1: "h3", 2: "h4", 3: "h5" };

function renderText(node: DocNode): string {
  let html = escapeHtml(node.text ?? "");
  // innermost first: code, then emphasis, link outermost
  const order = ["code", "bold", "italic", "strike", "link"];
  const marks = [...(node.marks ?? [])].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const mark of marks) {
    switch (mark.type) {
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "link":
        html = `<a href="${escapeHtml(String(mark.attrs?.href ?? ""))}" target="_blank" rel="noopener noreferrer nofollow ugc">${html}</a>`;
        break;
    }
  }
  return html;
}

function renderNode(node: DocNode): string {
  const children = () => (node.content ?? []).map(renderNode).join("");
  switch (node.type) {
    case "text":
      return renderText(node);
    case "hardBreak":
      return "<br>";
    case "anchorChip": {
      const a = node.attrs ?? {};
      const data = ["t", "page", "ep"]
        .filter((k) => typeof a[k] === "number")
        .map((k) => ` data-${k}="${a[k] as number}"`)
        .join("");
      const label = escapeHtml(chipLabel(a));
      const title = typeof a.t === "number" ? ` title="跳到 ${formatTimestamp(a.t)}"` : "";
      return `<button type="button" class="anchor-chip" data-anchor-chip=""${data}${title}>${label}</button>`;
    }
    case "paragraph":
      return `<p>${children()}</p>`;
    case "heading": {
      const tag = HEADING_TAG[Number(node.attrs?.level)] ?? "h3";
      return `<${tag}>${children()}</${tag}>`;
    }
    case "blockquote":
      return `<blockquote>${children()}</blockquote>`;
    case "bulletList":
      return `<ul>${children()}</ul>`;
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return `<ol${start > 1 ? ` start="${start}"` : ""}>${children()}</ol>`;
    }
    case "listItem":
      return `<li>${children()}</li>`;
    case "codeBlock":
      return `<pre><code>${children()}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const image = cleanImageAttrs(node.attrs);
      if (!image) return "";
      const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
      return `<img src="${escapeHtml(mediaPath(image.key))}" alt="${escapeHtml(image.alt ?? "")}"${size} loading="lazy" decoding="async">`;
    }
    default:
      return "";
  }
}

/**
 * Document -> HTML, server side, from the whitelist only. The result is safe to
 * inject with dangerouslySetInnerHTML: text and attributes are escaped, links
 * are limited to http/https/mailto, and unknown nodes never get this far.
 */
export function renderDocHtml(doc: unknown): string {
  return (sanitizeDocOrEmpty(doc).content ?? []).map(renderNode).join("");
}
