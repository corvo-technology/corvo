import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { explainOpenCodeExit, findOpenCode, openCodeCommand } from "./opencode-acp.js";

describe("OpenCode as an ACP agent", () => {
  it("runs `opencode acp` with a database of Corvo's own", () => {
    const command = openCodeCommand({ binary: "/bin/opencode", dataDir: "/data/opencode" });
    expect(command).toMatchObject({
      command: "/bin/opencode",
      args: ["acp"],
      cwd: "/data/opencode",
      env: { OPENCODE_DB: "/data/opencode/opencode.db" },
    });
  });

  it("explains a database that a newer OpenCode changed", () => {
    expect(explainOpenCodeExit("Error: Database is not empty and has no session table")).toMatch(
      /newer OpenCode changed it/,
    );
    expect(explainOpenCodeExit("something else")).toBeUndefined();
  });

  it("finds OpenCode on the PATH, or in its own install folder", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "opencode-home-"));
    expect(await findOpenCode({ PATH: "" }, home)).toBeUndefined();
    const bin = path.join(home, ".opencode", "bin");
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, "opencode"), "#!/bin/sh\n", { mode: 0o755 });
    expect(await findOpenCode({ PATH: "" }, home)).toBe(path.join(bin, "opencode"));
    const onPath = await mkdtemp(path.join(os.tmpdir(), "opencode-path-"));
    await writeFile(path.join(onPath, "opencode"), "#!/bin/sh\n", { mode: 0o755 });
    expect(await findOpenCode({ PATH: onPath }, home)).toBe(path.join(onPath, "opencode"));
  });
});
