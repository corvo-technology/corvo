import type { Bot } from "@corvo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

/** One more step for a workflow: which agent continues the work, and what it is asked to do. */
export function AddStepDialog({
  bots,
  saving,
  error,
  onAdd,
  onClose,
}: {
  bots: Bot[];
  saving: boolean;
  error: string | null;
  onAdd: (step: { botId: string; instruction: string }) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [botId, setBotId] = useState(bots[0]?.id ?? "");
  const [instruction, setInstruction] = useState("");
  return (
    <Dialog open onOpenChange={(open) => (!open && !saving ? onClose() : undefined)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            <Trans>Add step</Trans>
          </DialogTitle>
        </DialogHeader>
        <NativeSelect
          aria-label={t`Agent`}
          value={botId}
          onChange={(event) => setBotId(event.target.value)}
        >
          {bots.map((bot) => (
            <NativeSelectOption key={bot.id} value={bot.id}>
              {bot.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Textarea
          aria-label={t`Instructions`}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t`What should the agent do?`}
        />
        {error ? (
          <p role="alert" className="text-[13.5px] text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            disabled={saving || !botId || !instruction.trim()}
            onClick={() => onAdd({ botId, instruction: instruction.trim() })}
          >
            <Trans>Add</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
