import type { AcpCommand } from "./acp-client.js";
import { listAcpModels } from "./acp-client.js";
import { startAcpBridge } from "./acp-openai-bridge.js";
import { findOpenCode, openCodeCommand } from "./opencode-acp.js";

/**
 * OpenCode's free models behind a local OpenAI-compatible address, so they work as the
 * operator-configured local model server. Undefined when OpenCode is not installed here.
 */
export async function startOpenCodeModels(options: {
  /** A folder Corvo owns for OpenCode's database. */
  dataDir: string;
  /** Part of the address: only a caller that was told it can use the bridge. */
  secret: string;
  port?: number;
  /** Test seams. */
  command?: AcpCommand;
  find?: () => Promise<string | undefined>;
}) {
  let command = options.command;
  if (!command) {
    const binary = await (options.find ?? findOpenCode)();
    if (!binary) return undefined;
    command = openCodeCommand({ binary, dataDir: options.dataDir });
  }
  const free = (await listAcpModels(command)).filter((model) => model.free);
  if (free.length === 0) return undefined;
  const bridge = await startAcpBridge({
    command,
    models: free,
    secret: options.secret,
    ...(options.port !== undefined ? { port: options.port } : {}),
  });
  return {
    baseUrl: bridge.baseUrl,
    models: free.map((model) => model.id),
    close: bridge.close,
  };
}
