import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseConfig } from "./supabase/config";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

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

export async function requireUser(next = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** The signed-in user's profile (nickname, bio), or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, nickname, bio, created_at").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export const uuidSchema = z.uuid();
export const isUuid = (value: string) => uuidSchema.safeParse(value).success;
