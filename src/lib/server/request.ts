import "server-only";
import { headers } from "next/headers";

/** The first address in x-forwarded-for (the host sets it), else "local". */
export function addressOf(h: Pick<Headers, "get">): string {
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

/** Who is asking, for the limits that apply before anybody is signed in. */
export async function clientKey(): Promise<string> {
  return addressOf(await headers());
}
