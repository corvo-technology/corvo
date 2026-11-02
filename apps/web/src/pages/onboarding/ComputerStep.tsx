import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@corvo/ui-web";
import { useRef, useState } from "react";
import { desktopBridge } from "../../lib/desktop";
import { chooseHostComputer } from "../../lib/host-computer";
import { errorText } from "../../lib/user-error";

type Choice = "docker" | "this-mac";

/** The question the desktop app otherwise asks in a required dialog, asked once and earlier. */
export function ComputerStep({ hostLabel, onDone }: { hostLabel: string; onDone: () => void }) {
  const { t } = useLingui();
  const [choice, setChoice] = useState<Choice>("docker");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function save() {
    if (started.current) return;
    started.current = true;
    setPending(true);
    setError(null);
    try {
      if (await chooseHostComputer(desktopBridge(), choice)) {
        onDone();
        return;
      }
    } catch (err) {
      setError(errorText(err, t`Could not save that choice`));
    }
    started.current = false;
    setPending(false);
  }

  return (
    <div>
      <h1 className="text-[32px] font-medium text-foreground">
        <Trans>Where should bots run?</Trans>
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        <Trans>
          Docker limits access to your computer for added security. Using {hostLabel} lets bots work
          with your local files and tools.
        </Trans>
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          variant="outline"
          size="lg"
          aria-pressed={choice === "docker"}
          disabled={pending}
          className="aria-pressed:border-foreground"
          onClick={() => setChoice("docker")}
        >
          <Trans>Docker</Trans>
        </Button>
        <Button
          variant="outline"
          size="lg"
          aria-pressed={choice === "this-mac"}
          disabled={pending}
          className="aria-pressed:border-foreground"
          onClick={() => setChoice("this-mac")}
        >
          <Trans>Use {hostLabel}</Trans>
        </Button>
      </div>
      {choice === "this-mac" ? (
        <p className="mt-3 text-xs text-muted-foreground/80">
          <Trans>
            Local access lets bots run commands without asking. Avoid it on shared or public
            servers.
          </Trans>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button className="mt-8 w-full" disabled={pending} onClick={() => void save()}>
        <Trans>Continue</Trans>
      </Button>
    </div>
  );
}
