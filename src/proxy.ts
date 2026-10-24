import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static assets and the public snapshot pages (which are
  // cacheable and never need a session).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|p/|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
