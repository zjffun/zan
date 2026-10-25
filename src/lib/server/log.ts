import "server-only";
import { fail } from "../action";
import { formatError } from "../log-format";

/** Logs an error as one JSON line (see log-format.ts). Where it is shown depends on the host: Vercel's runtime logs. */
export function logError(scope: string, error: unknown, context: Record<string, unknown> = {}): void {
  console.error(formatError(scope, error, context));
}

/**
 * For Server Actions: logs the real error, answers the person with a plain message. Failures that are
 * expected (not signed in, over a limit, bad input) are returned as values and need no log; this is for
 * the ones nobody expected, such as the database refusing a write.
 */
export function failLogged(scope: string, error: unknown, message: string, context: Record<string, unknown> = {}) {
  logError(scope, error, context);
  return fail(message);
}
