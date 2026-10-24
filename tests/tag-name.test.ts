import { describe, expect, it } from "vitest";
import { MAX_TAG_NAME_LENGTH, normalizeTagName, tagKey } from "@/lib/tag-name";

describe("normalizeTagName", () => {
  it("trims, drops leading # signs and squeezes inner whitespace", () => {
    expect(normalizeTagName("  动漫 ")).toBe("动漫");
    expect(normalizeTagName("#动漫")).toBe("动漫");
    expect(normalizeTagName("＃## 孤独摇滚！")).toBe("孤独摇滚！");
    expect(normalizeTagName("看　番\t日常")).toBe("看 番 日常");
    expect(normalizeTagName("line\nbreak")).toBe("line break");
  });

  it("rejects what cannot be a name", () => {
    for (const bad of ["", "   ", "#", "##  ", "a#b", "带＃号", "bell\u0007", "zero\u0000width", 42, null, undefined, {}]) {
      expect(normalizeTagName(bad), String(bad)).toBeNull();
    }
  });

  it("counts characters, not UTF-16 units", () => {
    expect(normalizeTagName("字".repeat(MAX_TAG_NAME_LENGTH))).toBe("字".repeat(MAX_TAG_NAME_LENGTH));
    expect(normalizeTagName("字".repeat(MAX_TAG_NAME_LENGTH + 1))).toBeNull();
    // 30 emoji are 60 UTF-16 units but still 30 characters
    expect(normalizeTagName("😀".repeat(MAX_TAG_NAME_LENGTH))).not.toBeNull();
    expect(normalizeTagName("😀".repeat(MAX_TAG_NAME_LENGTH + 1))).toBeNull();
  });
});

describe("tagKey", () => {
  it("ignores case, like the database index", () => {
    expect(tagKey("Fate/Stay")).toBe(tagKey("fate/stay"));
    expect(tagKey("动漫")).toBe("动漫");
  });
});
