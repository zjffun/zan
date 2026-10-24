import { z } from "zod";
import type { TagKind } from "../types";

/** A search hit shown to the user. Only `origin` + `id` ever go back to the server. */
export interface WorkCandidate {
  origin: "bangumi" | "openlibrary";
  /** Bangumi subject id, or Open Library work id (OL…W) */
  id: string;
  kind: TagKind;
  title: string;
  title_original: string | null;
  cover_url: string | null;
  subtitle: string;
  /** Only for ISBN searches: remembered on the work */
  isbn?: string;
}

/** The normalised record a catalog tag is made from. */
export interface WorkRecord {
  kind: TagKind;
  title: string;
  title_original: string | null;
  cover_url: string | null;
  external: Record<string, string>;
}

/**
 * What the client may send when making a tag from a catalog entry. Catalog
 * entries are identified by id only; the server re-fetches their title and
 * cover from the upstream API so nobody can put a wrong name on a shared tag.
 */
export const tagFromWorkInputSchema = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("bangumi"), id: z.string().regex(/^\d{1,9}$/) }),
  z.object({
    origin: z.literal("openlibrary"),
    id: z.string().regex(/^OL\d{1,12}W$/),
    isbn: z
      .string()
      .regex(/^[0-9Xx-]{10,17}$/)
      .optional(),
  }),
]);

export type TagFromWorkInput = z.infer<typeof tagFromWorkInputSchema>;
