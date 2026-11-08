import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/server/same-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Signing out. The menu's button posts a plain form here, and the answer is a redirect, so the browser loads
 * the next page from scratch. A Server Action would do the same work from inside the open page, which then
 * stays in the browser, with the posts that only the signed-in user could see, and Back would show them to
 * whoever comes next. Only POST is answered: a link, a prefetch or an image cannot sign anybody out.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("请求来源不对。", { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut(); // clears the session cookies through the client's setAll
  // A relative address, which the browser reads against the page it posted from: an absolute one is built from
  // what the server believes its own origin is, and the form's `form-action 'self'` silently drops a redirect
  // to any other origin, which would leave the person signed in with nothing to show for the click.
  return new NextResponse(null, { status: 303, headers: { location: "/", "cache-control": "no-store" } });
}
