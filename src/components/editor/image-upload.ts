import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { MAX_POST_IMAGES } from "@/lib/image";
import { uploadImage, type UploadedImage } from "./compress-image";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageUpload: {
      /** Shrinks, uploads and inserts pictures at the cursor. */
      uploadImages: (files: File[]) => ReturnType;
    };
  }
}

export interface ImageUploadOptions {
  /** how many uploads are running (0 = idle): the post must not be published while it is above 0 */
  onBusyChange?: (running: number) => void;
  /** a message that can be shown to the user */
  onError?: (message: string) => void;
  upload?: (file: File) => Promise<UploadedImage>;
}

const placeholders = new PluginKey<DecorationSet>("imageUploadPlaceholders");

const isImage = (file: File) => file.type.startsWith("image/");

function placeholderElement(count: number) {
  const element = document.createElement("div");
  element.className = "upload-placeholder";
  element.setAttribute("role", "status");
  element.textContent = count > 1 ? `正在上传 ${count} 张图片…` : "正在上传图片…";
  return element;
}

function countImages(view: EditorView): number {
  let count = 0;
  view.state.doc.descendants((node) => {
    if (node.type.name === "image") count++;
  });
  return count;
}

/**
 * Pictures from the clipboard (Cmd/Ctrl+V), from a drop and from the file picker. While a batch
 * uploads, a placeholder sits where it will go (and moves with the text around it); when every
 * file has finished, the ones that worked are put there, in order, and the ones that failed are
 * reported. Text that comes with the clipboard wins over a picture (copying cells from a
 * spreadsheet puts both on the clipboard).
 */
export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: "imageUpload",

  addOptions() {
    return { upload: uploadImage };
  },

  addStorage() {
    return { running: 0 };
  },

  addCommands() {
    return {
      uploadImages:
        (files) =>
        ({ editor }) => {
          if (files.length === 0) return false;
          startBatch(editor.view, files, editor.state.selection.from, { options: this.options, storage: this.storage });
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension: Context = { options: this.options, storage: this.storage };
    return [
      new Plugin<DecorationSet>({
        key: placeholders,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const action = tr.getMeta(placeholders) as
              | { add: { id: object; pos: number; count: number } }
              | { remove: { id: object } }
              | undefined;
            if (action && "add" in action) {
              next = next.add(tr.doc, [
                Decoration.widget(action.add.pos, () => placeholderElement(action.add.count), { id: action.add.id, side: -1 }),
              ]);
            } else if (action && "remove" in action) {
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === action.remove.id));
            }
            return next;
          },
        },
        props: {
          decorations: (state) => placeholders.getState(state),

          handlePaste(view, event) {
            const data = event.clipboardData;
            if (!data) return false;
            const files = Array.from(data.files).filter(isImage);
            if (files.length === 0) return false;
            // a spreadsheet, a Word document: the text is what was copied, the picture is only its preview
            if (data.getData("text/plain").trim()) return false;
            event.preventDefault();
            startBatch(view, files, view.state.selection.from, extension);
            return true;
          },

          handleDrop(view, event, _slice, moved) {
            if (moved) return false; // moving something around inside the editor
            const files = Array.from(event.dataTransfer?.files ?? []);
            if (files.length === 0) return false;
            event.preventDefault(); // otherwise the browser would open the file
            const images = files.filter(isImage);
            if (images.length === 0) {
              extension.options.onError?.("只能放入图片文件。");
              return true;
            }
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            startBatch(view, images, at?.pos ?? view.state.selection.from, extension);
            return true;
          },
        },
      }),
    ];
  },
});

interface Context {
  options: ImageUploadOptions;
  storage: { running: number };
}

function startBatch(view: EditorView, requested: File[], pos: number, extension: Context) {
  const { options, storage } = extension;
  const room = MAX_POST_IMAGES - countImages(view) - storage.running; // pictures already in, plus those still on their way
  if (room <= 0) {
    options.onError?.(`每条内容最多 ${MAX_POST_IMAGES} 张图片。`);
    return;
  }
  const files = requested.slice(0, room);
  if (files.length < requested.length) options.onError?.(`每条内容最多 ${MAX_POST_IMAGES} 张图片，多出来的没有上传。`);

  const id = {};
  view.dispatch(view.state.tr.setMeta(placeholders, { add: { id, pos, count: files.length } }));
  storage.running += files.length;
  options.onBusyChange?.(storage.running);

  const upload = options.upload ?? uploadImage;
  void Promise.allSettled(files.map((file) => upload(file))).then((results) => {
    storage.running -= files.length;
    options.onBusyChange?.(storage.running);
    if (view.isDestroyed) return;

    const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "上传失败。"] : []));
    if (failures.length > 0) options.onError?.([...new Set(failures)].join(" "));

    const found = placeholders.getState(view.state)?.find(undefined, undefined, (spec) => spec.id === id)[0];
    const tr = view.state.tr.setMeta(placeholders, { remove: { id } });
    const type = view.state.schema.nodes.image;
    const nodes = results.flatMap((result) =>
      result.status === "fulfilled"
        ? [type.create({ key: result.value.key, width: result.value.width ?? null, height: result.value.height ?? null })]
        : [],
    );
    if (found && nodes.length > 0) tr.replaceWith(found.from, found.from, nodes);
    view.dispatch(tr.scrollIntoView());
  });
}
