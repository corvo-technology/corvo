import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type Probe = {
  platform: NodeJS.Platform;
  env: Readonly<Record<string, string | undefined>>;
  exists: (file: string) => boolean;
  run: (file: string, args: string[]) => Promise<string>;
};

function candidates(probe: Probe): string[] {
  const win = probe.platform === "win32";
  const join = win ? path.win32.join : path.posix.join;
  const name = win ? "docker.exe" : "docker";
  const onPath = (probe.env.PATH ?? probe.env.Path ?? "")
    .split(win ? ";" : ":")
    .filter(Boolean)
    .map((dir) => join(dir, name));
  // An app started from Finder or the Start menu does not inherit the shell's PATH, so also look
  // where Docker Desktop and the common package managers put the program.
  const known = win
    ? [
        join(
          probe.env.ProgramFiles ?? "C:\\Program Files",
          "Docker",
          "Docker",
          "resources",
          "bin",
          name,
        ),
      ]
    : [
        "/usr/local/bin/docker",
        "/opt/homebrew/bin/docker",
        "/usr/bin/docker",
        "/Applications/Docker.app/Contents/Resources/bin/docker",
      ];
  return [...onPath, ...known];
}

/** Whether Docker is installed here and its engine answers, so isolated computers can run. */
export async function detectDocker(probe: Probe): Promise<boolean> {
  const program = candidates(probe).find((file) => probe.exists(file));
  if (!program) return false;
  try {
    await probe.run(program, ["info", "--format", "{{.ServerVersion}}"]);
    return true;
  } catch {
    return false;
  }
}

/** The check for this machine, bounded so a stuck Docker cannot hold the app's start. */
export function detectDockerHere(): Promise<boolean> {
  return detectDocker({
    platform: process.platform,
    env: process.env,
    exists: existsSync,
    run: async (file, args) => (await execFileAsync(file, args, { timeout: 5_000 })).stdout,
  });
}
