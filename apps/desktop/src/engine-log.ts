import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";

export const ENGINE_LOG_FILE = "engine.log";
const MAX_LOG_BYTES = 5 * 1024 * 1024;

/**
 * Where the engine's output goes once the start screen is gone: the terminal the app was opened
 * from and a file that keeps the last two runs. A failed run is otherwise explained only by a
 * short message, and the reason sits in this output.
 */
export function createEngineLog(
  dir: string,
  echo: (line: string) => void = (line) => process.stderr.write(`${line}\n`),
): (lines: readonly string[]) => void {
  const file = path.join(dir, ENGINE_LOG_FILE);
  let ready = false;
  return (lines) => {
    for (const line of lines) echo(line);
    try {
      if (!ready) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        ready = true;
      }
      try {
        if (statSync(file).size > MAX_LOG_BYTES) renameSync(file, `${file}.1`);
      } catch {
        // No file yet.
      }
      appendFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
    } catch {
      // Logging must never stop the engine.
    }
  };
}
