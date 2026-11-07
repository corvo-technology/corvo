import { Button } from "@corvo/ui-web";
import { useLingui } from "@lingui/react/macro";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** The first letter of an app in a rounded tile, the mark chat apps carry in the Store. */
export function AppLetter({ name }: { name: string }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-foreground">
      {name[0]}
    </div>
  );
}

/** The top of an app's own screen in the Store: back, who it is, and its one main action. */
export function StoreAppHeader({
  name,
  onBack,
  action,
}: {
  name: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  const { t } = useLingui();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t`Back`}
          onClick={onBack}
        >
          <ChevronLeft />
        </Button>
        <AppLetter name={name} />
        <div className="truncate text-[17px] font-medium text-foreground">{name}</div>
      </div>
      {action}
    </div>
  );
}
