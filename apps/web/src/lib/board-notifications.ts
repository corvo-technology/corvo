import type { BoardEvent, TicketStatus } from "@corvo/contracts";

/** What to tell the person: an agent finished a card and put it where it needs a look. */
export type BoardMoveNotice = {
  name: string;
  ref: string;
  /** The board's name for the column the card is in now. */
  status: string;
  body: string;
  /** One notice per card and column, so a repeated signal replaces the earlier one. */
  tag: string;
};

/** Only an agent's move to review or done speaks; a person's own move and every other column stay quiet. */
export function boardMoveNotice(
  event: BoardEvent,
  builtin: Record<TicketStatus, string>,
): BoardMoveNotice | null {
  const moved = event.moved;
  if (!moved || moved.byBotId === null) return null;
  if (moved.status !== "review" && moved.status !== "done") return null;
  return {
    name: moved.byName ?? "",
    ref: moved.ref,
    status: moved.statusLabel ?? builtin[moved.status],
    body: moved.title,
    tag: `${event.ticketId ?? moved.ref}:${moved.status}`,
  };
}

/**
 * Show the notice unless the person is already looking at the app, where the board and the Team
 * screen update on their own. "pending" means permission has not been asked yet.
 */
export function deliverBoardNotice(
  notice: BoardMoveNotice,
  context: {
    pageVisible: boolean;
    windowFocused: boolean;
    permission: "default" | "denied" | "granted";
    seen: Set<string>;
    /** Identifies this signal, so a replay of it is not shown twice. */
    key: string;
    show: (notice: BoardMoveNotice) => void;
  },
): "delivered" | "pending" | "discarded" {
  const id = `${notice.tag}@${context.key}`;
  if (
    (context.pageVisible && context.windowFocused) ||
    context.permission === "denied" ||
    context.seen.has(id)
  ) {
    return "discarded";
  }
  if (context.permission === "default") return "pending";
  try {
    context.show(notice);
    context.seen.add(id);
    return "delivered";
  } catch {
    return "pending";
  }
}
