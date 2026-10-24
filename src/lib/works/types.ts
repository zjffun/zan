import { z } from "zod";
import { isAllowedImageUrl } from "../links/hosts";
import { WORK_KINDS, type WorkKind } from "../types";

/** A search hit shown to the user. Only `origin` + `id` ever go back to the server. */
export interface WorkCandidate {
  origin: "bangumi" | "openlibrary";
  /** Bangumi subject id, or Open Library work id (OL…W) */
  id: string;
  kind: WorkKind;
  title: string;
  title_original: string | null;
  cover_url: string | null;
  subtitle: string;
  /** Only for ISBN searches: remembered on the work */
  isbn?: string;
}

/** The normalised record that ends up in `works`. */
export interface WorkRecord {
  kind: WorkKind;
  title: string;
  title_original: string | null;
  cover_url: string | null;
  external: Record<string, string>;
}

/**
 * What the client may send when creating a jar. Catalog works are identified
 * by id only; the server re-fetches their title/cover from the upstream API so
 * nobody can put a wrong title on a shared entry.
 */
export const createJarInputSchema = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("bangumi"), id: z.string().regex(/^\d{1,9}$/) }),
  z.object({
    origin: z.literal("openlibrary"),
    id: z.string().regex(/^OL\d{1,12}W$/),
    isbn: z
      .string()
      .regex(/^[0-9Xx-]{10,17}$/)
      .optional(),
  }),
  z.object({
    origin: z.literal("manual"),
    kind: z.enum(WORK_KINDS),
    title: z.string().trim().min(1).max(300),
    title_original: z.string().trim().max(300).optional(),
    cover_url: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .refine((v) => !v || isAllowedImageUrl(v), "cover must be hosted on Bangumi, Open Library, YouTube or Bilibili"),
  }),
]);

export type CreateJarInput = z.infer<typeof createJarInputSchema>;
