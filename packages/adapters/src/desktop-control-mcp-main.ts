import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { agentDesktopRunner, createDesktopControlServer } from "./desktop-control-mcp.js";

// The program the app starts as a local MCP server. The app passes the installed binary's path.
const binary = process.env.CORVO_AGENT_DESKTOP_BIN;
if (!binary) {
  process.stderr.write("CORVO_AGENT_DESKTOP_BIN is not set.\n");
  process.exit(1);
}
await createDesktopControlServer(agentDesktopRunner(binary)).connect(new StdioServerTransport());
