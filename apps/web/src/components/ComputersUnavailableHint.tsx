import { Button, Spinner } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import type { SandboxAvailabilityPhase } from "../lib/computer-sandbox";
import {
  classifySandboxProvider,
  computersAreUnavailable,
  refreshSandboxFromServer,
  sandboxCheckFailureMessage,
  sandboxEnvGuidanceText,
} from "../lib/computer-sandbox";
import { useLocalEdition } from "../lib/local-edition";
import { SuccessPop } from "./ai/primitives";

export { computersAreUnavailable } from "../lib/computer-sandbox";

/** Asks the desktop app to open its "where should bots run" choice. */
export const CHOOSE_COMPUTER_EVENT = "corvo:choose-computer";

type ComputersUnavailableHintProps = {
  className?: string;
  sandboxProvider?: string | null;
  /** When set, shows a control that opens Settings → Computer. */
  onOpenComputerSettings?: () => void;
  /** Called when a check finds computers available again. */
  onRecovered?: (sandboxProvider: string) => void;
  /** Called when the confirmation should leave the screen. */
  onRecoveryDismissed?: () => void;
  /** When false, hides Check again (e.g. inline preview without actions). */
  showRetry?: boolean;
};

export function ComputersUnavailableHint({
  className,
  sandboxProvider: initialProvider,
  onOpenComputerSettings,
  onRecovered,
  onRecoveryDismissed,
  showRetry = true,
}: ComputersUnavailableHintProps) {
  const { t } = useLingui();
  const localEdition = useLocalEdition();
  const [provider, setProvider] = useState(initialProvider);
  const [phase, setPhase] = useState<SandboxAvailabilityPhase>("idle");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;
  const onRecoveryDismissedRef = useRef(onRecoveryDismissed);
  onRecoveryDismissedRef.current = onRecoveryDismissed;

  useEffect(() => {
    setProvider(initialProvider);
  }, [initialProvider]);

  useEffect(() => {
    if (phase !== "recovered") return;
    const timer = window.setTimeout(() => {
      onRecoveryDismissedRef.current?.();
      setPhase("idle");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const unavailable = computersAreUnavailable(provider);
  const kind = classifySandboxProvider(provider);

  async function handleCheckAgain() {
    if (phase === "loading") return;
    setPhase("loading");
    setFailureMessage(null);
    try {
      const me = await refreshSandboxFromServer();
      setProvider(me.sandboxProvider);
      if (computersAreUnavailable(me.sandboxProvider)) {
        setPhase("unavailable");
        return;
      }
      onRecoveredRef.current?.(me.sandboxProvider);
      setPhase("recovered");
    } catch (error) {
      setPhase("failure");
      setFailureMessage(sandboxCheckFailureMessage(error));
      // Do not treat stale cached provider as authoritative after a failed check.
      setProvider(null);
    }
  }

  async function handleCopyGuidance() {
    const text = sandboxEnvGuidanceText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const showUnavailableCopy = phase === "idle" || phase === "unavailable" || phase === "failure";

  return (
    <div
      data-testid="computers-unavailable-hint"
      className={className}
      role={phase === "failure" ? "alert" : undefined}
    >
      {phase === "loading" ? (
        <Spinner className="text-muted-foreground" aria-label={t`Checking computer setup…`} />
      ) : null}

      {phase === "recovered" ? (
        <SuccessPop label={t`Computers are available. Reload or open a bot to continue.`} />
      ) : null}

      {showUnavailableCopy ? (
        <UnavailableCopy kind={kind} failureMessage={failureMessage} local={localEdition} />
      ) : null}

      {showRetry && (unavailable || phase === "failure") ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={phase === "loading"}
            onClick={() => void handleCheckAgain()}
          >
            {phase === "loading" ? <Trans>Checking…</Trans> : <Trans>Check again</Trans>}
          </Button>
          {onOpenComputerSettings ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenComputerSettings}>
              <Trans>Open computer settings</Trans>
            </Button>
          ) : null}
          {localEdition ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new Event(CHOOSE_COMPUTER_EVENT))}
            >
              <Trans>Choose where bots run</Trans>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleCopyGuidance()}
            >
              {copied ? <Trans>Copied</Trans> : <Trans>Copy .env example</Trans>}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UnavailableCopy({
  kind,
  failureMessage,
  local,
}: {
  kind: ReturnType<typeof classifySandboxProvider>;
  failureMessage: string | null;
  local: boolean;
}) {
  if (failureMessage) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        <Trans>
          Could not verify computer setup ({failureMessage}). Fix the connection, then check again.
        </Trans>
      </p>
    );
  }

  // On their own computer nobody edits a .env or a stack: the app asks where bots run instead.
  if (local) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        <Trans>Computers are off.</Trans>
      </p>
    );
  }

  if (kind === "docker") {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        <Trans>
          Docker is configured but computers are not responding. Confirm the sandbox supervisor is
          running, then recreate the stack after changing .env.
        </Trans>
      </p>
    );
  }

  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      <Trans>
        Computers are off. Set SANDBOX_PROVIDER=docker with SANDBOX_SUPERVISOR_TOKEN, or set
        SANDBOX_PROVIDER to e2b, daytona, or boat with its API key. Recreate the stack after
        changing .env.
      </Trans>
    </p>
  );
}
