import { describe, expect, it } from "vitest";
import { chargeNewTags, TAG_ALLOWANCE } from "@/lib/server/tag-allowance";

let n = 0;
const person = () => `tag-allowance-test-${++n}`;

describe("chargeNewTags", () => {
  it("lets a person make as many tags as the allowance says, and no more", async () => {
    const id = person();
    expect(await chargeNewTags(id, TAG_ALLOWANCE.limit)).toEqual({ ok: true });
    const refused = await chargeNewTags(id, 1);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.retryAfter).toBeGreaterThan(0);
  });

  it("counts every tag a post makes, so that posting is no way round the limit", async () => {
    const id = person();
    // four posts of five new tags each use up the twenty
    for (let post = 0; post < 4; post++) expect(await chargeNewTags(id, 5)).toEqual({ ok: true });
    expect((await chargeNewTags(id, 5)).ok).toBe(false);
  });

  it("does not spend anything when there is nothing to make", async () => {
    const id = person();
    for (let i = 0; i < 50; i++) expect(await chargeNewTags(id, 0)).toEqual({ ok: true });
    expect(await chargeNewTags(id, TAG_ALLOWANCE.limit)).toEqual({ ok: true });
  });

  it("is kept per person", async () => {
    const a = person();
    const b = person();
    expect(await chargeNewTags(a, TAG_ALLOWANCE.limit)).toEqual({ ok: true });
    expect((await chargeNewTags(a, 1)).ok).toBe(false);
    expect(await chargeNewTags(b, 1)).toEqual({ ok: true });
  });
});
