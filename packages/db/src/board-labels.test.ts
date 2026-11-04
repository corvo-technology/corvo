import { describe, expect, it } from "vitest";
import { mergeStatusLabels, toBoardDto } from "./board.js";

describe("board column labels", () => {
  it("sets a label, replaces one and keeps the others", () => {
    expect(
      mergeStatusLabels({ doing: "Working" }, { doing: "In contact", review: "Check" }),
    ).toEqual({
      doing: "In contact",
      review: "Check",
    });
  });

  it("removes a label with null, and stores nothing when none is left", () => {
    expect(mergeStatusLabels({ doing: "In contact", done: "Won" }, { doing: null })).toEqual({
      done: "Won",
    });
    expect(mergeStatusLabels({ doing: "In contact" }, { doing: null })).toBeNull();
  });

  it("reads a stored column defensively when rendering a board", () => {
    const now = new Date();
    const row = {
      id: "b",
      spaceId: "s",
      name: "Leads",
      ticketPrefix: "LEAD",
      nextNumber: 1,
      createdAt: now,
      updatedAt: now,
    };
    expect(toBoardDto({ ...row, statusLabels: { doing: "In contact" } }).statusLabels).toEqual({
      doing: "In contact",
    });
    expect(toBoardDto({ ...row, statusLabels: null }).statusLabels).toEqual({});
    expect(toBoardDto({ ...row, statusLabels: { doing: 4, bogus: "x" } }).statusLabels).toEqual({});
  });
});
