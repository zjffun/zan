import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/site";

/**
 * Landing point of e-mail links (magic link, sign-up confirmation) and of outside accounts (GitHub, Google):
 * both come back with a `code` that is exchanged for the session (the code verifier it needs was kept in a
 * cookie when the sign-in began, on this same host).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // An outside account that was cancelled or refused comes back with `error=…` and no code: say so, and keep
  // where the person was going.
  if (!code && !tokenHash && searchParams.has("error")) {
    return NextResponse.redirect(new URL(`/login?error=oauth&next=${encodeURIComponent(next)}`, origin));
  }

  const supabase = await createClient();

  let error: unknown = new Error("missing code");
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  }

  if (error) return NextResponse.redirect(new URL("/login?error=link", origin));
  return NextResponse.redirect(new URL(next, origin));
}
