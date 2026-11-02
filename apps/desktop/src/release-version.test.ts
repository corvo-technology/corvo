import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

it("links the landing page to the latest release, so a version bump needs no change to the site", () => {
  const site = read("apps/www/src/site.ts");
  expect(site).toContain("/releases/latest/download/corvo-mac-arm64.dmg");
  expect(site).not.toContain("DESKTOP_VERSION");
});

it("publishes the macOS installer under the name the landing page and install script use", () => {
  const build = JSON.parse(read("apps/desktop/package.json")).build;
  expect(build.mac.artifactName).toMatch(/^corvo-mac-\$\{arch\}\./);
  expect(read("apps/www/src/site.ts")).toContain("corvo-mac-arm64.dmg");
  expect(read("apps/desktop/install/install.sh")).toContain("corvo-mac-$ARCH.zip");
});
