import { describe, expect, it } from "vitest";
import {
  BoardStatusLabelsSchema,
  CreateTicketInput,
  GetTicketInput,
  isTicketCompletedStatus,
  mergeTicketFields,
  parseTicketRef,
  RenameBoardInput,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketSchema,
  UpdateTicketInput,
} from "./board.js";

describe("parseTicketRef", () => {
  it("matches the prefix case-insensitively and normalizes it", () => {
    expect(parseTicketRef("rak-42")).toEqual({ prefix: "RAK", number: 42 });
    expect(parseTicketRef("  RaK-7  ")).toEqual({ prefix: "RAK", number: 7 });
  });

  it("rejects a reference whose prefix differs from the board", () => {
    expect(parseTicketRef("RAK-42", "RAK")).toEqual({ prefix: "RAK", number: 42 });
    expect(parseTicketRef("rak-42", "RAK")).toEqual({ prefix: "RAK", number: 42 });
    expect(parseTicketRef("ABC-42", "RAK")).toBeNull();
  });

  it("rejects malformed references", () => {
    for (const value of ["RAK", "RAK-", "-42", "RAK 42", "RAK-0", "RAK-007", "42-RAK", ""]) {
      expect(parseTicketRef(value)).toBeNull();
    }
  });

  it("accepts the largest ticket number the database can store", () => {
    expect(parseTicketRef("RAK-2147483647")).toEqual({ prefix: "RAK", number: 2147483647 });
  });

  it.each([
    ["above the database maximum", "2147483648"],
    ["outside JavaScript integer precision", "9007199254740993"],
    ["within the API reference length limit", "9".repeat(115)],
    ["converted to infinity", "9".repeat(400)],
  ])("rejects a ticket number outside the database range: %s", (_label, number) => {
    expect(parseTicketRef(`RAK-${number}`)).toBeNull();
  });
});

describe("ticket contracts", () => {
  const ticket = {
    id: "ticket-1",
    boardId: "board-1",
    spaceId: "space-1",
    number: 1,
    ref: "RAK-1",
    title: "Ship the board",
    description: null,
    status: "todo",
    priority: "normal",
    assigneeBotId: null,
    createdByBotId: null,
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  };

  it("accepts a ticket document and rejects unknown statuses", () => {
    expect(TicketSchema.parse(ticket).status).toBe("todo");
    expect(TicketSchema.parse({ ...ticket, status: "closed" }).status).toBe("closed");
    expect(() => TicketSchema.parse({ ...ticket, status: "archived" })).toThrow();
  });

  it("orders statuses with closed last and treats done and closed as completed", () => {
    expect(TICKET_STATUSES).toEqual(["todo", "doing", "review", "blocked", "done", "closed"]);
    expect(isTicketCompletedStatus("done")).toBe(true);
    expect(isTicketCompletedStatus("closed")).toBe(true);
    expect(isTicketCompletedStatus("review")).toBe(false);
  });

  it("always creates tickets with a known priority and no caller-chosen status", () => {
    expect(CreateTicketInput.parse({ title: "Ship", assigneeBotId: "bot-1" })).toEqual({
      title: "Ship",
      assigneeBotId: "bot-1",
      priority: "normal",
    });
    expect(
      CreateTicketInput.parse({ title: "Ship", assigneeBotId: "bot-1", priority: "urgent" })
        .priority,
    ).toBe("urgent");
    const withoutStatus = CreateTicketInput.parse({
      title: "Ship",
      assigneeBotId: "bot-1",
      status: "doing",
    } as never);
    expect(withoutStatus).not.toHaveProperty("status");
    expect(() =>
      CreateTicketInput.parse({ title: "Ship", assigneeBotId: "bot-1", priority: "whenever" }),
    ).toThrow();
    expect(TICKET_PRIORITIES).toEqual(["low", "normal", "high", "urgent"]);
  });

  it("requires exactly one of id or ref when fetching", () => {
    expect(GetTicketInput.parse({ ref: "RAK-1" })).toEqual({ ref: "RAK-1" });
    expect(GetTicketInput.parse({ id: "ticket-1" })).toEqual({ id: "ticket-1" });
    expect(() => GetTicketInput.parse({})).toThrow();
    expect(() => GetTicketInput.parse({ id: "ticket-1", ref: "RAK-1" })).toThrow();
  });

  it("requires an owner bot when creating a ticket", () => {
    expect(() => CreateTicketInput.parse({ title: "Ship" })).toThrow();
  });

  it("changes the owner without allowing it to be cleared", () => {
    expect(UpdateTicketInput.parse({ id: "ticket-1", assigneeBotId: "bot-2" }).assigneeBotId).toBe(
      "bot-2",
    );
    expect(() => UpdateTicketInput.parse({ id: "ticket-1", assigneeBotId: null })).toThrow();
  });
});

describe("column labels", () => {
  it("accepts a partial map of short, non-empty labels", () => {
    expect(BoardStatusLabelsSchema.parse({ doing: "In contact" })).toEqual({ doing: "In contact" });
    expect(BoardStatusLabelsSchema.parse({})).toEqual({});
  });

  it("refuses an empty label, an unknown status and a label over 40 characters", () => {
    expect(BoardStatusLabelsSchema.safeParse({ doing: "  " }).success).toBe(false);
    expect(BoardStatusLabelsSchema.safeParse({ started: "Go" }).success).toBe(false);
    expect(BoardStatusLabelsSchema.safeParse({ doing: "x".repeat(41) }).success).toBe(false);
  });

  it("lets a rename carry labels alone, and null removes one", () => {
    expect(RenameBoardInput.safeParse({ statusLabels: { doing: null } }).success).toBe(true);
    expect(RenameBoardInput.safeParse({}).success).toBe(false);
  });
});

describe("mergeTicketFields", () => {
  it("adds a field and replaces one by name, ignoring case and keeping the first spelling", () => {
    const first = mergeTicketFields([], { Contact: "ana@example.com" });
    expect(first).toEqual([{ name: "Contact", value: "ana@example.com" }]);
    expect(mergeTicketFields(first, { contact: "bo@example.com", Source: "Fair" })).toEqual([
      { name: "Contact", value: "bo@example.com" },
      { name: "Source", value: "Fair" },
    ]);
  });

  it("removes a field whose new value is empty", () => {
    const current = [
      { name: "Contact", value: "ana@example.com" },
      { name: "Source", value: "Fair" },
    ];
    expect(mergeTicketFields(current, { contact: "" })).toEqual([
      { name: "Source", value: "Fair" },
    ]);
  });

  it("refuses to hold more than 20 fields", () => {
    const full = Array.from({ length: 20 }, (_, index) => ({ name: `f${index}`, value: "x" }));
    expect(() => mergeTicketFields(full, { extra: "x" })).toThrow(
      "A ticket holds at most 20 fields.",
    );
    expect(mergeTicketFields(full, { f0: "y" })).toHaveLength(20);
  });

  it("is what the update input accepts", () => {
    expect(UpdateTicketInput.safeParse({ id: "t1", fields: { Contact: "a" } }).success).toBe(true);
    expect(UpdateTicketInput.safeParse({ id: "t1", fields: { "": "a" } }).success).toBe(false);
    expect(UpdateTicketInput.safeParse({ id: "t1", fields: { a: "x".repeat(501) } }).success).toBe(
      false,
    );
  });
});
