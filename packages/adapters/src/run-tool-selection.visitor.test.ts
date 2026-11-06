import { describe, expect, it } from "vitest";
import { builtinAgentTools } from "./builtin-tools.js";
import {
  selectBuiltinToolsForRun,
  VISITOR_BUILTIN_TOOL_NAMES,
  visitorConnectorTools,
} from "./run-tool-selection.js";

const select = (over: Partial<Parameters<typeof selectBuiltinToolsForRun>[0]> = {}) =>
  selectBuiltinToolsForRun({
    graphicalToolsAllowed: true,
    pageBrowserAllowed: true,
    groupId: null,
    trigger: "messaging",
    semanticMemoryEnabled: true,
    semanticMemoryForgets: true,
    messagingChannelRun: false,
    fleetManagement: true,
    followUpFromUser: true,
    ticketBoardEnabled: true,
    phoneCallsEnabled: true,
    historyRetrievalEnabled: true,
    cloudAgentEnabled: true,
    mediaImagesEnabled: true,
    mediaVideoEnabled: true,
    ...over,
  }).map((tool) => tool.name);

/** Groups named so the reason a tool is off is readable in a failure. */
const NEVER_FOR_VISITORS: Record<string, string[]> = {
  "the computer and files": [
    "shell",
    "computer_observe",
    "computer_act",
    "list_files",
    "read_file",
    "write_file",
    "attach_file",
    "open_path",
    "launch_app",
    "request_takeover",
  ],
  "the browser and the web": [
    "browser_navigate",
    "browser_snapshot",
    "browser_act",
    "web_search",
    "web_fetch",
  ],
  "memory, notes and the wiki": [
    "remember",
    "save_memory",
    "save_shared_memory",
    "recall_memory",
    "forget_memory",
    "wiki_index",
    "wiki_search",
    "wiki_read",
    "read_document",
    "search_history",
    "read_history",
    "scratchpad_list",
    "scratchpad_add",
  ],
  "secrets and connecting apps": [
    "request_secret",
    "generate_secret",
    "list_secrets",
    "secret_request",
    "forget_secret",
    "connect_app",
    "add_mcp_server",
  ],
  "the owner's tickets, routines and skills": [
    "board_tickets",
    "ticket_get",
    "ticket_update",
    "ticket_comment",
    "schedule_create",
    "schedule_list",
    "schedule_update",
    "schedule_cancel",
    "skill_read",
    "skill_create",
    "skill_update",
    "skill_delete",
    "store_skills",
    "skill_install",
  ],
  "managing and reaching other agents": [
    "list_fleet",
    "spawn_bot",
    "update_bot",
    "archive_bot",
    "create_space",
    "create_group",
    "update_group",
    "organize_bot",
    "message_bot",
    "handoff_to_bot",
    "install_agent",
    "store_agents",
    "run_subagent",
    "propose_instructions_update",
    "cloud_agent_launch",
  ],
  "calls and media": ["call_user", "end_call", "generate_image", "generate_video"],
  "asking the owner and planning": ["ask_user", "plan_set", "plan_update"],
};

describe("the visitor allowlist", () => {
  it("offers a visitor's run exactly the reply tool and ticket creation", () => {
    expect(select({ visitorRun: true }).sort()).toEqual(["message_user", "ticket_create"]);
    expect([...VISITOR_BUILTIN_TOOL_NAMES].sort()).toEqual(["message_user", "ticket_create"]);
  });

  it("offers no ticket tool where the ticket board is off", () => {
    expect(select({ visitorRun: true, ticketBoardEnabled: false })).toEqual(["message_user"]);
  });

  for (const [group, names] of Object.entries(NEVER_FOR_VISITORS)) {
    it(`withholds ${group} from a visitor, though the owner's run has them`, () => {
      // Some tools reach the owner's run only in some conditions (a live call, fleet switches),
      // so the control is the union over the owner's run variants.
      const owner = new Set([
        ...select(),
        ...select({ voiceCall: true }),
        ...select({ trigger: "user" }),
      ]);
      const visitor = select({ visitorRun: true, voiceCall: true });
      for (const name of names) {
        expect(owner.has(name), `the control: ${name} is a real tool`).toBe(true);
        expect(visitor, name).not.toContain(name);
      }
    });
  }

  it("withholds every built-in tool not on the allowlist, including any added later", () => {
    const visitor = new Set(select({ visitorRun: true }));
    for (const tool of builtinAgentTools) {
      if (!VISITOR_BUILTIN_TOOL_NAMES.has(tool.name))
        expect(visitor.has(tool.name), tool.name).toBe(false);
    }
  });

  it("leaves the owner's run as it was", () => {
    expect(select()).toContain("shell");
    expect(select({ visitorRun: false })).toContain("message_bot");
  });
});

describe("visitorConnectorTools", () => {
  const tools = [
    { name: "LINEAR_CREATE_ISSUE", route: { connectorId: "composio" } },
    { name: "GMAIL_FETCH_EMAILS", route: { connectorId: "composio" } },
    {
      name: "search",
      route: { connectorId: "installed", resourceId: "Install-1", catalogGroup: "Docs" },
    },
    { name: "mcp_tool", route: { connectorId: "mcp", resourceId: "server-1" } },
    { name: "no_route" },
  ];

  it("offers nothing when nothing is ticked", () => {
    expect(visitorConnectorTools(tools, new Set())).toEqual([]);
  });

  it("keeps a Composio app by its name, an installed app by its id or label, an MCP server by its id", () => {
    expect(visitorConnectorTools(tools, new Set(["linear"])).map((t) => t.name)).toEqual([
      "LINEAR_CREATE_ISSUE",
    ]);
    expect(visitorConnectorTools(tools, new Set(["install-1"])).map((t) => t.name)).toEqual([
      "search",
    ]);
    expect(visitorConnectorTools(tools, new Set(["docs"])).map((t) => t.name)).toEqual(["search"]);
    expect(visitorConnectorTools(tools, new Set(["server-1"])).map((t) => t.name)).toEqual([
      "mcp_tool",
    ]);
  });

  it("never keeps a tool it cannot tie to a ticked app", () => {
    expect(visitorConnectorTools(tools, new Set(["unrelated"]))).toEqual([]);
  });
});
