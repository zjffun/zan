import type { Work } from "../types";

/** Links to the work on the databases it came from. */
export function workLinks(work: Pick<Work, "external">): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const { bangumi, openlibrary, isbn } = work.external ?? {};
  if (bangumi && /^\d+$/.test(bangumi)) links.push({ label: "Bangumi", url: `https://bgm.tv/subject/${bangumi}` });
  if (openlibrary && /^OL\d+W$/.test(openlibrary)) {
    links.push({ label: "Open Library", url: `https://openlibrary.org/works/${openlibrary}` });
  }
  if (isbn && /^[0-9Xx-]{10,17}$/.test(isbn)) {
    links.push({ label: `ISBN ${isbn}`, url: `https://openlibrary.org/isbn/${isbn.replace(/-/g, "")}` });
  }
  return links;
}
