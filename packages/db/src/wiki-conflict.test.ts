import { expect, it, vi } from "vitest";
import { WikiConflictError, writeWikiPage } from "./wiki.js";

it("answers a write that keeps conflicting with a conflict the person can act on, not a failure", async () => {
  const conflict = Object.assign(new Error("TransactionWriteConflict"), {
    name: "DriverAdapterError",
    cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
  });
  const transaction = vi.fn().mockRejectedValue(conflict);
  const db = { $transaction: transaction } as never;

  await expect(
    writeWikiPage(db, { spaceId: "s", userId: "u" }, { title: "Plan", body: "text" }),
  ).rejects.toBeInstanceOf(WikiConflictError);
  // It was tried again before giving up.
  expect(transaction.mock.calls.length).toBeGreaterThan(1);
});

it("lets any other failure through as it is", async () => {
  const broken = new Error("connection lost");
  const db = { $transaction: vi.fn().mockRejectedValue(broken) } as never;
  await expect(
    writeWikiPage(db, { spaceId: "s", userId: "u" }, { title: "Plan", body: "text" }),
  ).rejects.toBe(broken);
});
