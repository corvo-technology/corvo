import { describe, expect, it, vi } from "vitest";
import { detectDocker } from "./docker-detect.js";

function probe(over: Partial<Parameters<typeof detectDocker>[0]> = {}) {
  return {
    platform: "darwin" as const,
    env: { PATH: "/usr/bin" },
    exists: (file: string) => file === "/usr/local/bin/docker",
    run: vi.fn(async (_file: string, _args: string[]) => "28.3.2"),
    ...over,
  };
}

describe("detectDocker", () => {
  it("finds Docker where an app started from Finder does not look, and checks that it answers", async () => {
    const options = probe();
    expect(await detectDocker(options)).toBe(true);
    expect(options.run).toHaveBeenCalledWith("/usr/local/bin/docker", [
      "info",
      "--format",
      "{{.ServerVersion}}",
    ]);
  });

  it("finds Docker on the PATH", async () => {
    const options = probe({
      env: { PATH: "/opt/tools/bin:/usr/bin" },
      exists: (file) => file === "/opt/tools/bin/docker",
    });
    expect(await detectDocker(options)).toBe(true);
  });

  it("says no when Docker is not installed", async () => {
    expect(await detectDocker(probe({ exists: () => false }))).toBe(false);
  });

  it("says no when Docker is installed but not running", async () => {
    const options = probe({
      run: vi.fn(async () => {
        throw new Error("Cannot connect to the Docker daemon");
      }),
    });
    expect(await detectDocker(options)).toBe(false);
  });

  it("looks for the Windows program name there", async () => {
    const options = probe({
      platform: "win32",
      env: { PATH: "C:\\Tools", ProgramFiles: "C:\\Program Files" },
      exists: (file) => file === "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    });
    expect(await detectDocker(options)).toBe(true);
  });
});
