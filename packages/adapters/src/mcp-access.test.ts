import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutorDeps } from "./executor-deps.js";
import { requestSpaceAppAccess } from "./mcp-access.js";
import type * as RunMessagesModule from "./run-messages.js";

const persist = vi.hoisted(() => vi.fn());
vi.mock("./run-messages.js", async (importOriginal) => ({
  ...(await importOriginal<typeof RunMessagesModule>()),
  persistMessageInTransaction: persist,
}));

const run = { id: "run-1", spaceId: "space-1", userId: "user-1", threadId: "t-1", botId: "bot-1" };

function setup(servers: unknown[], recent: unknown[] = [], createError?: unknown) {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    message: { findMany: vi.fn(async () => recent) },
  };
  const notify = vi.fn(async () => undefined);
  const deps = {
    prisma: {
      mcpServer: {
        findMany: vi.fn(async (_args: unknown) => servers),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          if (createError) throw createError;
          return { id: "srv-new", secretId: null, ...args.data };
        }),
      },
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    },
    events: { notify },
  } as unknown as ExecutorDeps;
  return { deps, notify, tx };
}

const posthog = {
  id: "srv-ph",
  name: "PostHog",
  slug: "posthog",
  transport: "streamable_http",
  endpoint: "https://mcp.posthog.com/mcp",
  secretId: "secret-1",
  assignments: [] as { id: string }[],
};

beforeEach(() => {
  persist.mockReset().mockResolvedValue({ eventSeq: 7, firstResponseRunId: undefined });
});

describe("requestSpaceAppAccess", () => {
  it("shows the approval card for an app added to the workspace but not assigned to the agent", async () => {
    const { deps, notify } = setup([posthog]);
    const result = await requestSpaceAppAccess(deps, run, "posthog");
    expect(result).toMatchObject({ status: "pending" });
    expect(persist.mock.calls[0]?.[2]).toBe("bot");
    expect(persist.mock.calls[0]?.[3]).toEqual([
      expect.objectContaining({
        kind: "mcp_approval",
        serverId: "srv-ph",
        name: "PostHog",
        needsOAuth: false,
        status: "pending",
      }),
    ]);
    expect(notify).toHaveBeenCalledWith("t-1", 7, undefined);
  });

  it("looks only at the owner's enabled servers", async () => {
    const { deps } = setup([posthog]);
    await requestSpaceAppAccess(deps, run, "PostHog");
    const query = (deps.prisma.mcpServer.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: { spaceId: "space-1", userId: "user-1", enabled: true },
    });
  });

  it("matches by name too, ignoring case", async () => {
    const { deps } = setup([{ ...posthog, slug: "ph-1" }]);
    expect(await requestSpaceAppAccess(deps, run, " POSTHOG ")).toMatchObject({
      status: "pending",
    });
  });

  it("leads with sign-in when the server has no credential yet", async () => {
    const { deps } = setup([{ ...posthog, secretId: null }]);
    await requestSpaceAppAccess(deps, run, "posthog");
    expect(persist.mock.calls[0]?.[3]?.[0]).toMatchObject({ needsOAuth: true });
  });

  it("says it is already available when the agent has it", async () => {
    const { deps } = setup([{ ...posthog, assignments: [{ id: "a" }] }]);
    expect(await requestSpaceAppAccess(deps, run, "posthog")).toMatchObject({
      status: "connected",
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not show a second card while one is still pending", async () => {
    const { deps, notify } = setup(
      [posthog],
      [{ blocks: [{ kind: "mcp_approval", serverId: "srv-ph", status: "pending" }] }],
    );
    expect(await requestSpaceAppAccess(deps, run, "posthog")).toMatchObject({ status: "pending" });
    expect(persist).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("adds a catalog app that signs in with OAuth and shows its card, leading with the sign-in", async () => {
    const { deps } = setup([]);
    const result = await requestSpaceAppAccess(deps, run, "trello");
    expect(result).toMatchObject({ status: "pending" });
    const create = (deps.prisma.mcpServer.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(create.data).toMatchObject({
      spaceId: "space-1",
      userId: "user-1",
      slug: "trello",
      name: "Trello",
      endpoint: "https://mcp.trello.com/v1",
      enabled: true,
    });
    expect(persist.mock.calls[0]?.[3]?.[0]).toMatchObject({
      kind: "mcp_approval",
      serverId: "srv-new",
      name: "Trello",
      needsOAuth: true,
    });
  });

  it("sends the user to the Store for an app that needs a key, and never asks for it in chat", async () => {
    const { deps } = setup([]);
    const result = await requestSpaceAppAccess(deps, run, "posthog");
    expect(result).toEqual({
      error: expect.stringMatching(/needs an API key.*never to paste a key in chat/),
    });
    expect(deps.prisma.mcpServer.create).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("sends the user to the desktop app when the sign-in needs it", async () => {
    const { deps } = setup([]);
    const result = await requestSpaceAppAccess(deps, run, "canva");
    expect(result).toEqual({ error: expect.stringContaining("needs the desktop app") });
    expect(deps.prisma.mcpServer.create).not.toHaveBeenCalled();
  });

  it("says a turned-off server with the same name exists instead of failing", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { code: "P2002" });
    const { deps } = setup([], [], duplicate);
    expect(await requestSpaceAppAccess(deps, run, "trello")).toEqual({
      error: expect.stringContaining("turned off"),
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("leaves a name it does not know to the connector catalog", async () => {
    const { deps } = setup([posthog]);
    expect(await requestSpaceAppAccess(deps, run, "gmail")).toBeUndefined();
  });
});
