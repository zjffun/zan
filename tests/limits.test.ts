import { describe, expect, it } from "vitest";
import { enforce, LIMITS, type Policy } from "@/lib/server/limits";

let n = 0;
const person = () => `limits-test-${++n}`;

describe("LIMITS", () => {
  const all = Object.entries(LIMITS) as [string, Policy][];

  it("gives every kind of action a counter of its own (a shared one lets one action eat another's allowance)", () => {
    const keys = all.map(([, policy]) => policy.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only has sensible numbers", () => {
    for (const [name, policy] of all) {
      expect(Number.isInteger(policy.limit) && policy.limit > 0, name).toBe(true);
      expect(policy.windowMs >= 1000, name).toBe(true);
    }
  });

  it("limits what used to have no limit", () => {
    for (const name of ["postDelete", "commentDelete", "profileEdit", "exportAll", "siteSearch"]) expect(LIMITS).toHaveProperty(name);
  });
});

describe("enforce", () => {
  it("lets exactly `limit` uses through, then says when to come back", async () => {
    const id = person();
    for (let i = 0; i < LIMITS.profileEdit.limit; i++) expect((await enforce(LIMITS.profileEdit, id)).ok).toBe(true);
    const refused = await enforce(LIMITS.profileEdit, id);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBeGreaterThan(0);
  });

  it("keeps publishing and editing apart: using up one does not use up the other", async () => {
    const id = person();
    for (let i = 0; i < LIMITS.postCreate.limit; i++) await enforce(LIMITS.postCreate, id);
    expect((await enforce(LIMITS.postCreate, id)).ok).toBe(false);
    expect((await enforce(LIMITS.postEdit, id)).ok).toBe(true);
  });

  it("keeps people apart", async () => {
    const a = person();
    const b = person();
    for (let i = 0; i < LIMITS.exportAll.limit; i++) await enforce(LIMITS.exportAll, a);
    expect((await enforce(LIMITS.exportAll, a)).ok).toBe(false);
    expect((await enforce(LIMITS.exportAll, b)).ok).toBe(true);
  });
});
