import { describe, expect, it } from "vitest";
import { selectBuiltinToolsForRun } from "./run-tool-selection.js";

const base = {
  graphicalToolsAllowed: false,
  groupId: null,
  semanticMemoryEnabled: false,
  messagingChannelRun: false,
};

describe("the Store skill tools", () => {
  it("are offered with the other skill tools in a chat", () => {
    const names = selectBuiltinToolsForRun({ ...base, trigger: "user" }).map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["store_skills", "skill_install", "skill_read"]));
  });

  it("can be turned off for a bot", () => {
    const names = selectBuiltinToolsForRun({
      ...base,
      trigger: "user",
      disabledBuiltinTools: ["skill_install"],
    }).map((tool) => tool.name);
    expect(names).toContain("store_skills");
    expect(names).not.toContain("skill_install");
  });
});
