import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
  return {
    supported,
    installed,
    permissions: installed ? await readDesktopPermissions(binary) : UNKNOWN,
  };
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
