import { describe, expect, it } from "vitest";
import { flipDeltas } from "./flip";

describe("flipDeltas", () => {
  it("gives how far each row that moved has to travel back to where it was", () => {
    const before = new Map([
      ["a", 0],
      ["b", 60],
      ["c", 120],
    ]);
    const after = new Map([
      ["a", 60],
      ["b", 0],
      ["c", 120],
    ]);
    expect(flipDeltas(before, after)).toEqual(
      new Map([
        ["a", -60],
        ["b", 60],
      ]),
    );
  });

  it("ignores rows that are new or gone, and rows that did not move", () => {
    const before = new Map([
      ["a", 0],
      ["gone", 60],
    ]);
    const after = new Map([
      ["a", 0],
      ["new", 60],
    ]);
    expect(flipDeltas(before, after).size).toBe(0);
  });
});
