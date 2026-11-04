import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({ useLingui: () => ({ t: String.raw }) }));

import { resolveStatusLabels } from "./ticket-status";

const builtin = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  blocked: "Blocked",
  done: "Done",
  closed: "Won't do",
};

describe("resolveStatusLabels", () => {
  it("keeps the built-in name where the board has no override", () => {
    expect(resolveStatusLabels(builtin, undefined)).toEqual(builtin);
    expect(resolveStatusLabels(builtin, { doing: "In contact" })).toEqual({
      ...builtin,
      doing: "In contact",
    });
  });

  it("ignores a blank override so a column never loses its name", () => {
    expect(resolveStatusLabels(builtin, { doing: "  " }).doing).toBe("In progress");
  });
});
