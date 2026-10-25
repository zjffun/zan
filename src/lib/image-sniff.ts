import { IMAGE_EXTENSION, type ImageType } from "./image";

export interface SniffedImage {
  type: ImageType;
  extension: string;
  width: number;
  height: number;
}

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, text: string) => {
  for (let k = 0; k < text.length; k++) if (b[i + k] !== text.charCodeAt(k)) return false;
  return true;
};

function png(b: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !signature.every((byte, i) => b[i] === byte) || !ascii(b, 12, "IHDR")) return null;
  return { width: be32(b, 16), height: be32(b, 20) };
}

function gif(b: Uint8Array) {
  if (b.length < 10 || !(ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"))) return null;
  return { width: le16(b, 6), height: le16(b, 8) };
}

function jpeg(b: Uint8Array) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff && i < b.length) i++; // fill bytes
    const marker = b[i];
    i++;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // no length
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / scan data before any frame header
    if (i + 2 > b.length) return null;
    const length = be16(b, i);
    // start-of-frame markers carry the size (C4, C8 and CC are not frame headers)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (length < 8 || i + 7 > b.length) return null;
      return { height: be16(b, i + 3), width: be16(b, i + 5) };
    }
    if (length < 2) return null;
    i += length;
  }
  return null;
}

function webp(b: Uint8Array) {
  if (b.length < 16 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  if (ascii(b, 12, "VP8 ")) {
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
  }
  if (ascii(b, 12, "VP8L")) {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    return {
      width: 1 + (b[21] | ((b[22] & 0x3f) << 8)),
      height: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)),
    };
  }
  if (ascii(b, 12, "VP8X")) return b.length < 30 ? null : { width: 1 + le24(b, 24), height: 1 + le24(b, 27) };
  return null;
}

const READERS: [ImageType, (b: Uint8Array) => { width: number; height: number } | null][] = [
  ["image/png", png],
  ["image/jpeg", jpeg],
  ["image/webp", webp],
  ["image/gif", gif],
];

/**
 * What a file really is, judged by its bytes and not by the name or type the client gave:
 * a PNG, JPEG, WebP or GIF with a readable size, or null (SVG, HTML, truncated, anything else).
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  for (const [type, read] of READERS) {
    const size = read(bytes);
    if (size) return size.width > 0 && size.height > 0 ? { type, extension: IMAGE_EXTENSION[type], ...size } : null;
  }
  return null;
}
