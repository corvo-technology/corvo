import { describe, expect, it } from "vitest";
import { selectBuiltinToolsForRun } from "./run-tool-selection.js";

const base = {
  graphicalToolsAllowed: false,
  groupId: null,
  semanticMemoryEnabled: false,
  messagingChannelRun: false,
};
const names = (options: Partial<Parameters<typeof selectBuiltinToolsForRun>[0]>) =>
  selectBuiltinToolsForRun({ ...base, trigger: "routine", ...options }).map((tool) => tool.name);

describe("workflow_stop", () => {
  it("is offered only to a routine run that has steps after it", () => {
    expect(names({ workflowContinues: true })).toContain("workflow_stop");
    expect(names({ workflowContinues: false })).not.toContain("workflow_stop");
    expect(names({})).not.toContain("workflow_stop");
  });

  it("is not offered in a chat", () => {
    expect(names({ trigger: "user" })).not.toContain("workflow_stop");
  });
});
