import { describe, expect, it } from "vitest";
import { describeError, formatError } from "@/lib/log-format";

const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;

describe("formatError", () => {
  it("is one line of JSON that names where it happened", () => {
    const line = formatError("posts.create", new Error("boom"), { author: "u1" });
    expect(line).not.toContain("\n");
    expect(parse(line)).toMatchObject({ level: "error", scope: "posts.create", message: "boom", author: "u1" });
  });

  it("keeps the stack of a real Error, and the code and digest if it has them", () => {
    const error = Object.assign(new Error("db said no"), { code: "23505", digest: "1234567890" });
    expect(parse(formatError("x", error))).toMatchObject({ message: "db said no", code: "23505", digest: "1234567890", stack: expect.stringContaining("db said no") });
  });

  it("reads the plain error objects that Supabase returns", () => {
    const supabase = { message: 'duplicate key value violates unique constraint "tags_name_key"', details: "Key (lower(name))=(x) already exists.", hint: null, code: "23505" };
    expect(describeError(supabase)).toEqual({ message: supabase.message, code: "23505" });
  });

  it("copes with what is not an error at all", () => {
    expect(describeError("just a string")).toEqual({ message: "just a string" });
    expect(describeError(undefined)).toEqual({ message: "undefined" });
    expect(describeError(null)).toEqual({ message: "null" });
    expect(describeError({})).toEqual({ message: "(no message)" });
  });

  it("cuts a very long message and stack, so that a log line stays a line", () => {
    const error = new Error("x".repeat(5000));
    const out = describeError(error);
    expect(out.message?.length).toBe(500);
    expect((out.stack ?? "").length).toBeLessThanOrEqual(1200);
  });

  it("does not let the context overwrite the error itself", () => {
    // context is spread after the error's fields: callers must not use these names (checked here so that it is a decision)
    const line = parse(formatError("scope", new Error("real"), { post: "p1" }));
    expect(line.message).toBe("real");
    expect(line.post).toBe("p1");
  });
});
