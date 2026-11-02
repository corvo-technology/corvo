import { describe, expect, it } from "vitest";
import { formatWhen, insertStep, moveStep } from "./workflow-flow";

const step = (name: string) => ({ botId: name, instruction: name });

describe("formatWhen", () => {
  const now = new Date(2026, 9, 31, 12, 0);
  it("says just the time for something today", () => {
    expect(formatWhen(new Date(2026, 9, 31, 9, 0).toISOString(), now, "en")).toBe("9:00 AM");
  });

  it("adds the weekday for another day", () => {
    expect(formatWhen(new Date(2026, 10, 1, 9, 0).toISOString(), now, "en")).toBe("Sun 9:00 AM");
    expect(formatWhen(new Date(2026, 9, 30, 18, 30).toISOString(), now, "en")).toBe("Fri 6:30 PM");
  });

  it("follows the viewer's language", () => {
    expect(formatWhen(new Date(2026, 10, 1, 9, 0).toISOString(), now, "pt-BR")).not.toBe(
      formatWhen(new Date(2026, 10, 1, 9, 0).toISOString(), now, "en"),
    );
  });
});

describe("moveStep", () => {
  const steps = [step("a"), step("b"), step("c")];
  it("swaps a step with its neighbour", () => {
    expect(moveStep(steps, 1, -1).map((s) => s.botId)).toEqual(["b", "a", "c"]);
    expect(moveStep(steps, 1, 1).map((s) => s.botId)).toEqual(["a", "c", "b"]);
  });

  it("leaves the order alone at either end", () => {
    expect(moveStep(steps, 0, -1)).toEqual(steps);
    expect(moveStep(steps, 2, 1)).toEqual(steps);
  });

  it("does not change the list it was given", () => {
    moveStep(steps, 0, 1);
    expect(steps.map((s) => s.botId)).toEqual(["a", "b", "c"]);
  });
});

describe("insertStep", () => {
  it("puts a step at the chosen place and keeps the rest in order", () => {
    const steps = [step("a"), step("b")];
    expect(insertStep(steps, 1, step("x")).map((s) => s.botId)).toEqual(["a", "x", "b"]);
    expect(insertStep(steps, 0, step("x")).map((s) => s.botId)).toEqual(["x", "a", "b"]);
    expect(insertStep(steps, 2, step("x")).map((s) => s.botId)).toEqual(["a", "b", "x"]);
  });

  it("puts a step past the end at the end", () => {
    expect(insertStep([step("a")], 9, step("x")).map((s) => s.botId)).toEqual(["a", "x"]);
  });
});
