import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../scripts/build-engine.mjs", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  dependencies: Record<string, string>;
};

/** The packages the engine bundle leaves out, to be loaded from the app's own node_modules. */
const externals = (/const EXTERNAL_PACKAGES = \[([^\]]*)\]/.exec(script)?.[1] ?? "")
  .split(",")
  .map((entry) => entry.trim().replace(/^"|"$/g, ""))
  .filter(Boolean);

describe("the engine bundle's external packages", () => {
  it("names at least the packages with native code", () => {
    expect(externals).toEqual(expect.arrayContaining(["koffi", "jsdom"]));
  });

  it("keeps the speech engine out of the bundle, because it loads a native module", () => {
    expect(externals).toContain("sherpa-onnx-node");
  });

  it("ships every external package as a dependency of the app", () => {
    // An external that is not a dependency would be missing from the installed app.
    for (const name of externals) {
      expect(manifest.dependencies, name).toHaveProperty(name);
    }
  });

  it("keeps the WhatsApp library out of the bundle and pins the version the spike validated", () => {
    expect(externals).toContain("@whiskeysockets/baileys");
    expect(manifest.dependencies["@whiskeysockets/baileys"]).toBe("6.7.24");
  });

  it("pins the speech engine to the version the engine spike validated", () => {
    expect(manifest.dependencies["sherpa-onnx-node"]).toBe("2.0.1");
  });
});
