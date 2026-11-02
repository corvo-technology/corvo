import { Button } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { desktopBridge } from "../../lib/desktop";
import { chooseHostComputer, declineHostComputer } from "../../lib/host-computer";
import { errorText } from "../../lib/user-error";

type Choice = "docker" | "this-mac";

/** The question the desktop app otherwise asks in a required dialog, asked once and earlier. */
export function ComputerStep({
  hostLabel,
  dockerOffered = true,
  onDone,
}: {
  hostLabel: string;
  /** False in the desktop app's own engine, which has no Docker: this computer or nothing. */
  dockerOffered?: boolean;
  onDone: () => void;
}) {
  const { t } = useLingui();
  const [choice, setChoice] = useState<Choice>(dockerOffered ? "docker" : "this-mac");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function save(selected: Choice = choice) {
    if (started.current) return;
    started.current = true;
    setPending(true);
    setError(null);
    try {
      if (await chooseHostComputer(desktopBridge(), selected)) {
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
        {dockerOffered ? (
          <Trans>
            Docker limits access to your computer for added security. Using {hostLabel} lets bots
            work with your local files and tools.
          </Trans>
        ) : (
          <Trans>Bots can work on {hostLabel} with your local files and tools.</Trans>
        )}
      </p>
      {dockerOffered ? (
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
      ) : null}
      {choice === "this-mac" || !dockerOffered ? (
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
      {dockerOffered ? (
        <Button className="mt-8 w-full" disabled={pending} onClick={() => void save()}>
          <Trans>Continue</Trans>
        </Button>
      ) : (
        <div className="mt-8 flex flex-col gap-2">
          <Button disabled={pending} onClick={() => void save("this-mac")}>
            <Trans>Use {hostLabel}</Trans>
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              declineHostComputer();
              onDone();
            }}
          >
            <Trans>Not now</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
