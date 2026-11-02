import type { ToolChoiceCase } from "./tool-choice.js";
import { toolChoiceEvalCase } from "./tool-choice.js";

/** Synthetic prompts only. Production-derived cases belong in a local --cases-file. */
const NO_SCREEN = ["computer_observe", "computer_act", "browser_navigate", "browser_act"];

export const TOOL_CHOICE_DEFINITIONS: ToolChoiceCase[] = [
  // Everyday work, with the tools a run always lists.
  {
    id: "remember-fact",
    area: "everyday",
    kind: "guard",
    purpose: "Save a durable fact when asked to remember it.",
    prompt: "Remember that my favorite color is green.",
    expect: { anyOf: [{ tool: "remember" }, { tool: "save_memory" }] },
  },
  {
    id: "remember-control",
    area: "everyday",
    kind: "control",
    purpose: "Answer a plain question without any tool.",
    prompt: "What is 12 times 12?",
    expect: { notCalls: ["*"] },
  },
  {
    id: "lookup-without-screen",
    area: "everyday",
    kind: "guard",
    purpose: "Look something up with search or fetch, not by driving a browser.",
    prompt: "Look up what the latest stable version of Node.js is.",
    expect: {
      anyOf: [{ tool: "web_search" }, { tool: "web_fetch" }],
      notCalls: NO_SCREEN,
    },
  },
  {
    id: "lookup-control",
    area: "everyday",
    kind: "control",
    purpose: "Answer a greeting without a screen or a search.",
    prompt: "Hi! How are you today?",
    expect: { notCalls: ["*"] },
  },
  // Built-ins the run does not list, reached through find_tool and use_tool.
  {
    id: "deferred-scratchpad",
    area: "deferred-tools",
    kind: "guard",
    purpose: "Reach a deferred tool through the bridge and run it.",
    prompt: "Add 'buy milk' to your scratchpad so you remember to finish it.",
    expect: { calls: [{ tool: "scratchpad_add" }] },
  },
  {
    id: "deferred-secret",
    area: "deferred-tools",
    kind: "guard",
    purpose: "Generate a password with the deferred tool instead of inventing one.",
    prompt: "I'm signing up for a service. Generate a strong password for it and keep it safe.",
    expect: { anyOf: [{ tool: "generate_secret" }] },
  },
  {
    id: "deferred-control",
    area: "deferred-tools",
    kind: "control",
    purpose: "Do ordinary work without searching for tools.",
    prompt: "In one sentence, what is a REST API?",
    expect: { notCalls: ["*"] },
  },
];

export const TOOL_CHOICE_CASES = TOOL_CHOICE_DEFINITIONS.map(toolChoiceEvalCase);
