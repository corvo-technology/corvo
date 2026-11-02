import { accessSync, constants, readdirSync } from "node:fs";
import path from "node:path";

/** Which AI command-line tools are installed on this computer. Only whether, never where or who. */
export type LocalTools = { claude: boolean; codex: boolean };

type Probe = {
  platform: NodeJS.Platform;
  home: string;
  pathDirs: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  isExecutable: (file: string) => boolean;
  listDir: (dir: string) => string[];
};

function candidateDirs(probe: Probe, join: (...parts: string[]) => string): string[] {
  const { home, env } = probe;
  const dirs = [...probe.pathDirs];
  if (probe.platform === "win32") {
    if (env.APPDATA) dirs.push(join(env.APPDATA, "npm"));
    if (env.LOCALAPPDATA) dirs.push(join(env.LOCALAPPDATA, "Programs", "claude"));
    return dirs;
  }
  // A desktop app does not inherit the shell's PATH, so look where these tools usually land.
  dirs.push(
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    join(home, ".npm-global", "bin"),
    join(home, ".bun", "bin"),
    join(home, ".volta", "bin"),
  );
  const nvm = join(home, ".nvm", "versions", "node");
  for (const version of probe.listDir(nvm)) dirs.push(join(nvm, version, "bin"));
  return dirs;
}

export function detectLocalTools(probe: Probe): LocalTools {
  const join = probe.platform === "win32" ? path.win32.join : path.posix.join;
  const dirs = candidateDirs(probe, join);
  const suffixes = probe.platform === "win32" ? [".cmd", ".exe", ".ps1"] : [""];
  const found = (tool: string) =>
    dirs.some((dir) =>
      suffixes.some((suffix) => probe.isExecutable(join(dir, `${tool}${suffix}`))),
    );
  return { claude: found("claude"), codex: found("codex") };
}

/** The probe for the machine this app runs on. */
export function detectInstalledTools(): LocalTools {
  return detectLocalTools({
    platform: process.platform,
    home: process.env.HOME ?? process.env.USERPROFILE ?? "",
    pathDirs: (process.env.PATH ?? "").split(path.delimiter).filter(Boolean),
    env: process.env,
    isExecutable: (file) => {
      try {
        accessSync(file, process.platform === "win32" ? constants.F_OK : constants.X_OK);
        return true;
      } catch {
        return false;
      }
    },
    listDir: (dir) => {
      try {
        return readdirSync(dir);
      } catch {
        return [];
      }
    },
  });
}
