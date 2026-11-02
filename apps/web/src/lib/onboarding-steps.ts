/** `survey` is the "use" step and keeps its URL from the earlier onboarding. */
export type OnboardingStepId = "workspace" | "survey" | "model" | "bot" | "computer";

export type OnboardingContext = {
  canRenameSpace: boolean;
  spaceName: string;
  needsModel: boolean;
  canChooseHostComputer: boolean;
  computerHost: "docker" | "this-mac" | null;
  hasDesktopHostChoice: boolean;
  /** The account already has content in another space, so the questions about it are done. */
  returning: boolean;
};

const STEP_ORDER: readonly OnboardingStepId[] = ["workspace", "survey", "model", "bot", "computer"];

function isVisible(ctx: OnboardingContext, step: OnboardingStepId): boolean {
  switch (step) {
    case "workspace":
      return ctx.canRenameSpace && !ctx.returning;
    case "survey":
      return !ctx.returning;
    case "model":
      return ctx.needsModel;
    case "computer":
      return ctx.canChooseHostComputer && ctx.computerHost === null && ctx.hasDesktopHostChoice;
    default:
      return true;
  }
}

export function visibleSteps(ctx: OnboardingContext): OnboardingStepId[] {
  return STEP_ORDER.filter((step) => isVisible(ctx, step));
}

/** The step after `current`, or null once the flow is finished. */
export function nextStep(
  ctx: OnboardingContext,
  current: OnboardingStepId,
): OnboardingStepId | null {
  const steps = visibleSteps(ctx);
  const index = steps.indexOf(current);
  return steps[index + 1] ?? null;
}

/**
 * A visible requested step; with none requested, the first visible step not done yet, or the
 * last one when everything is done.
 */
export function resolveStep(
  ctx: OnboardingContext,
  requested: string | undefined,
  done: ReadonlySet<OnboardingStepId> = new Set(),
): OnboardingStepId {
  const steps = visibleSteps(ctx);
  const asked = steps.find((step) => step === requested);
  if (asked) return asked;
  return steps.find((step) => !done.has(step)) ?? steps.at(-1) ?? "bot";
}

export function progress(
  visible: readonly OnboardingStepId[],
  done: ReadonlySet<OnboardingStepId>,
): { done: number; total: number; percent: number } {
  const total = visible.length;
  const completed = visible.filter((step) => done.has(step)).length;
  return {
    done: completed,
    total,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
  };
}
