import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentRuntimeEvent } from "@corvo/adapter-kit";
import { describe, expect, it } from "vitest";
import type { AcpCommand } from "./acp-client.js";
import { isFreeOpenCodeModel, listAcpModels, runAcpTurn } from "./acp-client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fake: AcpCommand = {
  command: process.execPath,
  args: [path.join(here, "test-support/fake-acp-agent.mjs")],
  cwd: here,
};

async function collect(events: AsyncIterable<AgentRuntimeEvent>) {
  const out: AgentRuntimeEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

const textOf = (events: AgentRuntimeEvent[]) =>
  events.flatMap((event) => (event.type === "text" ? [event.text] : [])).join("");

describe("ACP client", () => {
  it("lists the agent's models and marks the free ones", async () => {
    expect(await listAcpModels(fake)).toEqual([
      { id: "opencode/big-pickle", name: "OpenCode Zen/Big Pickle", free: true },
      { id: "opencode/glm-free", name: "OpenCode Zen/GLM Free", free: true },
      { id: "openrouter/vendor/paid", name: "OpenRouter/Paid", free: false },
    ]);
  });

  it("calls only OpenCode's own free tier free", () => {
    expect(isFreeOpenCodeModel("opencode/big-pickle")).toBe(true);
    expect(isFreeOpenCodeModel("opencode/beam-free")).toBe(true);
    expect(isFreeOpenCodeModel("opencode/gpt-5")).toBe(false);
    expect(isFreeOpenCodeModel("openrouter/vendor/model-free")).toBe(false);
  });

  it("streams the reply from the chosen model and finishes", async () => {
    const events = await collect(runAcpTurn(fake, { model: "opencode/glm-free", prompt: "hi" }));
    expect(textOf(events)).toBe("model:opencode/glm-free Hello world");
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("refuses the agent's tool permission requests", async () => {
    const events = await collect(
      runAcpTurn(fake, { model: "opencode/big-pickle", prompt: "TOOL" }),
    );
    expect(textOf(events)).toBe("permission:reject");
    expect(events).toContainEqual({ type: "progress", text: "Run a command", activity: true });
  });

  it("lets a caller approve a permission request", async () => {
    const asked: string[] = [];
    const events = await collect(
      runAcpTurn(fake, {
        model: "opencode/big-pickle",
        prompt: "TOOL",
        decidePermission: async (request) => {
          asked.push(request.title);
          return "allow";
        },
      }),
    );
    expect(asked).toEqual(["Run a command"]);
    expect(textOf(events)).toBe("permission:allow");
  });

  it("stops the agent when the turn is aborted", async () => {
    const controller = new AbortController();
    const events: AgentRuntimeEvent[] = [];
    for await (const event of runAcpTurn(fake, {
      model: "opencode/big-pickle",
      prompt: "SLOW",
      signal: controller.signal,
    })) {
      events.push(event);
      if (event.type === "text") controller.abort();
    }
    expect(textOf(events)).toBe("started");
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("explains why the agent program stopped, from what it printed", async () => {
    const dies: AcpCommand = {
      ...fake,
      env: { FAKE_ACP_MODE: "exit" },
      explainExit: (output) =>
        output.includes("no session table") ? "Update the agent." : undefined,
    };
    await expect(listAcpModels(dies)).rejects.toThrow("Update the agent.");
    await expect(collect(runAcpTurn(dies, { model: "x", prompt: "hi" }))).rejects.toThrow(
      "Update the agent.",
    );
    await expect(listAcpModels({ ...dies, explainExit: undefined })).rejects.toThrow(
      /stopped unexpectedly/i,
    );
  });

  it("says plainly when the agent program cannot start", async () => {
    const missing: AcpCommand = { command: "/nonexistent/acp-agent", args: [], cwd: here };
    await expect(collect(runAcpTurn(missing, { model: "x", prompt: "hi" }))).rejects.toThrow(
      /could not start/i,
    );
    await expect(listAcpModels(missing)).rejects.toThrow(/could not start/i);
  });
});
