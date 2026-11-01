import { describe, expect, it } from "vitest";
import { isImeKey } from "@/lib/ime";

describe("isImeKey", () => {
  it("is a key pressed while an input method is composing", () => {
    expect(isImeKey({ isComposing: true, keyCode: 13 })).toBe(true);
  });

  it("is the key Safari reports after it has ended the composition: code 229", () => {
    expect(isImeKey({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeKey({ keyCode: 229 })).toBe(true);
  });

  it("is not an ordinary key", () => {
    expect(isImeKey({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeKey({ keyCode: 8 })).toBe(false);
    expect(isImeKey({})).toBe(false);
  });
});
