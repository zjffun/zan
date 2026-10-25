import { describe, expect, it, vi } from "vitest";
import { attempt, NETWORK_ERROR } from "@/lib/attempt";

describe("attempt", () => {
  it("passes on what the action answered, success or refusal", async () => {
    expect(await attempt(async () => ({ ok: true as const, id: "1" }))).toEqual({ ok: true, id: "1" });
    expect(await attempt(async () => ({ ok: false as const, error: "发布太频繁" }))).toEqual({ ok: false, error: "发布太频繁" });
  });

  it("turns a call that never completed into an ordinary failure, so that nothing is left waiting", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await attempt(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({ ok: false, error: NETWORK_ERROR });
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("also catches a call that throws before it returns a promise", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await attempt(() => {
      throw new Error("synchronous");
    });
    expect(result).toEqual({ ok: false, error: NETWORK_ERROR });
    quiet.mockRestore();
  });
});
