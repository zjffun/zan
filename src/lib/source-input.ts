import { z } from "zod";
import { isAllowedImageUrl } from "./links/hosts";
import type { SourceProvider } from "./types";

/**
 * What a post may say about its video or link, as the server checks it (this is the one module of the
 * source code that needs zod: the pages that only show a source do not load it).
 */

/** http(s) only: these end up in href attributes. */
export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "must be an http(s) URL");

export const refSchemas = {
  youtube: z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }).strict(),
  bilibili: z
    .object({
      bvid: z.string().regex(/^BV[0-9A-Za-z]{10}$/),
      p: z.number().int().min(1).max(9999),
    })
    .strict(),
  episode: z
    .object({
      ep: z.number().int().min(0).max(9999),
      bgm_ep: z.number().int().positive().optional(),
      subject: z.number().int().positive().optional(),
      /** optional legitimate streaming link, opened in a new tab */
      url: httpUrl.optional(),
    })
    .strict(),
  book: z
    .object({
      edition: z.string().trim().min(1).max(200).optional(),
      isbn: z.string().regex(/^[0-9Xx-]{10,17}$/).optional(),
      url: httpUrl.optional(),
    })
    .strict(),
  link: z.object({ url: httpUrl }).strict(),
} as const satisfies Record<SourceProvider, z.ZodType>;

export const metaSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    author: z.string().trim().min(1).max(200).optional(),
    thumbnail: z
      .string()
      .trim()
      .max(1000)
      .refine(isAllowedImageUrl, "thumbnail must be https on a known image host")
      .optional(),
    duration: z.number().int().min(0).max(48 * 3600).optional(),
    part: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const sourceInputSchema = z
  .object({
    provider: z.enum(["youtube", "bilibili", "episode", "book", "link"]),
    ref: z.record(z.string(), z.unknown()),
    meta: metaSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const parsed = refSchemas[value.provider].safeParse(value.ref);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: `invalid ref for ${value.provider}`, path: ["ref"] });
    }
  });

export type SourceInput = z.infer<typeof sourceInputSchema>;

/** Validates untrusted source input; throws a ZodError with a path on failure. */
export function parseSourceInput(input: unknown): SourceInput {
  const parsed = sourceInputSchema.parse(input);
  return {
    provider: parsed.provider,
    ref: refSchemas[parsed.provider].parse(parsed.ref),
    meta: parsed.meta ?? null,
  };
}
