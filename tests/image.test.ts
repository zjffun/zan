import { describe, expect, it } from "vitest";
import { fitWithin, mediaPath, newImageKey, parseImageKey } from "@/lib/image";

const OWNER = "00000000-0000-4000-8000-0000000000aa";
const FILE = "11111111-2222-4333-8444-555555555555";

describe("image keys", () => {
  it("accepts exactly <owner>/<file>.<ext> in lower-case hex", () => {
    expect(parseImageKey(`${OWNER}/${FILE}.webp`)).toEqual({ owner: OWNER, extension: "webp" });
    for (const ext of ["jpg", "png", "gif"]) expect(parseImageKey(`${OWNER}/${FILE}.${ext}`)?.owner).toBe(OWNER);
  });

  it("rejects addresses, paths that wander and anything else", () => {
    for (const bad of [
      `https://example.com/${OWNER}/${FILE}.webp`,
      `//evil.example/${FILE}.webp`,
      `/media/${OWNER}/${FILE}.webp`,
      `../${OWNER}/${FILE}.webp`,
      `${OWNER}/../${FILE}.webp`,
      `${OWNER}/${FILE}.svg`,
      `${OWNER}/${FILE}.webp?x=1`,
      `${OWNER}/${FILE}.webp/`,
      `${OWNER.toUpperCase()}/${FILE}.webp`,
      `${OWNER}/${FILE}`,
      ` ${OWNER}/${FILE}.webp`,
      "javascript:alert(1)",
      "",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(parseImageKey(bad), String(bad)).toBeNull();
    }
  });

  it("makes keys that it accepts itself, and a different one each time", () => {
    const a = newImageKey(OWNER, "image/webp");
    const b = newImageKey(OWNER, "image/jpeg");
    expect(parseImageKey(a)).toMatchObject({ owner: OWNER, extension: "webp" });
    expect(parseImageKey(b)).toMatchObject({ owner: OWNER, extension: "jpg" });
    expect(a).not.toBe(newImageKey(OWNER, "image/webp"));
  });

  it("is loaded from the site's own /media path", () => {
    expect(mediaPath(`${OWNER}/${FILE}.webp`)).toBe(`/media/${OWNER}/${FILE}.webp`);
  });
});

describe("fitWithin", () => {
  it("keeps small pictures as they are", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("scales the longer side down to the limit and keeps the proportions", () => {
    expect(fitWithin(3200, 1800, 1600)).toEqual({ width: 1600, height: 900 });
    expect(fitWithin(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });

  it("never produces an empty side", () => {
    expect(fitWithin(100_000, 10, 1600)).toEqual({ width: 1600, height: 1 });
  });
});
