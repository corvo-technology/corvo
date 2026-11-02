import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AcpCommand } from "./acp-client.js";
import { runAcpTurn } from "./acp-client.js";

/**
 * A small OpenAI-compatible server in front of an ACP agent program, so a model that only
 * answers through that program (OpenCode's free tier) can be used like any local model server.
 * Chat only: the agent is not given tools and its requests to use its own are refused.
 */
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_TURNS = 4;

interface ChatMessage {
  role?: unknown;
  content?: unknown;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && (part as { type?: unknown }).type === "text"
        ? String((part as { text?: unknown }).text ?? "")
        : "",
    )
    .filter(Boolean)
    .join("\n");
}

/** The agent takes one prompt, so the conversation is written out as a transcript. */
export function transcript(messages: readonly ChatMessage[]): string {
  const blocks: string[] = [];
  for (const message of messages) {
    const text = textOf(message.content).trim();
    if (!text) continue;
    if (message.role === "system" || message.role === "developer") blocks.push(text);
    else blocks.push(`${message.role === "assistant" ? "Assistant" : "User"}: ${text}`);
  }
  return blocks.join("\n\n");
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function failure(response: ServerResponse, status: number, code: string, message: string) {
  send(response, status, { error: { message, type: "invalid_request_error", code } });
}

/**
 * The secret is part of the path because the model client sends a fixed placeholder key, and
 * browsers cannot read the path of a server they were not told about. Requests that carry an
 * Origin header are refused, so a web page cannot use the bridge either.
 */
export async function startAcpBridge(options: {
  command: AcpCommand;
  models: readonly { id: string; name: string }[];
  secret: string;
  port?: number;
}) {
  if (!/^[A-Za-z0-9]{32,}$/.test(options.secret)) throw new Error("Invalid bridge secret");
  const prefix = `/${options.secret}/v1`;
  const served = new Set(options.models.map((model) => model.id));
  let running = 0;

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (!url.pathname.startsWith(`${prefix}/`)) {
        response.writeHead(404).end();
        return;
      }
      if (request.headers.origin) {
        response.writeHead(403).end();
        return;
      }
      const route = url.pathname.slice(prefix.length);
      if (request.method === "GET" && route === "/models") {
        send(response, 200, {
          object: "list",
          data: options.models.map((model) => ({
            id: model.id,
            object: "model",
            created: 0,
            owned_by: "opencode",
          })),
        });
        return;
      }
      if (request.method !== "POST" || route !== "/chat/completions") {
        response.writeHead(404).end();
        return;
      }
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        response.writeHead(415).end();
        return;
      }
      let body: { model?: unknown; messages?: unknown; stream?: unknown };
      try {
        body = (await readJson(request)) as typeof body;
      } catch {
        failure(response, 400, "invalid_json", "The request is not valid JSON.");
        return;
      }
      const model = typeof body.model === "string" ? body.model : "";
      if (!served.has(model)) {
        failure(response, 404, "model_not_found", `The model ${model || "(none)"} is not served.`);
        return;
      }
      const prompt = Array.isArray(body.messages) ? transcript(body.messages as ChatMessage[]) : "";
      if (!prompt) {
        failure(response, 400, "empty_prompt", "There is no message to answer.");
        return;
      }
      if (running >= MAX_TURNS) {
        failure(response, 429, "busy", "Too many conversations are running. Try again shortly.");
        return;
      }
      running += 1;
      const abort = new AbortController();
      response.once("close", () => abort.abort());
      const id = `chatcmpl-${randomUUID()}`;
      const created = Math.floor(Date.now() / 1000);
      const chunk = (delta: Record<string, string>, finish: string | null) =>
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`;
      try {
        const events = runAcpTurn(options.command, { model, prompt, signal: abort.signal });
        if (body.stream === true) {
          response.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-store",
          });
          response.write(chunk({ role: "assistant" }, null));
          for await (const event of events) {
            if (event.type === "text") response.write(chunk({ content: event.text }, null));
          }
          response.write(chunk({}, "stop"));
          response.end("data: [DONE]\n\n");
          return;
        }
        let content = "";
        for await (const event of events) if (event.type === "text") content += event.text;
        send(response, 200, {
          id,
          object: "chat.completion",
          created,
          model,
          choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The agent failed.";
        if (response.headersSent) response.end();
        else failure(response, 502, "agent_failed", message);
      } finally {
        running -= 1;
      }
    } catch {
      if (!response.headersSent) response.writeHead(500).end();
      else response.end();
    }
  });

  server.listen(options.port ?? 0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The bridge did not start");
  return {
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}${prefix}`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
