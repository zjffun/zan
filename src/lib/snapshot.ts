import { z } from "zod";
import { anchorSchema, type Anchor } from "./anchor";
import { SOURCE_PROVIDERS, WORK_KINDS, type SourceMeta, type SourceProvider, type WorkKind } from "./types";

/**
 * What publish_jar() writes into publications.snapshot, and all the public
 * page ever reads. Parsed leniently: a bad row degrades, it does not crash.
 */
export interface Snapshot {
  work: {
    kind: WorkKind;
    title: string;
    title_original: string | null;
    cover_url: string | null;
    external: Record<string, string>;
  };
  sources: {
    id: string;
    provider: SourceProvider;
    ref: Record<string, unknown>;
    meta: SourceMeta | null;
    status: "ok" | "dead";
  }[];
  notes: {
    id: string;
    source_id: string | null;
    anchor: Anchor | null;
    /** TipTap JSON; always passed through sanitizeDoc before use */
    body: unknown;
    updated_at: string;
  }[];
}

const nullableString = z.string().nullable().catch(null);

const sourceSchema = z.object({
  id: z.string(),
  provider: z.enum(SOURCE_PROVIDERS),
  ref: z.record(z.string(), z.unknown()).catch({}),
  meta: z
    .object({
      title: z.string().optional().catch(undefined),
      author: z.string().optional().catch(undefined),
      thumbnail: z.string().optional().catch(undefined),
      duration: z.number().optional().catch(undefined),
      part: z.string().optional().catch(undefined),
    })
    .nullable()
    .catch(null),
  status: z.enum(["ok", "dead"]).catch("ok"),
});

const noteSchema = z.object({
  id: z.string(),
  source_id: z.string().nullable().catch(null),
  anchor: anchorSchema.nullable().catch(null),
  body: z.unknown(),
  updated_at: z.string().catch(""),
});

const snapshotSchema = z.object({
  work: z.object({
    kind: z.enum(WORK_KINDS).catch("other"),
    title: z.string().min(1),
    title_original: nullableString,
    cover_url: nullableString,
    external: z.record(z.string(), z.string()).catch({}),
  }),
  sources: z.array(z.unknown()).catch([]),
  notes: z.array(z.unknown()).catch([]),
});

export function parseSnapshot(raw: unknown): Snapshot | null {
  const base = snapshotSchema.safeParse(raw);
  if (!base.success) return null;
  const sources = base.data.sources.flatMap((s) => {
    const parsed = sourceSchema.safeParse(s);
    return parsed.success ? [parsed.data as Snapshot["sources"][number]] : [];
  });
  const notes = base.data.notes.flatMap((n) => {
    const parsed = noteSchema.safeParse(n);
    return parsed.success ? [parsed.data as Snapshot["notes"][number]] : [];
  });
  return { work: base.data.work, sources, notes };
}
