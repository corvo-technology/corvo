import type { MessageBlock } from "@corvo/contracts";
import { Card, CardContent } from "@corvo/ui-web/components/ui/card";
import { useLingui } from "@lingui/react/macro";
import { Check, Circle, LoaderCircle, X } from "lucide-react";

type Plan = Extract<MessageBlock, { kind: "plan" }>;

/** A bot's plan for a request with several stages, kept current as they start and finish. */
export function PlanCard({ block }: { block: Plan }) {
  const { t } = useLingui();
  const label = {
    pending: t`Waiting`,
    running: t`In progress`,
    done: t`Done`,
    failed: t`Failed`,
  };
  return (
    <Card size="sm" className="w-full max-w-xl" data-testid="plan-card">
      <CardContent className="flex flex-col gap-3">
        <span className="font-medium" dir="auto">
          {block.title}
        </span>
        <ol className="flex flex-col gap-2.5">
          {block.steps.map((step) => (
            <li
              key={step.id}
              className="flex items-start gap-2.5"
              data-status={step.status}
              data-testid="plan-step"
            >
              <span
                role="img"
                aria-label={label[step.status]}
                title={label[step.status]}
                className={`mt-0.5 shrink-0 ${
                  step.status === "failed"
                    ? "text-destructive"
                    : step.status === "done"
                      ? "text-success"
                      : "text-muted-foreground"
                }`}
              >
                {step.status === "done" ? (
                  <Check className="size-4" />
                ) : step.status === "failed" ? (
                  <X className="size-4" />
                ) : step.status === "running" ? (
                  <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Circle className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[14px] leading-snug ${step.status === "done" ? "text-muted-foreground" : "text-foreground"}`}
                  dir="auto"
                >
                  {step.label}
                </span>
                {step.owner ? (
                  <span className="block text-[12.5px] text-muted-foreground" dir="auto">
                    {step.owner}
                  </span>
                ) : null}
                {step.note ? (
                  <span className="block text-[12.5px] text-muted-foreground" dir="auto">
                    {step.note}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
