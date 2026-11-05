import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEngineLog, ENGINE_LOG_FILE } from "./engine-log.js";

const dirs: string[] = [];
function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "engine-log-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("engine log", () => {
  it("echoes every line and appends it to the file", () => {
    const dir = path.join(tempDir(), "logs");
    const echoed: string[] = [];
    const log = createEngineLog(dir, (line) => echoed.push(line));
    log(["first", "second"]);
    log(["third"]);
    expect(echoed).toEqual(["first", "second", "third"]);
    expect(readFileSync(path.join(dir, ENGINE_LOG_FILE), "utf8")).toBe("first\nsecond\nthird\n");
  });

  it("keeps the previous file when this one grows past its cap", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, ENGINE_LOG_FILE), "x".repeat(5 * 1024 * 1024 + 1));
    createEngineLog(dir, () => undefined)(["fresh"]);
    expect(readFileSync(path.join(dir, ENGINE_LOG_FILE), "utf8")).toBe("fresh\n");
    expect(readFileSync(path.join(dir, `${ENGINE_LOG_FILE}.1`), "utf8")).toHaveLength(
      5 * 1024 * 1024 + 1,
    );
  });

  it("never throws when the folder cannot be written", () => {
    const blocked = path.join(tempDir(), "file");
    writeFileSync(blocked, "");
    const echoed: string[] = [];
    expect(() =>
      createEngineLog(path.join(blocked, "inside"), (l) => echoed.push(l))(["a"]),
    ).not.toThrow();
    expect(echoed).toEqual(["a"]);
  });
});
