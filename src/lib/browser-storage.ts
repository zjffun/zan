/** What the browser's storage has to offer to the code that keeps things in it. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** This browser's storage, or one that keeps nothing when the browser does not allow it (private windows, blocked site data). */
export function browserStorage(): KeyValueStorage {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}
