import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AcpCommand } from "./acp-client.js";
import { startOpenCodeModels } from "./opencode-models.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fake: AcpCommand = {
  command: process.execPath,
  args: [path.join(here, "test-support/fake-acp-agent.mjs")],
  cwd: here,
};
const secret = "c".repeat(32);

describe("OpenCode's free models as a local model server", () => {
  it("serves only the free models, and answers through the agent", async () => {
    const free = await startOpenCodeModels({ dataDir: here, secret, command: fake });
    try {
      expect(free?.models).toEqual(["opencode/big-pickle", "opencode/glm-free"]);
      const response = await fetch(`${free!.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "opencode/glm-free",
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      expect(await response.json()).toMatchObject({
        choices: [{ message: { content: "model:opencode/glm-free Hello world" } }],
      });
    } finally {
      await free?.close();
    }
  });

  it("does nothing when OpenCode is not installed", async () => {
    const none = await startOpenCodeModels({
      dataDir: here,
      secret,
      find: async () => undefined,
    });
    expect(none).toBeUndefined();
  });
});
