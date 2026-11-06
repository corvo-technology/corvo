import type { MessagingSurface } from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import {
  deliverMessagingOutbound,
  type MessagingDeliveryDeps,
  mirrorMessagingOutbound,
} from "./messaging-delivery.js";

type Row = Record<string, unknown> & {
  id: string;
  status: string;
  threadId: string | null;
  idempotencyKey: string;
};

function setup(
  options: {
    conversation?: boolean;
    replies?: Array<{ id: string; text: string }>;
    outboxScope?: MessagingDeliveryDeps["outboxScope"];
  } = {},
) {
  const rows: Row[] = [];
  const sendToThread = vi.fn(async () => ({ handle: "wa-1" }));
  const messaging = { sendToThread, platforms: () => [] } as unknown as MessagingSurface;
  const replies = options.replies ?? [{ id: "m-1", text: "Hello, how can I help?" }];
  const prisma = {
    run: {
      findUnique: vi.fn(async () => ({
        id: "run-1",
        botId: "bot-1",
        trigger: "messaging",
        sourceMessage: {
          blocks: [
            { kind: "text", text: "hi" },
            { kind: "visitor_message", installationId: "inst-1", conversationId: "conv-1" },
          ],
        },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    message: {
      findMany: vi.fn(async () =>
        replies.map((reply) => ({ id: reply.id, blocks: [{ kind: "text", text: reply.text }] })),
      ),
    },
    externalConversation: {
      findUnique: vi.fn(async () =>
        options.conversation === false
          ? null
          : {
              provider: "whatsapp-web",
              conversationId: "whatsapp-web:inst-1:15550200@s.whatsapp.net",
            },
      ),
    },
    messagingIdentity: { findUnique: vi.fn(async () => null) },
    messagingOutbound: {
      createMany: vi.fn(async ({ data }: { data: Array<Omit<Row, "id" | "status">> }) => {
        for (const row of data) {
          if (rows.some((existing) => existing.idempotencyKey === row.idempotencyKey)) continue;
          rows.push({ id: `row-${rows.length + 1}`, status: "pending", ...row } as Row);
        }
      }),
      findMany: vi.fn(async ({ where }: { where: { status: string } }) =>
        rows.filter((row) => row.status === where.status),
      ),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; status?: string };
          data: Record<string, unknown>;
        }) => {
          const row = rows.find(
            (r) => r.id === where.id && (where.status ? r.status === where.status : true),
          );
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          Object.assign(rows.find((r) => r.id === where.id) ?? {}, data);
        },
      ),
    },
  } as unknown as PrismaClient;
  const deps: MessagingDeliveryDeps = {
    prisma,
    messaging,
    events: { sendUserMessage: vi.fn(), notify: vi.fn() } as never,
    jobs: { enqueue: vi.fn(async () => undefined) },
    artifacts: { get: vi.fn() } as never,
    ...(options.outboxScope ? { outboxScope: options.outboxScope } : {}),
  };
  return { deps, rows, sendToThread };
}

describe("mirroring a visitor's run", () => {
  it("queues each reply for the visitor's own chat, as plain text", async () => {
    const { deps, rows } = setup({
      replies: [
        { id: "m-1", text: "Hello" },
        { id: "m-2", text: "Anything else?" },
      ],
    });
    await mirrorMessagingOutbound(deps, "run-1");
    expect(rows.map((row) => [row.idempotencyKey, row.kind, row.threadId, row.body])).toEqual([
      ["msg:m-1", "group", "whatsapp-web:inst-1:15550200@s.whatsapp.net", "Hello"],
      ["msg:m-2", "group", "whatsapp-web:inst-1:15550200@s.whatsapp.net", "Anything else?"],
    ]);
  });

  it("queues each reply once, however many times the run is mirrored", async () => {
    const { deps, rows } = setup();
    await mirrorMessagingOutbound(deps, "run-1");
    await mirrorMessagingOutbound(deps, "run-1");
    expect(rows).toHaveLength(1);
  });

  it("queues nothing when the conversation no longer exists", async () => {
    const { deps, rows } = setup({ conversation: false });
    await mirrorMessagingOutbound(deps, "run-1");
    expect(rows).toHaveLength(0);
  });
});

describe("draining the outbox by where a row goes", () => {
  const withRows = async (scope?: MessagingDeliveryDeps["outboxScope"]) => {
    const ctx = setup({ outboxScope: scope });
    ctx.rows.push(
      {
        id: "wa",
        status: "pending",
        kind: "group",
        threadId: "whatsapp-web:inst-1:x@s.whatsapp.net",
        idempotencyKey: "a",
        body: "to whatsapp",
        createdAt: new Date(1),
      },
      {
        id: "other",
        status: "pending",
        kind: "group",
        threadId: "slack:C1",
        idempotencyKey: "b",
        body: "to slack",
        createdAt: new Date(2),
      },
    );
    await deliverMessagingOutbound(ctx.deps, {}, {} as never);
    return ctx;
  };

  it("sends everything when no scope is set", async () => {
    const { sendToThread } = await withRows();
    expect(sendToThread).toHaveBeenCalledTimes(2);
  });

  it("leaves WhatsApp rows alone in a process that does not hold the sockets", async () => {
    const { rows, sendToThread } = await withRows({ skipThreadPrefix: "whatsapp-web:" });
    expect(sendToThread).toHaveBeenCalledTimes(1);
    expect(rows.find((row) => row.id === "wa")?.status).toBe("pending");
  });

  it("sends only WhatsApp rows in the process that holds the sockets", async () => {
    const { rows, sendToThread } = await withRows({ onlyThreadPrefix: "whatsapp-web:" });
    expect(sendToThread).toHaveBeenCalledTimes(1);
    expect(sendToThread).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "whatsapp-web:inst-1:x@s.whatsapp.net" }),
      expect.anything(),
    );
    expect(rows.find((row) => row.id === "other")?.status).toBe("pending");
  });
});
