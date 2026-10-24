"use server";

import { z } from "zod";
import { anchorSchema, MAX_QUOTE_LENGTH, parseAnchor, type Anchor } from "@/lib/anchor";
import { fail, zodMessage, type ActionResult } from "@/lib/action";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { DocError, sanitizeDoc, type DocNode } from "@/lib/doc/schema";
import { docToPlainText } from "@/lib/doc/text";
import { rateLimit } from "@/lib/server/ratelimit";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";

const MAX_PLAIN_TEXT = 50_000;
const POSTGRES_FK_VIOLATION = "23503";

const noteInputSchema = z.object({
  sourceId: z.uuid().nullable(),
  anchor: anchorSchema.nullable(),
  body: z.unknown(),
  hideOnPublish: z.boolean().default(false),
});

export type NoteInput = z.input<typeof noteInputSchema>;

interface Prepared {
  body: DocNode;
  plain_text: string;
  anchor: Anchor | null;
  source_id: string | null;
  hide_on_publish: boolean;
}

function prepare(raw: unknown): { ok: true; value: Prepared } | { ok: false; error: string } {
  const parsed = noteInputSchema.safeParse(raw);
  if (!parsed.success) return fail(zodMessage(parsed.error));

  let body: DocNode;
  try {
    body = sanitizeDoc(parsed.data.body);
  } catch (error) {
    return fail(error instanceof DocError ? `笔记内容无效：${error.message}` : "笔记内容无效。");
  }

  const anchor = parseAnchor(parsed.data.anchor);
  // The quote is searchable too; it counts toward the size limit.
  const plain = [anchor?.quote, docToPlainText(body)].filter(Boolean).join("\n");
  if (!plain && !anchor) return fail("笔记是空的。");
  if (Array.from(plain).length > MAX_PLAIN_TEXT) return fail("笔记太长了（最多 5 万字）。");
  if (anchor?.quote && Array.from(anchor.quote).length > MAX_QUOTE_LENGTH) {
    return fail(`摘录最多 ${MAX_QUOTE_LENGTH} 字：只记引用，不转载。`);
  }

  return {
    ok: true,
    value: {
      body,
      plain_text: plain,
      anchor,
      source_id: parsed.data.sourceId,
      hide_on_publish: parsed.data.hideOnPublish,
    },
  };
}

export async function createNote(jarId: string, input: NoteInput): Promise<ActionResult<{ note: Note }>> {
  if (!isUuid(jarId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`note:${user.id}`, 120, 60_000);
  if (!limited.ok) return fail(`保存太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const prepared = prepare(input);
  if (!prepared.ok) return prepared;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ jar_id: jarId, ...prepared.value })
    .select("*")
    .single();
  if (error) {
    if (error.code === POSTGRES_FK_VIOLATION) return fail("这个资源不属于当前罐子。");
    return fail("保存失败。");
  }
  return { ok: true, note: data as Note };
}

export async function updateNote(noteId: string, input: NoteInput): Promise<ActionResult<{ note: Note }>> {
  if (!isUuid(noteId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const limited = rateLimit(`note:${user.id}`, 120, 60_000);
  if (!limited.ok) return fail(`保存太频繁，请 ${limited.retryAfter} 秒后再试。`);

  const prepared = prepare(input);
  if (!prepared.ok) return prepared;

  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").update(prepared.value).eq("id", noteId).select("*").maybeSingle();
  if (error) {
    if (error.code === POSTGRES_FK_VIOLATION) return fail("这个资源不属于当前罐子。");
    return fail("保存失败。");
  }
  if (!data) return fail("找不到这条笔记。");
  return { ok: true, note: data as Note };
}

/** Quick toggle from the note list: keep a note private when publishing. */
export async function setNoteHidden(noteId: string, hidden: boolean): Promise<ActionResult<{ note: Note }>> {
  if (!isUuid(noteId) || typeof hidden !== "boolean") return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").update({ hide_on_publish: hidden }).eq("id", noteId).select("*").maybeSingle();
  if (error || !data) return fail("保存失败。");
  return { ok: true, note: data as Note };
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  if (!isUuid(noteId)) return fail("参数无效。");
  const user = await getCurrentUser();
  if (!user) return fail("请先登录。");
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  return error ? fail("删除失败。") : { ok: true };
}
