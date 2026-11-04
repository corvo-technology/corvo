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

  it("shows Rook in Finder and Launchpad without renaming the bundle's own name", () => {
    const info = packageJson.build?.mac?.extendInfo;
    expect(info?.CFBundleDisplayName).toBe("Rook");
    // Electron looks for its helper apps by this name ("<name> Helper.app"), and electron-builder
    // names them from the product name. Setting it to anything else makes the app abort on launch.
    expect(info).not.toHaveProperty("CFBundleName");
  });
});
