import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isAdHocSigned,
  macBundleFromExecutable,
  readPendingUpdate,
  updateScript,
} from "./mac-update.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "corvo-mac-update-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("macBundleFromExecutable", () => {
  it("finds the app a running executable belongs to", () => {
    expect(macBundleFromExecutable("/Applications/Corvo.app/Contents/MacOS/Corvo")).toBe(
      "/Applications/Corvo.app",
    );
  });

  it("refuses a program that is not inside an app bundle", () => {
    expect(macBundleFromExecutable("/usr/local/bin/node")).toBeNull();
    expect(macBundleFromExecutable("/Applications/Corvo.app/Contents/Resources/helper")).toBeNull();
  });
});

describe("isAdHocSigned", () => {
  it("recognises a build with no developer identity", () => {
    expect(
      isAdHocSigned("Identifier=tech.corvo.bots.desktop\nSignature=adhoc\nTeamIdentifier=not set"),
    ).toBe(true);
  });

  it("does not take a signed build for one", () => {
    expect(
      isAdHocSigned(
        "Authority=Developer ID Application: Example (ABCDE12345)\nTeamIdentifier=ABCDE12345",
      ),
    ).toBe(false);
    expect(isAdHocSigned("")).toBe(false);
  });
});

describe("readPendingUpdate", () => {
  async function stage(zipBytes: string, sha512: string | null) {
    const pending = path.join(dir, "pending");
    await mkdir(pending, { recursive: true });
    await writeFile(path.join(pending, "corvo-mac-arm64.zip"), zipBytes);
    if (sha512 !== null) {
      await writeFile(
        path.join(pending, "update-info.json"),
        JSON.stringify({ fileName: "corvo-mac-arm64.zip", sha512 }),
      );
    }
  }
  const digest = (bytes: string) => createHash("sha512").update(bytes).digest("base64");

  it("returns the downloaded file once it matches the checksum the release published", async () => {
    await stage("zip bytes", digest("zip bytes"));
    expect(readPendingUpdate(dir)).toEqual({
      zip: path.join(dir, "pending", "corvo-mac-arm64.zip"),
    });
  });

  it("refuses a file that does not match, so a damaged download is never installed", async () => {
    await stage("zip bytes", digest("other bytes"));
    expect(readPendingUpdate(dir)).toBeNull();
  });

  it("returns nothing when no update was downloaded", async () => {
    expect(readPendingUpdate(dir)).toBeNull();
    await stage("zip bytes", null);
    expect(readPendingUpdate(dir)).toBeNull();
  });

  it("refuses an update whose file name points outside the cache", async () => {
    const pending = path.join(dir, "pending");
    await mkdir(pending, { recursive: true });
    await writeFile(
      path.join(pending, "update-info.json"),
      JSON.stringify({ fileName: "../../etc/passwd", sha512: "x" }),
    );
    expect(readPendingUpdate(dir)).toBeNull();
  });
});

describe("updateScript", () => {
  const input = {
    pid: 4242,
    zip: "/Users/o'neil/Library/Caches/corvo-updater/pending/corvo-mac-arm64.zip",
    bundle: "/Applications/Corvo.app",
    log: "/Users/o'neil/Library/Logs/Corvo-update.log",
    relaunch: true,
  };

  it("waits for the app to quit, swaps the bundle keeping a way back, and opens the new one", () => {
    const script = updateScript(input);
    expect(script).toContain("kill -0 4242");
    expect(script).toContain("ditto -x -k");
    expect(script).toContain("xattr -cr");
    expect(script).toMatch(/mv .*\.old/);
    expect(script).toContain('open "$BUNDLE"');
  });

  it("quotes every path, including one that holds a quote", () => {
    const script = updateScript(input);
    expect(script).toContain(
      "'/Users/o'\\''neil/Library/Caches/corvo-updater/pending/corvo-mac-arm64.zip'",
    );
  });

  it("puts the old app back if the new one cannot be put in place, and does not open a broken one", () => {
    const script = updateScript(input);
    expect(script).toMatch(/restore|ROLLBACK|rollback/);
  });

  it("can skip opening the app, for a test", () => {
    expect(updateScript({ ...input, relaunch: false })).not.toContain('open "$BUNDLE"');
  });
});
