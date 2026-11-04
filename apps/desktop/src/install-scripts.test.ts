import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(import.meta.dirname, "../install");

// Both scripts are attached to every release, and the release cannot be published with an empty
// file: the upload of a zero-byte asset is refused.
describe.each(["install.sh", "install.ps1"])("the %s a release ships", (name) => {
  const file = path.join(dir, name);

  it("is not empty", () => {
    expect(statSync(file).size).toBeGreaterThan(1_000);
  });

  it("says what it installs and where it downloads from", () => {
    const text = readFileSync(file, "utf8");
    expect(text).toMatch(/Installs or updates Rook/);
    expect(text).toContain("github.com/corvo-technology/rook/releases/latest/download/");
  });
});
