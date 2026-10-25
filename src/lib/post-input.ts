import { z } from "zod";
import { anchorSchema, MAX_QUOTE_LENGTH, type Anchor } from "./anchor";
import { collectImages } from "./doc/images";
import { DocError, sanitizeDoc, type DocNode } from "./doc/schema";
import { docToPlainText } from "./doc/text";
import { MAX_POST_IMAGES, parseImageKey } from "./image";
import { parseSourceInput } from "./sources";
import { normalizeTagName, tagKey } from "./tag-name";
import type { PostSource, Visibility } from "./types";

export const MAX_POST_TAGS = 5;
export const MAX_PLAIN_TEXT = 20_000;
/** The searchable text of a post that is only pictures (the database wants a post to have some text, a video or a position). */
export const IMAGE_ONLY_TEXT = "[图片]";

/** What the composer sends; everything in it is untrusted. */
export const postInputSchema = z.object({
  body: z.unknown(),
  anchor: anchorSchema.nullable().default(null),
  source: z.unknown().nullable().default(null),
  visibility: z.enum(["public", "private"]).default("public"),
  /** existing tags, by id */
  tagIds: z.array(z.uuid()).max(MAX_POST_TAGS).default([]),
  /** tags to create (or reuse, if the name is taken) while posting */
  newTags: z.array(z.string().max(200)).max(MAX_POST_TAGS).default([]),
});

export type PostInput = z.input<typeof postInputSchema>;

export interface PreparedPost {
  body: DocNode;
  plain_text: string;
  anchor: Anchor | null;
  source: PostSource | null;
  visibility: Visibility;
  tagIds: string[];
  /** normalized, de-duplicated (ignoring case) */
  newTagNames: string[];
}

export type PrepareResult = { ok: true; value: PreparedPost } | { ok: false; error: string };

const fail = (error: string): PrepareResult => ({ ok: false, error });

/**
 * Checks and cleans a post before it is written. The same rules apply to creating and to editing.
 * `author` is the signed-in user: a post may only contain pictures that this user uploaded.
 */
export function preparePost(raw: unknown, author: string): PrepareResult {
  const parsed = postInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.path[0] === "anchor" ? `位置无效：${issue.message}` : (issue?.message ?? "内容无效。"));
  }
  const input = parsed.data;

  let body: DocNode;
  try {
    body = sanitizeDoc(input.body);
  } catch (error) {
    return fail(error instanceof DocError ? `内容无效：${error.message}` : "内容无效。");
  }

  let source: PostSource | null = null;
  if (input.source !== null) {
    try {
      const checked = parseSourceInput(input.source);
      source = { provider: checked.provider, ref: checked.ref, meta: checked.meta ?? null };
    } catch {
      return fail("链接无效。");
    }
  }

  const images = collectImages(body);
  if (images.length > MAX_POST_IMAGES) return fail(`每条内容最多 ${MAX_POST_IMAGES} 张图片。`);
  if (images.some((image) => parseImageKey(image.key)?.owner !== author)) return fail("图片无效，请重新上传。");

  const anchor = input.anchor;
  if (anchor?.quote && Array.from(anchor.quote).length > MAX_QUOTE_LENGTH) {
    return fail(`摘录最多 ${MAX_QUOTE_LENGTH} 字：只记引用，不转载。`);
  }

  // The quote is searchable too, so it counts toward the size limit.
  const written = [docToPlainText(body), anchor?.quote].filter(Boolean).join("\n");
  if (!written && !source && !anchor && images.length === 0) return fail("先写点什么，或者贴一个链接。");
  const text = written || (images.length > 0 ? IMAGE_ONLY_TEXT : "");
  if (Array.from(text).length > MAX_PLAIN_TEXT) return fail("内容太长了（最多 2 万字）。");

  const names: string[] = [];
  const seen = new Set<string>();
  for (const rawName of input.newTags) {
    const name = normalizeTagName(rawName);
    if (!name) return fail("标签名要 1–30 个字，不能包含 #。");
    if (!seen.has(tagKey(name))) {
      seen.add(tagKey(name));
      names.push(name);
    }
  }
  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length + names.length > MAX_POST_TAGS) return fail(`最多带 ${MAX_POST_TAGS} 个标签。`);

  return {
    ok: true,
    value: { body, plain_text: text, anchor, source, visibility: input.visibility, tagIds, newTagNames: names },
  };
}

export const MAX_COMMENT_LENGTH = 1000;

/** Comments are plain text: trimmed, with runs of blank lines squeezed. */
export function normalizeComment(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text === "" || Array.from(text).length > MAX_COMMENT_LENGTH) return null;
  return text;
}
