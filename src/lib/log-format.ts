/**
 * One line of JSON per error, so that it can be searched in the host's logs (`scope`, `code`, `digest`).
 * It never takes a request, so cookies and tokens cannot end up in it; `context` is for ids and names of
 * things, not for what a person typed.
 */

const MAX_MESSAGE = 500;
const MAX_STACK = 1200;

export interface ErrorLine {
  level: "error";
  scope: string;
  message: string;
  /** a database or HTTP error code, when the error has one */
  code?: string;
  /** Next.js's id for a server rendering error: what the error page shows as 错误编号 */
  digest?: string;
  stack?: string;
  [key: string]: unknown;
}

const text = (value: unknown, max: number): string => String(value).slice(0, max);

/** Reads the useful fields of whatever was thrown or returned as an error (Error, Supabase's plain error object, a string). */
export function describeError(error: unknown): { message: string; code?: string; digest?: string; stack?: string } {
  if (error instanceof Error) {
    const extra = error as Error & { code?: unknown; digest?: unknown };
    return {
      message: text(error.message, MAX_MESSAGE),
      ...(extra.code !== undefined ? { code: text(extra.code, 40) } : {}),
      ...(extra.digest !== undefined ? { digest: text(extra.digest, 40) } : {}),
      ...(error.stack ? { stack: text(error.stack, MAX_STACK) } : {}),
    };
  }
  if (typeof error === "object" && error !== null) {
    const plain = error as { message?: unknown; code?: unknown; digest?: unknown };
    return {
      message: text(plain.message ?? "(no message)", MAX_MESSAGE),
      ...(plain.code !== undefined ? { code: text(plain.code, 40) } : {}),
      ...(plain.digest !== undefined ? { digest: text(plain.digest, 40) } : {}),
    };
  }
  return { message: text(error, MAX_MESSAGE) };
}

export function formatError(scope: string, error: unknown, context: Record<string, unknown> = {}): string {
  const line: ErrorLine = { level: "error", scope, ...describeError(error), ...context };
  return JSON.stringify(line);
}
