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
    <div className="flex min-h-svh flex-col bg-background text-foreground md:flex-row">
      <aside className="border-b border-border bg-muted/40 px-6 py-5 md:w-[280px] md:shrink-0 md:border-r md:border-b-0 md:py-8">
        <BrandMascot size={32} className="mb-5 md:mb-8" />
        <div
          role="progressbar"
          aria-label={t`Progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-foreground motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-medium md:hidden">{currentLabel}</p>
        <ol className="mt-8 hidden md:block">
          {steps.map((step, index) => {
            const isDone = done.has(step.id);
            const isCurrent = step.id === current;
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className={`relative flex gap-3 pb-6 ${
                  index < steps.length - 1
                    ? "after:absolute after:top-7 after:bottom-0 after:left-[13px] after:w-px after:bg-border"
                    : ""
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                    isDone
                      ? "border-foreground bg-foreground text-background"
                      : isCurrent
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="size-3.5" aria-hidden /> : index + 1}
                  {isDone ? <span className="sr-only">{t`Completed`}</span> : null}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={`block text-sm ${isCurrent ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {step.label}
                  </span>
                  {step.detail ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {step.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>
      <main className="flex-1 px-6 py-8 md:px-12">
        <div className="mx-auto w-full max-w-2xl">
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
