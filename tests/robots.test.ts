import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = ([] as string[]).concat(rule.disallow ?? []);

  it("keeps crawlers out of the pages that are only for signed-in people", () => {
    for (const path of ["/api/", "/login", "/new", "/settings", "/favorites", "/p/*/edit"]) expect(disallow).toContain(path);
  });

  it("no longer mentions pages from the product before the tags", () => {
    expect(disallow.join(" ")).not.toContain("jars");
  });
});
