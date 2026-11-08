import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "@/lib/browser-storage";
import { markSignedOut, signedOutSince } from "@/lib/sign-out-mark";

function memory(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

const broken: KeyValueStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => undefined,
};

describe("signedOutSince", () => {
  it("is no when nobody has signed out", () => {
    expect(signedOutSince(memory(), 1_000)).toBe(false);
  });

  it("is yes for a page that was shown before the sign-out, no for one shown after it", () => {
    const storage = memory();
    markSignedOut(storage, 5_000);
    expect(signedOutSince(storage, 4_000)).toBe(true);
    expect(signedOutSince(storage, 5_000)).toBe(true);
    expect(signedOutSince(storage, 5_001)).toBe(false);
  });

  it("is yes when the storage cannot be read, because the page cannot tell", () => {
    expect(signedOutSince(null, 1_000)).toBe(true);
    expect(signedOutSince(broken, 1_000)).toBe(true);
  });

  it("is no for something in the storage that is not a time", () => {
    const storage = memory();
    storage.setItem("zan:signed-out-at", "yesterday");
    expect(signedOutSince(storage, 1_000)).toBe(false);
  });
});

describe("markSignedOut", () => {
  it("does not throw when there is no storage or no room in it", () => {
    expect(() => markSignedOut(null)).not.toThrow();
    expect(() => markSignedOut(broken)).not.toThrow();
  });
});
