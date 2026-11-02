import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computerImageTag, ensureComputerImage } from "./computer-image.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "corvo-computer-image-"));
  await writeFile(path.join(dir, "Dockerfile"), "FROM scratch\n");
  await mkdir(path.join(dir, "sub"));
  await writeFile(path.join(dir, "sub", "start.sh"), "#!/bin/sh\n");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("computerImageTag", () => {
  it("names the image after what it is built from, so a changed image is built again", async () => {
    const first = await computerImageTag(dir);
    expect(first).toMatch(/^corvo\/computer:app-[a-f0-9]{12}$/);
    expect(await computerImageTag(dir)).toBe(first);
    await writeFile(path.join(dir, "sub", "start.sh"), "#!/bin/sh\necho changed\n");
    expect(await computerImageTag(dir)).not.toBe(first);
  });
});

describe("ensureComputerImage", () => {
  const tag = "corvo/computer:app-abc";

  it("does nothing when the image is already there", async () => {
    const run = vi.fn(async () => ({ code: 0, output: "" }));
    expect(
      await ensureComputerImage({ docker: "/usr/bin/docker", contextDir: dir, tag, run }),
    ).toEqual({
      built: false,
    });
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      "/usr/bin/docker",
      ["image", "inspect", tag],
      expect.anything(),
    );
  });

  it("builds it with Docker's own build, which supports what the image's file needs", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ code: 1, output: "No such image" })
      .mockResolvedValueOnce({ code: 0, output: "built" });
    const result = await ensureComputerImage({
      docker: "/usr/bin/docker",
      contextDir: dir,
      tag,
      run,
    });
    expect(result).toEqual({ built: true });
    expect(run).toHaveBeenLastCalledWith("/usr/bin/docker", ["build", "-t", tag, "."], {
      cwd: dir,
      env: { DOCKER_BUILDKIT: "1" },
    });
  });

  it("reports the end of the build output when it fails, so the reason is not lost", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ code: 1, output: "" })
      .mockResolvedValueOnce({ code: 1, output: `${"line\n".repeat(200)}ERROR: step failed` });
    await expect(
      ensureComputerImage({ docker: "/usr/bin/docker", contextDir: dir, tag, run }),
    ).rejects.toThrow(/ERROR: step failed/);
  });
});
