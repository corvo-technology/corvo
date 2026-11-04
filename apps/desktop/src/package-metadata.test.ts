import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"),
) as {
  productName?: string;
  build?: { productName?: string; mac?: { extendInfo?: Record<string, string> } };
};

describe("desktop package metadata", () => {
  it("keeps the package name that the app bundle, data folder and updates derive from", () => {
    expect(packageJson.productName).toBe("Corvo");
    expect(packageJson.build?.productName).toBeUndefined();
  });

  it("shows Rook where macOS names the app", () => {
    const info = packageJson.build?.mac?.extendInfo;
    expect(info?.CFBundleName).toBe("Rook");
    expect(info?.CFBundleDisplayName).toBe("Rook");
  });
});
