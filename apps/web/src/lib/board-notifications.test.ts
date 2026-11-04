import type { BoardEvent } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import { boardMoveNotice, deliverBoardNotice } from "./board-notifications";

const builtin = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  blocked: "Blocked",
  done: "Done",
  closed: "Won't do",
};

function event(
  moved: Partial<NonNullable<BoardEvent["moved"]>> | null,
  ticketId = "t1",
): BoardEvent {
  return {
    spaceId: "s",
    ticketId,
    createdAt: "2026-11-05T10:00:00Z",
    ...(moved
      ? {
          moved: {
            ref: "RAK-3",
            title: "Call Ana",
            status: "review",
            previousStatus: "doing",
            byBotId: "bot-1",
            byName: "Planner",
            ...moved,
          },
        }
      : {}),
  };
}

describe("boardMoveNotice", () => {
  it("speaks when an agent moves a card to review or to done", () => {
    expect(boardMoveNotice(event({}), builtin)).toEqual({
      name: "Planner",
      ref: "RAK-3",
      status: "In review",
      body: "Call Ana",
      tag: "t1:review",
    });
    expect(boardMoveNotice(event({ status: "done" }), builtin)?.status).toBe("Done");
  });

  it("uses the name the board gave the column", () => {
    expect(boardMoveNotice(event({ statusLabel: "Check" }), builtin)?.status).toBe("Check");
  });

  it("stays quiet for other columns, for a person's own move and for a bare signal", () => {
    expect(boardMoveNotice(event({ status: "doing" }), builtin)).toBeNull();
    expect(boardMoveNotice(event({ status: "blocked" }), builtin)).toBeNull();
    expect(boardMoveNotice(event({ byBotId: null, byName: "Pat" }), builtin)).toBeNull();
    expect(boardMoveNotice(event(null), builtin)).toBeNull();
  });

  it("names the card when the mover has no name", () => {
    expect(boardMoveNotice(event({ byName: null }), builtin)?.name).toBe("");
  });
});

describe("deliverBoardNotice", () => {
  const notice = {
    name: "Planner",
    ref: "RAK-3",
    status: "In review",
    body: "Call Ana",
    tag: "t1:review",
  };
  function context(over: Partial<Parameters<typeof deliverBoardNotice>[1]> = {}) {
    const shown: string[] = [];
    return {
      shown,
      ctx: {
        pageVisible: false,
        windowFocused: false,
        permission: "granted" as const,
        seen: new Set<string>(),
        key: "2026-11-05T10:00:00Z",
        show: (_notice: typeof notice) => void shown.push(notice.tag),
        ...over,
      },
    };
  }

  it("shows the notice when the window is hidden or not focused", () => {
    const hidden = context();
    expect(deliverBoardNotice(notice, hidden.ctx)).toBe("delivered");
    expect(hidden.shown).toEqual(["t1:review"]);
    const unfocused = context({ pageVisible: true, windowFocused: false });
    expect(deliverBoardNotice(notice, unfocused.ctx)).toBe("delivered");
  });

  it("stays quiet while the person is looking at the app", () => {
    const looking = context({ pageVisible: true, windowFocused: true });
    expect(deliverBoardNotice(notice, looking.ctx)).toBe("discarded");
    expect(looking.shown).toEqual([]);
  });

  it("shows a replayed signal only once", () => {
    const once = context();
    expect(deliverBoardNotice(notice, once.ctx)).toBe("delivered");
    expect(deliverBoardNotice(notice, once.ctx)).toBe("discarded");
    expect(once.shown).toHaveLength(1);
  });

  it("waits for permission when it was not asked yet, and gives up when it was refused", () => {
    const asking = context({ permission: "default" });
    expect(deliverBoardNotice(notice, asking.ctx)).toBe("pending");
    expect(asking.shown).toEqual([]);
    const refused = context({ permission: "denied" });
    expect(deliverBoardNotice(notice, refused.ctx)).toBe("discarded");
  });
});
