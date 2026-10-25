import { mergeAttributes, Node } from "@tiptap/core";
import { mediaPath, parseImageKey } from "@/lib/image";

/** The key of one of our pictures from an <img src>, or null for anything else (other sites, other paths). */
function keyFromSrc(src: string | null): string | null {
  if (!src) return null;
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/media/")) return null;
    const key = url.pathname.slice("/media/".length);
    return parseImageKey(key) ? key : null;
  } catch {
    return null;
  }
}

const sizeAttribute = (name: "width" | "height") => ({
  default: null,
  parseHTML: (element: HTMLElement) => {
    const value = Number(element.getAttribute(name));
    return Number.isInteger(value) && value > 0 ? value : null;
  },
  renderHTML: (attributes: Record<string, unknown>) => (attributes[name] ? { [name]: attributes[name] } : {}),
});

/**
 * A picture on its own line. It carries the key of a file in our bucket (see lib/image.ts), not
 * an address: HTML pasted from other sites, with <img> pointing elsewhere, therefore matches
 * nothing and is dropped. Copying a picture from one of our own pages works, because its
 * src is /media/<key>.
 */
export const PostImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element: HTMLElement) => keyFromSrc(element.getAttribute("src")),
        renderHTML: () => ({}), // becomes src, below
      },
      alt: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("alt") || null,
        renderHTML: (attributes: Record<string, unknown>) => ({ alt: (attributes.alt as string | null) ?? "" }),
      },
      width: sizeAttribute("width"),
      height: sizeAttribute("height"),
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (element) => (keyFromSrc((element as HTMLElement).getAttribute("src")) ? null : false),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { src: mediaPath(String(node.attrs.key)) })];
  },
});
