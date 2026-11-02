import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type RunResult = { code: number; output: string };
type Run = (
  file: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> },
) => Promise<RunResult>;

async function filesUnder(dir: string, base = ""): Promise<string[]> {
  const entries = await readdir(path.join(dir, base), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = path.join(base, entry.name);
      return entry.isDirectory() ? filesUnder(dir, relative) : [relative];
    }),
  );
  return nested.flat().sort();
}

/** The image's name carries a hash of its files, so an app that ships a changed image builds it again. */
export async function computerImageTag(contextDir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of await filesUnder(contextDir)) {
    hash.update(file);
    hash.update(await readFile(path.join(contextDir, file)));
  }
  return `corvo/computer:app-${hash.digest("hex").slice(0, 12)}`;
}

/** Runs a program to its end, keeping the tail of what it printed. */
export const runProgram: Run = (file, args, options) =>
  new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-4_000);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    child.on("error", (error) => resolve({ code: 1, output: String(error) }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });

/**
 * Makes sure the computer image exists, building it with Docker's own build when it does not. The
 * supervisor can only use the classic builder, which does not understand what the image's file
 * needs, so the app builds it here and the supervisor finds it ready.
 */
export async function ensureComputerImage(input: {
  docker: string;
  contextDir: string;
  tag: string;
  run?: Run;
}): Promise<{ built: boolean }> {
  const run = input.run ?? runProgram;
  const present = await run(input.docker, ["image", "inspect", input.tag], {});
  if (present.code === 0) return { built: false };
  const build = await run(input.docker, ["build", "-t", input.tag, "."], {
    cwd: input.contextDir,
    env: { DOCKER_BUILDKIT: "1" },
  });
  if (build.code !== 0) {
    throw new Error(`Building the computer image failed:\n${build.output.slice(-1_500)}`);
  }
  return { built: true };
}
