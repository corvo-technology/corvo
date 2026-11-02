import { Button, Popover, PopoverContent, PopoverTrigger } from "@corvo/ui-web";
import { useLingui } from "@lingui/react/macro";
import { MoreHorizontal } from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";

export type RailMoreItem = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onSelect: () => void;
};

/** What the rail keeps out of sight: three dots that open the rest of the places, one click away. */
export function RailMore({
  items,
  active,
  className,
  labelClassName,
}: {
  items: RailMoreItem[];
  /** One of the places in the menu is the page the person is on. */
  active: boolean;
  className: string;
  labelClassName: string;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t`More`}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        <MoreHorizontal className="size-5" />
        <span aria-hidden className={labelClassName}>
          {t`More`}
        </span>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-52 gap-0 p-1">
        {items.map(({ key, label, Icon, onSelect }) => (
          <Button
            key={key}
            variant="ghost"
            className="h-9 w-full justify-start gap-2.5 font-normal"
            onClick={() => {
              setOpen(false);
              onSelect();
            }}
          >
            <Icon className="text-muted-foreground" strokeWidth={1.75} />
            {label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
