import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseConfig } from "./supabase/config";
import { createClient } from "./supabase/server";
import type { Jar, Note, Source, Visibility, Work } from "./types";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** The signed-in user, or null. Reads cookies: call inside <Suspense> / an action. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Unconfigured (fresh checkout): behave as signed out so the public pages still render.
  if (!supabaseConfig()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

export async function requireUser(next = "/jars"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export const uuidSchema = z.uuid();
export const isUuid = (value: string) => uuidSchema.safeParse(value).success;

export interface JarListItem {
  id: string;
  slug: string;
  visibility: Visibility;
  updated_at: string;
  work: Pick<Work, "id" | "title" | "title_original" | "kind" | "cover_url">;
  sources: number;
  notes: number;
}

/** My jars, most recently touched first. */
export async function listJars(): Promise<JarListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jars")
    .select("id, slug, visibility, updated_at, work:works(id, title, title_original, kind, cover_url), sources(count), notes(count)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`could not load jars: ${error.message}`);
  type Row = Omit<JarListItem, "sources" | "notes"> & { sources: { count: number }[]; notes: { count: number }[] };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    visibility: row.visibility,
    updated_at: row.updated_at,
    work: row.work,
    sources: row.sources?.[0]?.count ?? 0,
    notes: row.notes?.[0]?.count ?? 0,
  }));
}

export interface PublicationInfo {
  slug: string;
  visibility: "unlisted" | "public";
  version: number;
  published_at: string;
}

export interface JarBundle {
  jar: Jar;
  work: Work;
  sources: Source[];
  notes: Note[];
  publication: PublicationInfo | null;
}

/** Everything the editor needs. RLS makes this null for anybody but the owner. */
export async function loadJar(jarId: string): Promise<JarBundle | null> {
  if (!isUuid(jarId)) return null;
  const supabase = await createClient();

  const jarQuery = await supabase.from("jars").select("*, work:works(*)").eq("id", jarId).maybeSingle();
  if (jarQuery.error) throw new Error(`could not load jar: ${jarQuery.error.message}`);
  if (!jarQuery.data) return null;

  const [sources, notes, publication] = await Promise.all([
    supabase.from("sources").select("*").eq("jar_id", jarId).order("created_at"),
    supabase.from("notes").select("*").eq("jar_id", jarId).order("created_at"),
    supabase.from("publications").select("slug, visibility, version, published_at").eq("jar_id", jarId).maybeSingle(),
  ]);
  for (const result of [sources, notes, publication]) {
    if (result.error) throw new Error(`could not load jar: ${result.error.message}`);
  }

  const { work, ...jar } = jarQuery.data as Jar & { work: Work };
  return {
    jar: jar as Jar,
    work,
    sources: (sources.data ?? []) as Source[],
    notes: (notes.data ?? []) as Note[],
    publication: (publication.data as PublicationInfo | null) ?? null,
  };
}
