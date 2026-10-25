/**
 * Images in posts. They are uploaded to our own storage bucket and referred to by
 * their *key* (`<author id>/<random id>.<ext>`), never by a URL: the document can then
 * not point at anybody else's server (no hotlinking, no tracking pixels), and the same
 * document works in every environment. The browser loads an image from `/media/<key>`,
 * which next.config.ts rewrites to the bucket.
 */

export const IMAGE_BUCKET = "post-images";
export const MAX_POST_IMAGES = 9;
/** The searchable text of a post that is only pictures (the database wants a post to have some text or a video). */
export const IMAGE_ONLY_TEXT = "[图片]";

/** What the server accepts. The browser shrinks pictures to a few hundred KB first. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_EDGE = 4096;
/** The browser scales pictures down to this long edge before uploading. */
export const TARGET_EDGE = 1600;

export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/gif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const IMAGE_EXTENSION: Record<ImageType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY = new RegExp(`^(${UUID})/(${UUID})\\.(webp|jpg|png|gif)$`);

export interface ImageKey {
  /** id of the user who uploaded it */
  owner: string;
  extension: string;
}

/** Splits a key, or returns null when `value` is not exactly one of our keys. */
export function parseImageKey(value: unknown): ImageKey | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const match = KEY.exec(value);
  return match ? { owner: match[1], extension: match[3] } : null;
}

export function newImageKey(owner: string, type: ImageType): string {
  return `${owner}/${crypto.randomUUID()}.${IMAGE_EXTENSION[type]}`;
}

/** Where the browser loads an image from. */
export const mediaPath = (key: string) => `/media/${key}`;

/** Size after scaling so that the longer side is at most `max` (never scales up). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
