/**
 * The request came from a page of this site: a form on another site cannot make the signed-in user upload,
 * sign out, and so on. Browsers send `Origin` with every POST; a client that does not is let through,
 * because the session cookie is SameSite=Lax anyway.
 */
export function sameOrigin(request: { headers: Pick<Headers, "get"> }): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
