import { describe, expect, it } from "vitest";
import type { ModelCatalogEntry } from "./domain.js";
import { modelSupportsRole } from "./model-roles.js";

const chat = { provider: "openai", id: "chat" } as ModelCatalogEntry;
const decision = { provider: "openrouter", id: "jev", protocol: "decisions" } as ModelCatalogEntry;

describe("modelSupportsRole", () => {
  it("keeps decision models out of the main role and chat-only models out of routing", () => {
    expect(modelSupportsRole(chat, "main")).toBe(true);
    expect(modelSupportsRole(decision, "main")).toBe(false);
    expect(modelSupportsRole(decision, "routing")).toBe(true);
    expect(modelSupportsRole(chat, "routing")).toBe(false);
  });

  it("lets the fast role use chat models only, since it writes text", () => {
    expect(modelSupportsRole(chat, "fast")).toBe(true);
    expect(modelSupportsRole(decision, "fast")).toBe(false);
  });

  it("lets approval use either kind", () => {
    expect(modelSupportsRole(chat, "approval")).toBe(true);
    expect(modelSupportsRole(decision, "approval")).toBe(true);
  });
});
