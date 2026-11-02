import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { AcpCommand } from "./acp-client.js";
import { startAcpBridge } from "./acp-openai-bridge.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fake: AcpCommand = {
  command: process.execPath,
  args: [path.join(here, "test-support/fake-acp-agent.mjs")],
  cwd: here,
};
const secret = "a".repeat(32);
const models = [
  { id: "opencode/big-pickle", name: "Big Pickle" },
  { id: "opencode/glm-free", name: "GLM Free" },
];

let bridge: Awaited<ReturnType<typeof startAcpBridge>> | undefined;
afterEach(async () => {
  await bridge?.close();
  bridge = undefined;
});

async function start() {
  bridge = await startAcpBridge({ command: fake, models, secret });
  return bridge;
}

const json = { "content-type": "application/json" };
const chat = (body: unknown) => ({ method: "POST", headers: json, body: JSON.stringify(body) });

describe("ACP to OpenAI bridge", () => {
  it("lists the models it serves", async () => {
    const { baseUrl } = await start();
    const response = await fetch(`${baseUrl}/models`);
    expect(await response.json()).toMatchObject({
      object: "list",
      data: [
        { id: "opencode/big-pickle", object: "model" },
        { id: "opencode/glm-free", object: "model" },
      ],
    });
  });

  it("answers a chat completion from the chosen model", async () => {
    const { baseUrl } = await start();
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      chat({ model: "opencode/glm-free", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      object: "chat.completion",
      model: "opencode/glm-free",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "model:opencode/glm-free Hello world" },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("streams a chat completion as server-sent events", async () => {
    const { baseUrl } = await start();
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      chat({
        model: "opencode/big-pickle",
        stream: true,
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    const frames = body.split("\n\n").filter(Boolean);
    expect(frames.at(-1)).toBe("data: [DONE]");
    const chunks = frames.slice(0, -1).map(
      (frame) =>
        JSON.parse(frame.replace(/^data: /, "")) as {
          choices: { delta: { content?: string }; finish_reason: string | null }[];
        },
    );
    expect(chunks.map((chunk) => chunk.choices[0]?.delta.content ?? "").join("")).toBe(
      "model:opencode/big-pickle Hello world",
    );
    expect(chunks.at(-1)?.choices[0]?.finish_reason).toBe("stop");
  });

  it("gives the agent the whole conversation, system text first", async () => {
    const { baseUrl } = await start();
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      chat({
        model: "opencode/big-pickle",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: [{ type: "text", text: "ECHO one" }] },
          { role: "assistant", content: "two" },
          { role: "user", content: "three" },
        ],
      }),
    );
    const reply = (await response.json()) as { choices: { message: { content: string } }[] };
    expect(reply.choices[0]?.message.content).toBe(
      "Be brief.\n\nUser: ECHO one\n\nAssistant: two\n\nUser: three",
    );
  });

  it("refuses a request without the secret path, from a browser, or not JSON", async () => {
    const { port, baseUrl } = await start();
    const wrong = await fetch(`http://127.0.0.1:${port}/${"b".repeat(32)}/v1/models`);
    expect(wrong.status).toBe(404);
    const fromBrowser = await fetch(`${baseUrl}/models`, {
      headers: { origin: "https://evil.test" },
    });
    expect(fromBrowser.status).toBe(403);
    const notJson = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    expect(notJson.status).toBe(415);
  });

  it("rejects a model it does not serve", async () => {
    const { baseUrl } = await start();
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      chat({ model: "openrouter/vendor/paid", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "model_not_found" } });
  });

  it("keeps serving after a client gives up on a turn", async () => {
    const { baseUrl } = await start();
    const controller = new AbortController();
    const slow = fetch(`${baseUrl}/chat/completions`, {
      ...chat({
        model: "opencode/big-pickle",
        stream: true,
        messages: [{ role: "user", content: "SLOW" }],
      }),
      signal: controller.signal,
    });
    const response = await slow;
    await response.body!.getReader().read();
    controller.abort();
    const next = await fetch(
      `${baseUrl}/chat/completions`,
      chat({ model: "opencode/big-pickle", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(next.status).toBe(200);
  });
});
