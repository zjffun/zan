import type { KeyValueStorage } from "./browser-storage";

/**
 * A page that was shown while somebody was signed in can come back after they signed out: the browser keeps
 * pages it has left (the back/forward cache) and puts one back as it was on Back. Such a page has to find out
 * that it should not be shown any more, and the only thing it shares with the page that did the signing out is
 * the storage of this browser (every tab, every page of the site).
 */
const KEY = "zan:signed-out-at";

/** Writes down that somebody signed out just now. */
export function markSignedOut(storage: KeyValueStorage | null, now = Date.now()): void {
  try {
    storage?.setItem(KEY, String(now));
  } catch {
    // no room: nothing to be done about it here (see signedOutSince for what a page makes of that)
  }
}

/**
 * Has somebody signed out since `since` (milliseconds since 1970, when the page was shown)? When the storage cannot be
 * read the answer is yes: showing the page again costs a reload, and keeping one that should be gone costs more.
 */
export function signedOutSince(storage: KeyValueStorage | null, since: number): boolean {
  if (!storage) return true;
  try {
    return Number(storage.getItem(KEY)) >= since; // nothing written is 0, rubbish is NaN: both are "no"
  } catch {
    return true;
  }
}
