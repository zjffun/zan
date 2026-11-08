import { describe, expect, it } from "vitest";
import { enabledProviders, isOAuthProvider, OAUTH_LABELS, OAUTH_PROVIDERS } from "@/lib/auth-providers";

describe("isOAuthProvider", () => {
  it("knows the accounts the form offers, and nothing else", () => {
    expect(isOAuthProvider("github")).toBe(true);
    expect(isOAuthProvider("google")).toBe(true);
    // what else the form's `intent` can be, and what is not ours to hand to Supabase
    for (const other of ["signin", "signup", "magic", "facebook", "GitHub", "", "constructor", "__proto__", null, undefined, 1, ["github"]]) {
      expect(isOAuthProvider(other)).toBe(false);
    }
  });

  it("has a name for each", () => {
    for (const provider of OAUTH_PROVIDERS) expect(OAUTH_LABELS[provider]).toBeTruthy();
  });
});

describe("enabledProviders", () => {
  it("lists the ones that Supabase says are on", () => {
    expect(enabledProviders({ external: { email: true, github: true, google: true, apple: true } })).toEqual(["github", "google"]);
    expect(enabledProviders({ external: { email: true, github: false, google: true } })).toEqual(["google"]);
    expect(enabledProviders({ external: { email: true } })).toEqual([]);
  });

  it("counts only a plain true", () => {
    expect(enabledProviders({ external: { github: "true", google: 1 } })).toEqual([]);
  });

  it("takes anything that is not an answer for none", () => {
    for (const nonsense of [null, undefined, "github", 42, [], {}, { external: null }, { external: "github" }, { external: [] }]) {
      expect(enabledProviders(nonsense)).toEqual([]);
    }
  });
});
