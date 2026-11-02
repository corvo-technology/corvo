import { Button } from "@corvo/ui-web";
import { useLingui } from "@lingui/react/macro";
import { Check, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMascot } from "../../components/BrandMascot";
import type { OnboardingStepId } from "../../lib/onboarding-steps";
import { progress } from "../../lib/onboarding-steps";

export type OnboardingSidebarStep = { id: OnboardingStepId; label: string; detail?: string };

export function OnboardingLayout({
  steps,
  current,
  done,
  onBack,
  children,
}: {
  steps: readonly OnboardingSidebarStep[];
  current: OnboardingStepId;
  done: ReadonlySet<OnboardingStepId>;
  onBack?: () => void;
  children: ReactNode;
}) {
  const { t } = useLingui();
  const { percent } = progress(
    steps.map((step) => step.id),
    done,
  );
  const currentLabel = steps.find((step) => step.id === current)?.label;

  return (
    <div
      data-corvo-surface="onboarding"
      className="flex min-h-svh flex-col bg-background text-foreground"
    >
      <header className="mx-auto w-full max-w-xl px-6 pt-8">
        <BrandMascot size={36} className="mb-6" />
        <div
          role="progressbar"
          aria-label={t`Progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="flex gap-1.5"
        >
          {steps.map((step) => (
            <span
              key={step.id}
              aria-hidden
              className={`h-1 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-300 ${
                done.has(step.id) || step.id === current ? "bg-foreground" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm font-medium sm:hidden">{currentLabel}</p>
        <ol className="mt-3 hidden gap-1.5 sm:flex">
          {steps.map((step) => {
            const isDone = done.has(step.id);
            const isCurrent = step.id === current;
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs ${
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                {isDone ? <span className="sr-only">{t`Completed`}</span> : null}
                <span className="truncate">{step.label}</span>
                {step.detail && isDone ? (
                  <span className="truncate text-muted-foreground">· {step.detail}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </header>
      <main className="flex flex-1 items-center px-6 py-10">
        <div className="mx-auto w-full max-w-md">
          {onBack ? (
            <Button variant="ghost" size="sm" className="-ml-2 mb-6" onClick={onBack}>
              <ChevronLeft aria-hidden />
              {t`Back`}
            </Button>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
