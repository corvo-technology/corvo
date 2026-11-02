import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_DESKTOP_VERSION,
  agentDesktopAsset,
  installAgentDesktop,
  parseDesktopPermissions,
} from "./agent-desktop.js";

const archive = Buffer.from("fake archive bytes");
const assets = {
  "darwin-arm64": {
    name: "agent-desktop-v9.9.9-aarch64-apple-darwin.tar.gz",
    sha256: createHash("sha256").update(archive).digest("hex"),
  },
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "corvo-agent-desktop-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const extract = vi.fn(async (_archive: string, into: string) => {
  await writeFile(path.join(into, "agent-desktop"), "#!/bin/sh\n", { mode: 0o755 });
});

function install(overrides: Partial<Parameters<typeof installAgentDesktop>[0]> = {}) {
  return installAgentDesktop({
    dir,
    platform: "darwin",
    arch: "arm64",
    version: "9.9.9",
    assets,
    download: vi.fn(async () => archive),
    extract,
    ...overrides,
  });
}

describe("agentDesktopAsset", () => {
  it("pins a release asset with its checksum for each supported platform", () => {
    expect(agentDesktopAsset("darwin", "arm64")).toMatchObject({
      name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-aarch64-apple-darwin.tar.gz`,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    for (const [platform, arch] of [
      ["darwin", "x64"],
      ["win32", "x64"],
      ["win32", "arm64"],
      ["linux", "x64"],
      ["linux", "arm64"],
    ] as const) {
      expect(agentDesktopAsset(platform, arch), `${platform}-${arch}`).not.toBeNull();
    }
  });

  it("has no build for a platform the tool does not ship for", () => {
    expect(agentDesktopAsset("freebsd", "x64")).toBeNull();
    expect(agentDesktopAsset("darwin", "ia32")).toBeNull();
  });
});

describe("installAgentDesktop", () => {
  it("downloads from the project's release, checks the checksum and returns the binary", async () => {
    const download = vi.fn(async () => archive);
    const { binary } = await install({ download });
    expect(download).toHaveBeenCalledWith(
      "https://github.com/vercel-labs/agent-desktop/releases/download/v9.9.9/agent-desktop-v9.9.9-aarch64-apple-darwin.tar.gz",
    );
    expect(binary).toBe(path.join(dir, "agent-desktop", "9.9.9", "agent-desktop"));
    expect(await readFile(binary, "utf8")).toContain("#!/bin/sh");
  });

  it("does not download again once it is installed", async () => {
    await install();
    const download = vi.fn(async () => archive);
    await install({ download });
    expect(download).not.toHaveBeenCalled();
  });

  it("refuses an archive that does not match the pinned checksum and leaves nothing behind", async () => {
    await expect(install({ download: vi.fn(async () => Buffer.from("tampered")) })).rejects.toThrow(
      /checksum/i,
    );
    await expect(stat(path.join(dir, "agent-desktop", "9.9.9"))).rejects.toThrow();
    expect(extract).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("9.9.9"));
  });

  it("says so when there is no build for this machine", async () => {
    await expect(install({ platform: "freebsd" as NodeJS.Platform })).rejects.toThrow(
      /not available/i,
    );
  });
});

describe("parseDesktopPermissions", () => {
  it("reads the state of each permission from the tool's output", () => {
    const output = JSON.stringify({
      command: "permissions",
      ok: true,
      data: {
        accessibility: { state: "denied" },
        automation: { state: "unknown" },
        screen_recording: { state: "granted" },
      },
    });
    expect(parseDesktopPermissions(output)).toEqual({
      accessibility: "denied",
      screenRecording: "granted",
    });
  });

  it("treats anything it cannot read as unknown", () => {
    expect(parseDesktopPermissions("not json")).toEqual({
      accessibility: "unknown",
      screenRecording: "unknown",
    });
    expect(parseDesktopPermissions('{"ok":false}')).toEqual({
      accessibility: "unknown",
      screenRecording: "unknown",
    });
  });
});
