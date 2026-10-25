import { z } from "zod";
import { collectImages } from "./doc/images";
import { DocError, sanitizeComment, sanitizeDoc, type DocNode } from "./doc/schema";
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
    return fail(issue?.message ?? "内容无效。");
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

  const written = docToPlainText(body);
  if (!written && !source && images.length === 0) return fail("先写点什么，或者贴一个链接。");
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
    value: { body, plain_text: text, source, visibility: input.visibility, tagIds, newTagNames: names },
  };
}

export const MAX_COMMENT_LENGTH = 1000;
const MAX_COMMENT_DOC_BYTES = 30_000;

export interface PreparedComment {
  doc: DocNode;
  /** what the document says in plain text: this is what the 1000 characters are counted on */
  text: string;
}

/** Checks and cleans a comment: a small document (paragraphs, quotes, lists, code, links, time labels), 1–1000 characters of text. */
export function prepareComment(raw: unknown): { ok: true; value: PreparedComment } | { ok: false; error: string } {
  let doc: DocNode;
  try {
    doc = sanitizeComment(raw);
  } catch {
    return { ok: false, error: "评论无效。" };
  }
  const text = docToPlainText(doc);
  if (!text) return { ok: false, error: "评论要 1–1000 个字。" };
  if (Array.from(text).length > MAX_COMMENT_LENGTH) return { ok: false, error: `评论太长了（最多 ${MAX_COMMENT_LENGTH} 个字）。` };
  // links and marks add bytes that the text does not show; the column refuses 50000 bytes of JSON
  if (new TextEncoder().encode(JSON.stringify(doc)).length > MAX_COMMENT_DOC_BYTES) return { ok: false, error: "评论太复杂了，请删减一些格式或链接。" };
  return { ok: true, value: { doc, text } };
}
