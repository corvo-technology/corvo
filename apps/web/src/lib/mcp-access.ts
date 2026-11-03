import type { BotMcpServer } from "@corvo/contracts";
import { rpc } from "./rpc";

/**
 * Give an agent an MCP server, or take it away. replace() overwrites the agent's whole list, so
 * the change is merged into the assignments it already has.
 */
export function setAgentAccess(
  botId: string,
  serverId: string,
  current: readonly BotMcpServer[],
  allowed: boolean,
) {
  const others = current.filter((entry) => entry.serverId !== serverId);
  return rpc.mcp.assignments.replace({
    botId,
    assignments: allowed
      ? [...others, { serverId, allowAllTools: true, allowedTools: [] }]
      : others,
  });
}
