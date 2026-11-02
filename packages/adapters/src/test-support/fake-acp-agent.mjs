// A deterministic ACP agent for tests: it speaks the protocol over stdio and
// answers from the prompt text, so the client can be checked with no real CLI.
import { Readable, Writable } from "node:stream";
import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";

const MODELS = [
  { value: "opencode/big-pickle", name: "OpenCode Zen/Big Pickle" },
  { value: "opencode/glm-free", name: "OpenCode Zen/GLM Free" },
  { value: "openrouter/vendor/paid", name: "OpenRouter/Paid" },
];

// A program that dies at once with a message, like a CLI that cannot open its data.
if (process.env.FAKE_ACP_MODE === "exit") {
  process.stderr.write("Database is not empty and has no session table\n");
  process.exit(1);
}

let model = MODELS[0].value;
let cancel = null;

const stream = ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
new AgentSideConnection(
  (conn) => ({
    async initialize() {
      return { protocolVersion: 1, agentCapabilities: {}, authMethods: [] };
    },
    async newSession() {
      return {
        sessionId: "session-1",
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            type: "select",
            currentValue: model,
            options: MODELS,
          },
        ],
      };
    },
    async setSessionConfigOption(params) {
      if (params.configId === "model") model = String(params.value);
      return { configOptions: [] };
    },
    async prompt(params) {
      const text = params.prompt.map((block) => (block.type === "text" ? block.text : "")).join("");
      const say = (chunk) =>
        conn.sessionUpdate({
          sessionId: params.sessionId,
          update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: chunk } },
        });
      if (text.includes("ECHO")) {
        await say(text);
        return { stopReason: "end_turn" };
      }
      if (text.includes("SLOW")) {
        await say("started");
        await new Promise((resolve) => {
          cancel = resolve;
        });
        return { stopReason: "cancelled" };
      }
      if (text.includes("TOOL")) {
        await conn.sessionUpdate({
          sessionId: params.sessionId,
          update: { sessionUpdate: "tool_call", toolCallId: "call-1", title: "Run a command", kind: "execute", status: "pending" },
        });
        const answer = await conn.requestPermission({
          sessionId: params.sessionId,
          toolCall: { toolCallId: "call-1", title: "Run a command" },
          options: [
            { optionId: "allow", name: "Allow", kind: "allow_once" },
            { optionId: "reject", name: "Reject", kind: "reject_once" },
          ],
        });
        await say(
          answer.outcome.outcome === "selected" ? `permission:${answer.outcome.optionId}` : "permission:cancelled",
        );
        return { stopReason: "end_turn" };
      }
      await say(`model:${model} `);
      await say("Hello ");
      await say("world");
      return { stopReason: "end_turn" };
    },
    async cancel() {
      cancel?.();
    },
  }),
  stream,
);
