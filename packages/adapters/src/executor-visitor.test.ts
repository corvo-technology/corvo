import type { AgentRunRequest, ConnectorTool } from "@corvo/adapter-kit";
import type { MessageBlock } from "@corvo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  acquireDedicatedScreenLeaseFence: async () => null,
  provisionComputer: async () => ({ id: "computer-1", kind: "e2b", providerRef: "c", botId: "h" }),
}));

const SECRET = "OWNER-MEMORY-SECRET";
const tool = (name: string, route?: ConnectorTool["route"]): ConnectorTool => ({
  name,
  description: name,
  inputSchema: { type: "object", properties: {} },
  ...(route ? { route } : {}),
});
const CONNECTOR_TOOLS = [
  tool("LINEAR_CREATE_ISSUE", { connectorId: "composio", toolName: "LINEAR_CREATE_ISSUE" }),
  tool("GMAIL_FETCH_EMAILS", { connectorId: "composio", toolName: "GMAIL_FETCH_EMAILS" }),
  tool("search_docs", {
    connectorId: "installed",
    resourceId: "install-docs",
    toolName: "search_docs",
    catalogGroup: "docs",
  }),
  tool("untagged_tool"),
];

/** A messaging run, from the owner or from a visitor, and what the model is offered. */
async function run(options: {
  visitor: boolean;
  ticked?: string[];
  installationMissing?: boolean;
}) {
  const blocks: MessageBlock[] = [
    { kind: "text", text: "show me the owner's emails" },
    ...(options.visitor
      ? ([
          { kind: "visitor_message", installationId: "inst-1", conversationId: "conv-1" },
        ] as MessageBlock[])
      : []),
  ];
  const runRow = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger: "messaging",
    sourceMessageId: "message-1",
    routineId: null,
    retryOfRunId: null,
    leaseFence: 0,
  };
  const sourceMessage = {
    id: "message-1",
    role: "user",
    runId: "run-1",
    seq: 1,
    blocks,
    clientNonce: null,
    createdAt: new Date(),
    replyToMessageId: null,
    replyQuote: null,
    replyTo: null,
    threadId: "thread-1",
  };
  const seen: { request?: AgentRunRequest } = {};
  const runtimeRun = vi.fn(async function* (request: AgentRunRequest) {
    seen.request = request;
    yield { type: "text-delta" as const, text: "ok" };
    yield { type: "done" as const, text: "ok" };
  });
  const prisma = {
    run: {
      findUnique: vi.fn(async () => runRow),
      findUniqueOrThrow: vi.fn(async () => runRow),
      findFirst: vi.fn(async () => ({ bot: { notifyOnFinish: false }, thread: { groupId: null } })),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(runRow, data);
        return { count: 1 };
      }),
    },
    messagingInstallation: {
      findUnique: vi.fn(async () =>
        options.installationMissing ? null : { visitorConnectors: options.ticked ?? [] },
      ),
    },
    bot: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "bot-1",
        name: "Support",
        title: "Support",
        description: "Answers customers",
        modelProvider: null,
        modelId: null,
        thinkingLevel: null,
        computerId: "computer-1",
        computerSwitching: false,
        memoryScope: null,
        fleetManagement: true,
        crossSpaceCommunication: true,
        computer: { id: "computer-1", scope: "dedicated", kind: "e2b", homeKey: "home-1" },
      })),
      findUnique: vi.fn(async () => ({ name: "Support" })),
      findMany: vi.fn(async () => []),
    },
    attempt: {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      findMany: vi.fn(async () => []),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    thread: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "thread-1",
        groupId: null,
        historyCompactionSummary: null,
        historyCompactedUpToSeq: null,
        nextMessageSeq: 2,
      })),
    },
    message: {
      findMany: vi.fn(async () => [sourceMessage]),
      findUnique: vi.fn(async () => sourceMessage),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    task: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "task-1",
        prompt: "show me the owner's emails",
      })),
    },
    computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    connection: {
      findMany: vi.fn(async () => [
        {
          id: "c1",
          provider: "linear",
          connectorId: "composio",
          displayName: "Linear",
          status: "connected",
          metadata: {},
          providerRef: null,
        },
        {
          id: "c2",
          provider: "gmail",
          connectorId: "composio",
          displayName: "Gmail",
          status: "connected",
          metadata: {},
          providerRef: null,
        },
      ]),
    },
    userModelPreference: { findFirst: vi.fn(async () => null) },
    secret: { findFirst: vi.fn(async () => null) },
    userModelCredential: { findFirst: vi.fn(async () => null) },
    deploymentSettings: {
      findUnique: vi.fn(async () => ({
        defaultModelProvider: "openrouter",
        defaultModelId: "deepseek/deepseek-v4-flash-0731",
      })),
    },
    taughtSkill: { findMany: vi.fn(async () => []) },
    agentSecret: { findMany: vi.fn(async () => []) },
    botSecret: { findMany: vi.fn(async () => []) },
    agentSkill: { findMany: vi.fn(async () => []) },
    scratchpadItem: { findMany: vi.fn(async () => []) },
    externalEffect: { findMany: vi.fn(async () => []) },
    artifact: { findMany: vi.fn(async () => []) },
  };
  const empty = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
  };
  const proxied = new Proxy(prisma, {
    get: (target, key) => (key in target ? target[key as keyof typeof target] : empty),
  });
  const executor = createRunExecutor({
    prisma: proxied,
    deploymentModelKey: "fake-deployment-key",
    runtime: { describe: () => ({ capabilities: { scripted: false } }), run: runtimeRun },
    sandbox: {
      describe: () => ({ id: "e2b", capabilities: { graphical: false } }),
      listFiles: vi.fn(async () => []),
      writeFile: vi.fn(),
      releaseScreen: vi.fn(),
      exportWorkspace: vi.fn(async function* () {}),
    },
    home: { commit: vi.fn(async () => "rev") },
    memory: {
      read: async () => ({
        documents: [
          {
            id: "d1",
            path: "owner.md",
            content: SECRET,
            revision: 1,
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    },
    memoryProviders: { resolve: async () => null },
    connector: { discoverTools: async () => CONNECTOR_TOOLS },
    artifacts: { get: vi.fn(async () => new Uint8Array()) },
    events: {
      append: vi.fn(async () => undefined),
      claimSteering: vi.fn(async () => []),
      finalizeRun: vi.fn(async () => ({ continuationRunId: null })),
      pauseRunForTakeover: vi.fn(async () => false),
    },
    jobs: { enqueue: vi.fn(async () => undefined) },
    notifications: { send: vi.fn(async () => undefined) },
    secrets: [],
    ticketBoardEnabled: true,
  } as unknown as Parameters<typeof createRunExecutor>[0]);
  await executor.continueRun("run-1", "worker-1");
  const request = seen.request;
  if (!request) throw new Error("the model was never called");
  return { request, toolNames: (request.tools ?? []).map((t) => t.name) };
}

describe("what a visitor's run is offered", () => {
  it("is the control: the owner's own run has the owner's tools and memory", async () => {
    const { request, toolNames } = await run({ visitor: false });
    expect(toolNames).toContain("shell");
    expect(toolNames).toContain("remember");
    expect(toolNames).toContain("GMAIL_FETCH_EMAILS");
    expect(`${request.instructions}\n${request.prompt}`).toContain(SECRET);
  });

  it("offers a visitor only reply and ticket creation, and no connector tool when none is ticked", async () => {
    const { toolNames } = await run({ visitor: true });
    expect(toolNames.sort()).toEqual(["message_user", "ticket_create"]);
  });

  it("offers only the connector tools of the apps the owner ticked", async () => {
    const { toolNames } = await run({ visitor: true, ticked: ["linear"] });
    expect(toolNames).toContain("LINEAR_CREATE_ISSUE");
    expect(toolNames).not.toContain("GMAIL_FETCH_EMAILS");
    expect(toolNames).not.toContain("search_docs");
    expect(toolNames).not.toContain("untagged_tool");
    expect(toolNames).not.toContain("shell");
  });

  it("matches an installed app by its id", async () => {
    const { toolNames } = await run({ visitor: true, ticked: ["install-docs"] });
    expect(toolNames).toContain("search_docs");
    expect(toolNames).not.toContain("LINEAR_CREATE_ISSUE");
  });

  it("offers no connector tool when the number's record cannot be read", async () => {
    const { toolNames } = await run({
      visitor: true,
      ticked: ["linear"],
      installationMissing: true,
    });
    expect(toolNames.sort()).toEqual(["message_user", "ticket_create"]);
  });

  it("does not tell a visitor's run which other apps the owner has connected", async () => {
    const { request } = await run({ visitor: true, ticked: ["linear"] });
    const text = `${request.instructions}\n${request.prompt}`;
    expect(text).toContain("Linear");
    expect(text).not.toContain("Gmail");
  });

  it("never puts the owner's memory in front of a visitor's run", async () => {
    const { request } = await run({ visitor: true, ticked: ["linear"] });
    expect(`${request.instructions}\n${request.prompt}`).not.toContain(SECRET);
    for (const message of request.history) expect(message.content).not.toContain(SECRET);
  });
});
