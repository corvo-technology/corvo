import type { StoreCategory } from "@corvo/contracts";
import { Button } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";

/** The names of the Store's categories in the app's language. */
export function useStoreCategoryLabels(): Record<StoreCategory, string> {
  const { t } = useLingui();
  return {
    finance: t`Finance`,
    marketing: t`Marketing`,
    design: t`Design`,
    sales: t`Sales`,
    support: t`Support`,
    operations: t`Operations`,
    people: t`People`,
    development: t`Development`,
    knowledge: t`Research and writing`,
  };
}

/**
 * Filter chips for a Store section: All, then the categories that have something in them. A
 * category with nothing to show is left out rather than offered as a dead end.
 */
export function StoreCategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: readonly StoreCategory[];
  value: StoreCategory | null;
  onChange: (category: StoreCategory | null) => void;
}) {
  const labels = useStoreCategoryLabels();
  return (
    <div className="mb-4 flex flex-wrap gap-1.5" data-testid="store-categories">
      <Button
        type="button"
        size="sm"
        variant={value === null ? "secondary" : "ghost"}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        <Trans>All</Trans>
      </Button>
      {categories.map((category) => (
        <Button
          key={category}
          type="button"
          size="sm"
          variant={value === category ? "secondary" : "ghost"}
          aria-pressed={value === category}
          onClick={() => onChange(category)}
        >
          {labels[category]}
        </Button>
      ))}
    </div>
  );
}
