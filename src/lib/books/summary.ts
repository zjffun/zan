import type { Availability, Book } from "./types";

/** What there is to say about a book as a whole. */
export type BookStatus = "public" | "paid" | "none" | "unknown";

const PUBLIC: readonly Availability[] = ["open", "free", "personal"];

/** Whether something public can be read: free for anyone, even if only for personal use. */
export const isPublic = (availability: Availability) => PUBLIC.includes(availability);

/**
 * `public` when any of the book's content can be had for free; else `paid` when some of it can be bought
 * or asked for; else `none` when everything was looked up and nothing was found; else `unknown`
 * (nothing looked up yet, or something still to look up).
 */
export function bookStatus(book: Book): BookStatus {
  const found = book.resources.map((resource) => resource.availability);
  if (found.some(isPublic)) return "public";
  if (found.includes("paid")) return "paid";
  if (found.length === 0 || found.includes("unknown")) return "unknown";
  return "none";
}

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  public: "有公开内容",
  paid: "要购买或授权",
  none: "没找到公开内容",
  unknown: "还没查清",
};
