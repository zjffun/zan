import { describe, expect, it } from "vitest";
import { sniffImage } from "@/lib/image-sniff";

const bytes = (...parts: (number | string | number[])[]) =>
  Uint8Array.from(
    parts.flatMap((part) => (typeof part === "number" ? [part] : typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)),
  );
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const filler = (n: number) => new Array<number>(n).fill(0);

const png = (w: number, h: number) =>
  bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(w), be32(h), [8, 6, 0, 0, 0], filler(8));
const gif = (w: number, h: number) => bytes("GIF89a", le16(w), le16(h), [0xf7, 0, 0], filler(4));
const jpeg = (w: number, h: number) =>
  bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), "JFIF", filler(10), [0xff, 0xc0], be16(17), [8], be16(h), be16(w), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xda], filler(8));
const webpX = (w: number, h: number) =>
  bytes("RIFF", filler(4), "WEBP", "VP8X", le16(10), [0, 0], filler(4), le24(w - 1), le24(h - 1));
const webpLossy = (w: number, h: number) =>
  bytes("RIFF", filler(4), "WEBP", "VP8 ", filler(4), [0, 0, 0], [0x9d, 0x01, 0x2a], le16(w), le16(h), filler(4));
const webpLossless = (w: number, h: number) => {
  const packed = (w - 1) + (h - 1) * 2 ** 14;
  return bytes("RIFF", filler(4), "WEBP", "VP8L", filler(4), [0x2f], [packed & 255, (packed >>> 8) & 255, (packed >>> 16) & 255, (packed >>> 24) & 255], filler(4));
};

describe("sniffImage", () => {
  it("reads the type and size of each supported format", () => {
    expect(sniffImage(png(640, 480))).toEqual({ type: "image/png", extension: "png", width: 640, height: 480 });
    expect(sniffImage(gif(320, 200))).toEqual({ type: "image/gif", extension: "gif", width: 320, height: 200 });
    expect(sniffImage(jpeg(1600, 900))).toEqual({ type: "image/jpeg", extension: "jpg", width: 1600, height: 900 });
    expect(sniffImage(webpX(1024, 768))).toEqual({ type: "image/webp", extension: "webp", width: 1024, height: 768 });
    expect(sniffImage(webpLossy(800, 600))).toEqual({ type: "image/webp", extension: "webp", width: 800, height: 600 });
    expect(sniffImage(webpLossless(1234, 5678))).toEqual({ type: "image/webp", extension: "webp", width: 1234, height: 5678 });
  });

  it("finds the size of a JPEG after other segments (thumbnails, comments, tables)", () => {
    const withComment = bytes([0xff, 0xd8], [0xff, 0xfe], be16(6), "abcd", [0xff, 0xdb], be16(4), [0, 0], [0xff, 0xc2], be16(11), [8], be16(10), be16(20), [1, 1, 0x11, 0], filler(4));
    expect(sniffImage(withComment)).toMatchObject({ type: "image/jpeg", width: 20, height: 10 });
  });

  it("rejects what is not a picture, whatever it calls itself", () => {
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(bytes("<!doctype html><html><body>hi</body></html>"))).toBeNull();
    expect(sniffImage(bytes("GIF89"))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
    expect(sniffImage(bytes("RIFF", filler(4), "WAVE", "fmt ", filler(20)))).toBeNull();
  });

  it("rejects truncated files and zero-sized ones", () => {
    expect(sniffImage(png(10, 10).slice(0, 20))).toBeNull();
    expect(sniffImage(jpeg(10, 10).slice(0, 12))).toBeNull();
    expect(sniffImage(png(0, 10))).toBeNull();
    expect(sniffImage(gif(10, 0))).toBeNull();
    // a JPEG that starts scanning before it ever said how big it is
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xda], filler(20)))).toBeNull();
  });
});
