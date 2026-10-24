import { ZodError } from "zod";

/** Server Actions report expected failures as values, never as thrown errors. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function zodMessage(error: ZodError): string {
  const issue = error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue?.message ?? "输入无效"}`;
}
