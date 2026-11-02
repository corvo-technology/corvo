import type { OnboardingStepId } from "./onboarding-steps";

const KEY = "corvo:onboarding-progress";
const STEPS: readonly string[] = ["workspace", "survey", "model", "bot", "computer"];

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The steps this account finished in this tab, so a reload or a billing return resumes after them. */
export function loadDoneSteps(
  userId: string,
  storage: Storage | null = sessionStorageOrNull(),
): Set<OnboardingStepId> {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? "null") as {
      userId?: unknown;
      done?: unknown;
    } | null;
    if (saved?.userId !== userId || !Array.isArray(saved.done)) return new Set();
    return new Set(
      saved.done.filter((step): step is OnboardingStepId => STEPS.includes(step as string)),
    );
  } catch {
    return new Set();
  }
}

export function saveDoneSteps(
  userId: string,
  done: ReadonlySet<OnboardingStepId>,
  storage: Storage | null = sessionStorageOrNull(),
): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ userId, done: [...done] }));
  } catch {
    // Progress is a convenience; without storage the flow just starts from the top.
  }
}
