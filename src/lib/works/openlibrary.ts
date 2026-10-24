import "server-only";
import { fetchJson } from "../server/http";
import { TtlCache } from "../server/cache";
import type { WorkCandidate, WorkRecord } from "./types";

const API = "https://openlibrary.org";

/** "978-0-441-47812-5" / "0441478123" -> normalised digits, else null. */
export function normalizeIsbn(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  return /^(?:\d{13}|\d{9}[\dXx])$/.test(compact) ? compact.toUpperCase() : null;
}

const coverUrl = (coverId: unknown): string | null =>
  typeof coverId === "number" && Number.isInteger(coverId) && coverId > 0
    ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
    : null;

const workId = (key: unknown): string | null => {
  const match = typeof key === "string" ? /^\/works\/(OL\d{1,12}W)$/.exec(key) : null;
  return match ? match[1] : null;
};

const cache = new TtlCache<WorkCandidate[]>(10 * 60_000);

/** Title search, or an exact lookup when the query is an ISBN. */
export async function searchOpenLibrary(query: string, limit = 10): Promise<WorkCandidate[]> {
  const isbn = normalizeIsbn(query);
  return cache.memo(`${limit}:${query.toLowerCase()}`, async () => {
    const params = new URLSearchParams({
      limit: String(limit),
      fields: "key,title,author_name,first_publish_year,cover_i",
    });
    if (isbn) params.set("isbn", isbn);
    else params.set("q", query);

    const { status, json } = await fetchJson(`${API}/search.json?${params}`);
    if (status !== 200 || typeof json !== "object" || json === null) {
      throw new Error(`Open Library search failed (${status})`);
    }
    const docs = (json as { docs?: unknown }).docs;
    if (!Array.isArray(docs)) return [];
    return docs.flatMap((doc: Record<string, unknown>) => {
      const id = workId(doc.key);
      const title = typeof doc.title === "string" ? doc.title.trim() : "";
      if (!id || !title) return [];
      const authors = Array.isArray(doc.author_name)
        ? doc.author_name.filter((a): a is string => typeof a === "string").slice(0, 2).join(", ")
        : "";
      const year = typeof doc.first_publish_year === "number" ? String(doc.first_publish_year) : "";
      return [
        {
          origin: "openlibrary" as const,
          id,
          kind: "book" as const,
          title,
          title_original: null,
          cover_url: coverUrl(doc.cover_i),
          subtitle: [authors, year].filter(Boolean).join(" · "),
          ...(isbn ? { isbn } : {}),
        },
      ];
    });
  });
}

/** Canonical record for an Open Library work id, straight from Open Library. */
export async function getOpenLibraryWork(id: string, isbn?: string): Promise<WorkRecord | null> {
  const { status, json } = await fetchJson(`${API}/works/${encodeURIComponent(id)}.json`);
  if (status === 404) return null;
  if (status !== 200 || typeof json !== "object" || json === null) {
    throw new Error(`Open Library lookup failed (${status})`);
  }
  const work = json as { title?: unknown; covers?: unknown };
  const title = typeof work.title === "string" ? work.title.trim() : "";
  if (!title) return null;
  const covers = Array.isArray(work.covers) ? work.covers : [];
  const normalizedIsbn = isbn ? normalizeIsbn(isbn) : null;
  return {
    kind: "book",
    title: title.slice(0, 300),
    title_original: null,
    cover_url: coverUrl(covers.find((c) => typeof c === "number" && c > 0)),
    external: { openlibrary: id, ...(normalizedIsbn ? { isbn: normalizedIsbn } : {}) },
  };
}
