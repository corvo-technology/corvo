import { describe, expect, it } from "vitest";
import { detectLocalTools } from "./local-tools.js";

function probe(files: string[], overrides: Partial<Parameters<typeof detectLocalTools>[0]> = {}) {
  const present = new Set(files);
  return {
    platform: "darwin" as const,
    home: "/Users/ana",
    pathDirs: ["/usr/bin"],
    env: {},
    isExecutable: (file: string) => present.has(file),
    listDir: (dir: string) =>
      [...present]
        .filter((file) => file.startsWith(`${dir}/`))
        .map((file) => file.slice(dir.length + 1).split("/")[0] ?? ""),
    ...overrides,
  };
}

describe("detectLocalTools", () => {
  it("finds nothing on a machine without the tools", () => {
    expect(detectLocalTools(probe([]))).toEqual({ claude: false, codex: false });
  });

  it("finds a tool on the PATH", () => {
    expect(detectLocalTools(probe(["/usr/bin/codex"]))).toEqual({ claude: false, codex: true });
  });

  it("finds tools in the places an app started from Finder does not search", () => {
    const found = detectLocalTools(
      probe(["/opt/homebrew/bin/codex", "/Users/ana/.claude/local/claude"]),
    );
    expect(found).toEqual({ claude: true, codex: true });
  });

  it("finds a tool installed under a Node version manager", () => {
    const found = detectLocalTools(probe(["/Users/ana/.nvm/versions/node/v22.1.0/bin/claude"]));
    expect(found.claude).toBe(true);
  });

  it("uses the Windows executable names", () => {
    const found = detectLocalTools(
      probe(["C:\\Users\\ana\\AppData\\Roaming\\npm\\codex.cmd"], {
        platform: "win32",
        home: "C:\\Users\\ana",
        pathDirs: [],
        env: { APPDATA: "C:\\Users\\ana\\AppData\\Roaming" },
      }),
    );
    expect(found).toEqual({ claude: false, codex: true });
  });
});
