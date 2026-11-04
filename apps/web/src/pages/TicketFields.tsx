import type { TicketField } from "@corvo/contracts";
import {
  TICKET_FIELD_NAME_MAX_LENGTH,
  TICKET_FIELD_VALUE_MAX_LENGTH,
  TICKET_FIELDS_MAX,
} from "@corvo/contracts";
import { Button, Input } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { X } from "lucide-react";

/** The named data kept on a ticket, one row per field. */
export function TicketFields({
  rows,
  onChange,
}: {
  rows: TicketField[];
  onChange: (rows: TicketField[]) => void;
}) {
  const { t } = useLingui();
  const edit = (index: number, patch: Partial<TicketField>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        // The rows have no identity beyond their place, and a removed row shifts the rest.
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={t`Field name`}
            value={row.name}
            maxLength={TICKET_FIELD_NAME_MAX_LENGTH}
            onChange={(event) => edit(index, { name: event.target.value })}
          />
          <Input
            aria-label={t`Field value`}
            value={row.value}
            maxLength={TICKET_FIELD_VALUE_MAX_LENGTH}
            onChange={(event) => edit(index, { value: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t`Remove field`}
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      {rows.length < TICKET_FIELDS_MAX ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...rows, { name: "", value: "" }])}
        >
          <Trans>Add field</Trans>
        </Button>
      ) : null}
    </div>
  );
}
