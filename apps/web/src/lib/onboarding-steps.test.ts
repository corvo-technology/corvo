import { describe, expect, it } from "vitest";
import type { OnboardingContext } from "./onboarding-steps";
import { nextStep, progress, resolveStep, visibleSteps } from "./onboarding-steps";

const all: OnboardingContext = {
  canRenameSpace: true,
  spaceName: "Personal",
  needsModel: true,
  canChooseHostComputer: true,
  computerHost: null,
  hasDesktopHostChoice: true,
  returning: false,
};

describe("visibleSteps", () => {
  it("lists every step in order when none is omitted", () => {
    expect(visibleSteps(all)).toEqual(["workspace", "survey", "model", "bot", "computer"]);
  });

  it("omits the workspace step when the space cannot be renamed", () => {
    expect(visibleSteps({ ...all, canRenameSpace: false })).not.toContain("workspace");
  });

  it("omits the model step when no model is needed", () => {
    expect(visibleSteps({ ...all, needsModel: false })).not.toContain("model");
  });

  it("omits the computer step unless the host can be chosen and has not been", () => {
    expect(visibleSteps({ ...all, canChooseHostComputer: false })).not.toContain("computer");
    expect(visibleSteps({ ...all, computerHost: "docker" })).not.toContain("computer");
    expect(visibleSteps({ ...all, hasDesktopHostChoice: false })).not.toContain("computer");
  });
});

describe("a returning account", () => {
  it("skips the workspace and use steps when it already has content elsewhere", () => {
    expect(visibleSteps({ ...all, returning: true })).toEqual(["model", "bot", "computer"]);
  });
});

describe("nextStep", () => {
  it("skips omitted steps and ends with null", () => {
    const ctx = { ...all, needsModel: false, canChooseHostComputer: false };
    expect(nextStep(ctx, "survey")).toBe("bot");
    expect(nextStep(ctx, "bot")).toBeNull();
  });
});

describe("resolveStep", () => {
  it("opens the first visible step when the requested one is hidden or missing", () => {
    const ctx = { ...all, canRenameSpace: false, canChooseHostComputer: false };
    expect(resolveStep(ctx, "computer")).toBe("survey");
    expect(resolveStep(ctx, undefined)).toBe("survey");
    expect(resolveStep(ctx, "nonsense")).toBe("survey");
  });

  it("opens a visible requested step", () => {
    expect(resolveStep(all, "model")).toBe("model");
  });

  it("does not open a hidden step from its URL", () => {
    expect(resolveStep({ ...all, canRenameSpace: false }, "workspace")).toBe("survey");
  });
});

describe("resolveStep with progress", () => {
  it("opens the first step that is not done yet", () => {
    expect(resolveStep(all, undefined, new Set(["workspace", "survey"]))).toBe("model");
  });

  it("opens the last step when everything is done", () => {
    const done = new Set(visibleSteps(all));
    expect(resolveStep(all, undefined, done)).toBe("computer");
  });

  it("still opens a requested visible step that is done", () => {
    expect(resolveStep(all, "survey", new Set(["survey"]))).toBe("survey");
  });
});

describe("progress", () => {
  it("counts only completed visible steps", () => {
    const visible = visibleSteps(all);
    expect(progress(visible, new Set(["workspace", "survey"]))).toEqual({
      done: 2,
      total: 5,
      percent: 40,
    });
  });

  it("is complete when there is nothing to do", () => {
    expect(progress([], new Set())).toEqual({ done: 0, total: 0, percent: 100 });
  });
});
