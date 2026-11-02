import { describe, expect, it } from "vitest";
import { CreateBotInput } from "./domain.js";

describe("CreateBotInput.intro", () => {
  const base = { name: "Bot" };
  it("is optional, so a bot created without it keeps getting its greeting", () => {
    expect(CreateBotInput.parse(base).intro).toBeUndefined();
  });
  it("keeps an explicit false, which skips the greeting run", () => {
    expect(CreateBotInput.parse({ ...base, intro: false }).intro).toBe(false);
  });
});
