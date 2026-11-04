import { describe, expect, it, vi } from "vitest";
import {
  compactRosterStatusLabel,
  rosterAttentionLabel,
  rosterHasUndismissedRunError,
  rosterWorkStatusLabel,
  workingMembers,
} from "./roster-status";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw(strings, ...values),
}));

describe("rosterHasUndismissedRunError", () => {
  it("shows a failure only until its run ID is dismissed", () => {
    expect(rosterHasUndismissedRunError("run-failed", new Set())).toBe(true);
    expect(rosterHasUndismissedRunError("run-failed", new Set(["run-failed"]))).toBe(false);
    expect(rosterHasUndismissedRunError(null, new Set())).toBe(false);
  });
});

describe("rosterWorkStatusLabel", () => {
  it("names queued, leased, and running work for the sidebar", () => {
    expect(rosterWorkStatusLabel("queued")).toBe("Waiting in line…");
    expect(rosterWorkStatusLabel("leased")).toBe("Starting…");
    expect(rosterWorkStatusLabel("running")).toBe("Working…");
  });

  it("leaves other statuses to the message preview", () => {
    expect(rosterWorkStatusLabel("idle")).toBeNull();
    expect(rosterWorkStatusLabel("waiting_input")).toBeNull();
    expect(rosterWorkStatusLabel("waiting_takeover")).toBeNull();
    expect(rosterWorkStatusLabel("completed")).toBeNull();
    expect(rosterWorkStatusLabel("failed")).toBeNull();
    expect(rosterWorkStatusLabel("cancelled")).toBeNull();
    expect(rosterWorkStatusLabel("")).toBeNull();
  });
});

describe("compactRosterStatusLabel", () => {
  it("keeps work, human-wait, and error states visible without a preview", () => {
    expect(compactRosterStatusLabel("queued")).toBe("Waiting in line…");
    expect(compactRosterStatusLabel("leased")).toBe("Starting…");
    expect(compactRosterStatusLabel("running")).toBe("Working…");
    expect(compactRosterStatusLabel("waiting_input")).toBe("Needs an answer");
    expect(compactRosterStatusLabel("waiting_takeover")).toBe("Needs you");
    expect(compactRosterStatusLabel("failed")).toBe("Error");
  });

  it("does not add status text to idle rows", () => {
    expect(compactRosterStatusLabel("idle")).toBeNull();
  });
});

describe("rosterAttentionLabel", () => {
  it("names the states where the bot is waiting for the person, or failed", () => {
    expect(rosterAttentionLabel("waiting_input")).toBe("Needs an answer");
    expect(rosterAttentionLabel("waiting_takeover")).toBe("Needs you");
    expect(rosterAttentionLabel("failed")).toBe("Error");
  });

  it("leaves working, finished and quiet states to their own line or the preview", () => {
    for (const status of ["idle", "queued", "leased", "running", "completed", "cancelled", ""]) {
      expect(rosterAttentionLabel(status)).toBeNull();
    }
  });
});

describe("workingMembers", () => {
  const members = [
    { name: "a", status: "running" },
    { name: "b", status: "idle" },
    { name: "c", status: "queued" },
    { name: "d", status: "waiting_input" },
    { name: "e", status: "failed" },
    { name: "f" },
    { name: "g", status: "leased" },
  ];

  it("keeps the members that are queued, starting or running, in channel order", () => {
    expect(workingMembers(members).map((member) => member.name)).toEqual(["a", "c", "g"]);
  });

  it("leaves out a member waiting for the person, a failed one and one with no status", () => {
    expect(workingMembers(members.slice(3, 6))).toEqual([]);
  });
});
