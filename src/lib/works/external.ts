/** The part of a tag these links need. */
interface WithExternal {
  external: Record<string, string>;
}

/** Links to the work on the databases it came from. */
export function workLinks(work: WithExternal): { label: string; url: string }[] {
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
