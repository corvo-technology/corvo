import type { WikiChangeRecord } from "@corvo/db";
import { describe, expect, it } from "vitest";
import { wikiChangeView } from "./routes/wiki.js";

const record: WikiChangeRecord = {
  id: "chg1",
  state: "pending",
  reason: "A contractor was chosen",
  pages: [{ title: "Alpha Builders", op: "create" }],
  createdAt: new Date("2026-11-04T10:00:00.000Z"),
  anchorThreadId: "thread-1",
  anchorMessageId: null,
  sourceTitle: "Lobby renovation",
  sourceText: "Ana: we are going with Alpha Builders. Her number is private.",
  sourceUserId: "owner",
};

describe("what a reader is shown of a change's source", () => {
  it("quotes the conversation, as it was said, to the person whose conversation it was", () => {
    expect(wikiChangeView(record, "owner")).toEqual({
      id: "chg1",
      state: "pending",
      reason: "A contractor was chosen",
      sourceTitle: "Lobby renovation",
      pages: [{ title: "Alpha Builders", op: "create" }],
      createdAt: "2026-11-04T10:00:00.000Z",
      canSeeSource: true,
      sourceText: "Ana: we are going with Alpha Builders. Her number is private.",
    });
  });

  it("shows anyone else the change and its pages, and none of the words quoted", () => {
    const view = wikiChangeView(record, "colleague");
    expect(view.canSeeSource).toBe(false);
    expect(view).not.toHaveProperty("sourceText");
    expect(JSON.stringify(view)).not.toContain("number is private");
    expect(view.pages).toEqual([{ title: "Alpha Builders", op: "create" }]);
  });
});
