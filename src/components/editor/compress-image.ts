import { fitWithin, MAX_UPLOAD_BYTES, TARGET_EDGE } from "@/lib/image";

/** The browser's decoded picture, in whatever form it could get it. */
interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the camera's rotation (EXIF orientation) before it is thrown away below
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // fall through to an <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close() {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** WebP where the browser can write it; otherwise JPEG on a white background (JPEG has no transparency). */
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp?.type === "image/webp") return webp;
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const context = flat.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(canvas, 0, 0);
  return toBlob(flat, "image/jpeg", quality);
}

const SHRINKABLE = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * What gets uploaded: the picture scaled to at most TARGET_EDGE pixels on its long side and
 * re-encoded (WebP, or JPEG where the browser cannot write WebP). Drawing it again also drops
 * everything else the file carried, such as the camera's GPS position. GIFs are sent as they
 * are, because redrawing would freeze the animation.
 *
 * Throws an Error with a message that can be shown to the user.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/gif") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("GIF 太大了（最大 3 MB）。");
    return file;
  }
  if (!SHRINKABLE.has(file.type)) throw new Error("不支持这种图片格式（支持 PNG、JPEG、WebP、GIF）。");

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error("这张图片打不开。");
  }
  const { width, height } = fitWithin(decoded.width, decoded.height, TARGET_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    decoded.close();
    throw new Error("这个浏览器处理不了图片。");
  }
  context.drawImage(decoded.source, 0, 0, width, height);
  decoded.close();

  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await encode(canvas, quality);
    if (!blob) break;
    if (blob.size <= MAX_UPLOAD_BYTES) {
      return new File([blob], `image.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
    }
  }
  throw new Error("图片太大了，压缩后仍超过 3 MB。");
}

export interface UploadedImage {
  key: string;
  width?: number;
  height?: number;
}

/** Shrinks a picture and stores it on the server; resolves with its key. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const prepared = await prepareImage(file);
  const body = new FormData();
  body.set("file", prepared, prepared.name);

  let response: Response;
  try {
    response = await fetch("/api/upload", { method: "POST", body });
  } catch {
    throw new Error("网络出错了，图片没有上传。");
  }
  const data = (await response.json().catch(() => null)) as (Partial<UploadedImage> & { error?: string }) | null;
  if (!response.ok || !data?.key) {
    throw new Error(data?.error ?? (response.status === 413 ? "图片太大了（最大 3 MB）。" : "上传失败，请稍后再试。"));
  }
  return { key: data.key, width: data.width, height: data.height };
}
