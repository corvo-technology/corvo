import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The pinned release of agent-desktop (https://github.com/vercel-labs/agent-desktop, Apache-2.0),
 * which reads and operates desktop apps through the OS accessibility tree. A newer release is
 * adopted by changing the version and the checksums together, from its `checksums.txt`.
 */
export const AGENT_DESKTOP_VERSION = "1.0.2";

type Asset = { name: string; sha256: string };

const RELEASE_ASSETS: Readonly<Record<string, Asset>> = {
  "darwin-arm64": {
    name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-aarch64-apple-darwin.tar.gz`,
    sha256: "7bee385196d7b478de80cf05ca4304aaa38f0eba593b3406ad3c247c1773be19",
  },
  "darwin-x64": {
    name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-x86_64-apple-darwin.tar.gz`,
    sha256: "8edda6df17eafc042395502a823dbb8415bc8ac14835a6731e4d8becc9cb4121",
  },
  "win32-arm64": {
    name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-aarch64-pc-windows-msvc.tar.gz`,
    sha256: "a0ecd6e17e60a0bcfbb45533a72f2d3a7a73508769588273ef08b0477d2b9687",
  },
  "win32-x64": {
    name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-x86_64-pc-windows-msvc.tar.gz`,
    sha256: "2186c76e7df197c0e67365e45d36d869f74714c56bb8a73817e2a66f3e18e222",
  },
  "linux-arm64": {
    name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-aarch64-unknown-linux-gnu.tar.gz`,
    sha256: "864cb782e0afc8bf0df19622016b24bdbd1a83fc7749f784ee82aa49a7f845eb",
  },
  "linux-x64": {
    name: `agent-desktop-v${AGENT_DESKTOP_VERSION}-x86_64-unknown-linux-gnu.tar.gz`,
    sha256: "ad661b7a3fd8f990a769243f4889a240ca0e2c8dab3ef5bddd6019086c71e0b4",
  },
};

const RELEASES = "https://github.com/vercel-labs/agent-desktop/releases/download";

export function agentDesktopAsset(platform: NodeJS.Platform, arch: string): Asset | null {
  return RELEASE_ASSETS[`${platform}-${arch}`] ?? null;
}

type Install = {
  /** The folder tools live in; each version gets its own folder inside it. */
  dir: string;
  platform: NodeJS.Platform;
  arch: string;
  version?: string;
  assets?: Readonly<Record<string, Asset>>;
  download: (url: string) => Promise<Uint8Array>;
  extract: (archive: string, into: string) => Promise<void>;
};

/** Where the pinned build's program lives once installed. */
export function agentDesktopBinary(
  dir: string,
  platform: NodeJS.Platform,
  version = AGENT_DESKTOP_VERSION,
) {
  return path.join(
    dir,
    "agent-desktop",
    version,
    platform === "win32" ? "agent-desktop.exe" : "agent-desktop",
  );
}

/** Unpacks a `.tar.gz` with the system `tar`, which macOS, Linux and Windows 10+ all ship. */
export async function extractWithTar(archive: string, into: string): Promise<void> {
  await run("tar", ["-xzf", archive, "-C", into]);
}

/**
 * Makes sure the pinned build is on disk and returns its binary. The archive is checked against the
 * pinned checksum before anything is unpacked, and a version folder only appears once it is whole.
 */
export async function installAgentDesktop(options: Install): Promise<{ binary: string }> {
  const version = options.version ?? AGENT_DESKTOP_VERSION;
  const table = options.assets ?? RELEASE_ASSETS;
  const asset = table[`${options.platform}-${options.arch}`];
  if (!asset) throw new Error("Desktop control is not available on this computer.");

  const root = path.join(options.dir, "agent-desktop");
  const versionDir = path.join(root, version);
  const binary = agentDesktopBinary(options.dir, options.platform, version);
  if (await exists(binary)) return { binary };

  const bytes = await options.download(`${RELEASES}/v${version}/${asset.name}`);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== asset.sha256) {
    throw new Error("The downloaded desktop control file does not match its checksum.");
  }

  const staging = path.join(root, `.staging-${randomBytes(6).toString("hex")}`);
  try {
    await mkdir(staging, { recursive: true });
    const archive = path.join(staging, asset.name);
    await writeFile(archive, bytes);
    const unpacked = path.join(staging, "unpacked");
    await mkdir(unpacked);
    await options.extract(archive, unpacked);
    if (!(await exists(path.join(unpacked, path.basename(binary))))) {
      throw new Error("The desktop control download did not contain the program.");
    }
    await rm(versionDir, { recursive: true, force: true });
    await rename(unpacked, versionDir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return { binary };
}

/** The one command the local engine is allowed to run as an MCP server, at a path that never changes. */
export function desktopControlLauncherPath(dir: string, platform: NodeJS.Platform): string {
  return path.join(dir, "desktop-control", platform === "win32" ? "launch.cmd" : "launch.sh");
}

const shQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/**
 * Writes the launcher for the desktop control server. It runs one fixed program and ignores the
 * arguments and environment it is called with, so allowing the engine to start this path allows
 * nothing else: a server record cannot pass options to the program or smuggle in node options.
 */
export async function writeDesktopControlLauncher(input: {
  dir: string;
  platform: NodeJS.Platform;
  node: string;
  script: string;
  binary: string;
}): Promise<string> {
  const file = desktopControlLauncherPath(input.dir, input.platform);
  await mkdir(path.dirname(file), { recursive: true });
  // The tool refuses a temporary folder that is not private to the user, and the engine passes none.
  // It also keeps unix sockets there, so the folder must be short: the system's own is both.
  const tmp =
    input.platform === "darwin"
      ? "$(/usr/bin/getconf DARWIN_USER_TEMP_DIR)"
      : "/run/user/$(/usr/bin/id -u)";
  const body =
    input.platform === "win32"
      ? [
          "@echo off",
          "set NODE_OPTIONS=",
          "set ELECTRON_RUN_AS_NODE=1",
          `set "CORVO_AGENT_DESKTOP_BIN=${input.binary}"`,
          `"${input.node}" "${input.script}"`,
          "",
        ].join("\r\n")
      : [
          "#!/bin/sh",
          "# Runs the desktop control server. Arguments and the caller's environment are ignored.",
          `exec /usr/bin/env -i HOME="$HOME" USER="$USER" PATH=/usr/bin:/bin TMPDIR=${tmp} \\`,
          `  ELECTRON_RUN_AS_NODE=1 CORVO_AGENT_DESKTOP_BIN=${shQuote(input.binary)} \\`,
          `  ${shQuote(input.node)} ${shQuote(input.script)}`,
          "",
        ].join("\n");
  await writeFile(file, body, { mode: 0o700 });
  await chmod(file, 0o700);
  return file;
}

/** Whether a listing of windows worked: it needs Accessibility, so this is the real test of the grant. */
export function parseAccessibilityProbe(output: string): PermissionState {
  try {
    const parsed = JSON.parse(output) as { ok?: unknown; error?: { code?: unknown } };
    if (parsed.ok === true) return "granted";
    return parsed.error?.code === "PERM_DENIED" ? "denied" : "unknown";
  } catch {
    return "unknown";
  }
}

async function probeAccessibility(binary: string): Promise<PermissionState> {
  try {
    const { stdout } = await run(binary, ["list-windows"], { timeout: 10_000 });
    return parseAccessibilityProbe(stdout);
  } catch (error) {
    const stdout = (error as { stdout?: unknown }).stdout;
    return typeof stdout === "string" ? parseAccessibilityProbe(stdout) : "unknown";
  }
}

export type DesktopControlStatus = {
  supported: boolean;
  installed: boolean;
  permissions: DesktopPermissions;
};

/** What the app can say about desktop control right now, without installing anything. */
export async function desktopControlStatus(
  dir: string,
  platform: NodeJS.Platform,
  arch: string,
): Promise<DesktopControlStatus> {
  const supported = agentDesktopAsset(platform, arch) !== null;
  const binary = agentDesktopBinary(dir, platform);
  const installed = supported && (await exists(binary));
  if (!installed) return { supported, installed, permissions: UNKNOWN };
  // `permissions` reports Accessibility as denied after it was granted, so the grant is tested by use.
  const [accessibility, reported] = await Promise.all([
    probeAccessibility(binary),
    readDesktopPermissions(binary),
  ]);
  return { supported, installed, permissions: { ...reported, accessibility } };
}

/** Opens the system page where the person grants the permissions, with the tool's own guide. */
export async function openDesktopPermissionGuide(binary: string): Promise<void> {
  await run(binary, ["permissions", "--guide"], { timeout: 10_000 }).catch(() => undefined);
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

export type PermissionState = "granted" | "denied" | "unknown";
export type DesktopPermissions = {
  accessibility: PermissionState;
  screenRecording: PermissionState;
};

const UNKNOWN: DesktopPermissions = { accessibility: "unknown", screenRecording: "unknown" };

function stateOf(value: unknown): PermissionState {
  const state = (value as { state?: unknown } | undefined)?.state;
  return state === "granted" || state === "denied" ? state : "unknown";
}

/** Reads the output of `agent-desktop permissions`: only the two grants the tool needs. */
export function parseDesktopPermissions(output: string): DesktopPermissions {
  try {
    const parsed = JSON.parse(output) as { ok?: unknown; data?: Record<string, unknown> };
    if (parsed.ok !== true || !parsed.data) return UNKNOWN;
    return {
      accessibility: stateOf(parsed.data.accessibility),
      screenRecording: stateOf(parsed.data.screen_recording),
    };
  } catch {
    return UNKNOWN;
  }
}

/** Asks the installed tool which system permissions it has been given. */
export async function readDesktopPermissions(binary: string): Promise<DesktopPermissions> {
  try {
    const { stdout } = await run(binary, ["permissions"], { timeout: 10_000 });
    return parseDesktopPermissions(stdout);
  } catch (error) {
    // The command exits non-zero when a permission is missing but still prints its answer.
    const stdout = (error as { stdout?: unknown }).stdout;
    return typeof stdout === "string" ? parseDesktopPermissions(stdout) : UNKNOWN;
  }
}
