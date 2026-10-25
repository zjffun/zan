import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface LockEntry {
  version?: string;
  resolved?: string;
  link?: boolean;
}

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
  lockfileVersion: number;
  packages: Record<string, LockEntry>;
};

// The root ("") and linked workspaces are not downloaded, so they have no `resolved`.
const downloaded = Object.entries(lock.packages).filter(([path, entry]) => path !== "" && !entry.link);

describe("package-lock.json", () => {
  it("lists packages", () => {
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(3);
    expect(downloaded.length).toBeGreaterThan(0);
  });

  // npm writes the registry it was configured with into every `resolved`. A lockfile generated against
  // any other registry cannot be installed on Vercel or in CI.
  it("downloads everything from the public registry", () => {
    const elsewhere = downloaded
      .filter(([, entry]) => !entry.resolved?.startsWith("https://registry.npmjs.org/"))
      .map(([path, entry]) => `${path} -> ${entry.resolved ?? "(no resolved)"}`);
    expect(elsewhere, "regenerate with: npm install --registry=https://registry.npmjs.org/").toEqual([]);
  });

  // An entry without a version is an optional-dependency stub that makes `npm install` on another
  // platform fail with "Invalid Version".
  it("has a version for every package", () => {
    const missing = downloaded.filter(([, entry]) => !entry.version).map(([path]) => path);
    expect(missing).toEqual([]);
  });
});
