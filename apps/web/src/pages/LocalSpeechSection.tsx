import type { LocalSpeechModel, SettingsScope, VoiceCredential } from "@corvo/contracts";
import { LOCAL_VOICE_PROVIDER_ID } from "@corvo/contracts";
import {
  Button,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
  Spinner,
} from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSpaceRpc } from "../lib/space-rpc";
import { errorText } from "../lib/user-error";

type Language = "auto" | "en" | "pt";
const POLL_MS = 1000;

function toLanguage(value: string | undefined): Language {
  return value === "en" || value === "pt" ? value : "auto";
}

/**
 * "This computer": speech models the owner downloads to this machine. A model is chosen with Use,
 * and then transcribes audio sent to the agents. Nothing here asks for a key.
 */
export function LocalSpeechSection({
  scope,
  credential,
  disabled,
  onChanged,
}: {
  scope: SettingsScope;
  credential: VoiceCredential | undefined;
  disabled: boolean;
  /** Called after a change the rest of the screen should show, such as the choice being cleared. */
  onChanged: () => Promise<void>;
}) {
  const { t } = useLingui();
  const rpc = useSpaceRpc();
  const rpcRef = useRef(rpc);
  rpcRef.current = rpc;
  const languageId = useId();
  const [models, setModels] = useState<LocalSpeechModel[] | null>(null);
  const [language, setLanguage] = useState<Language>(toLanguage(credential?.language));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await rpcRef.current.voice.localModels();
      if (alive.current) setModels(next);
    } catch (err) {
      if (alive.current) setError(errorText(err, t`Could not update the speech model`));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // A download runs in the background; keep looking until nothing is still downloading.
  useEffect(() => {
    if (!models?.some((model) => model.state === "downloading")) return;
    const timer = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(timer);
  }, [models, load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, t`Could not update the speech model`));
    } finally {
      if (alive.current) setBusy(false);
    }
    await load();
  }

  const connect = (model: string, chosen: Language) =>
    rpcRef.current.voice
      .connect({ scope, provider: LOCAL_VOICE_PROVIDER_ID, sttModel: model, language: chosen })
      .then(onChanged);

  const locked = disabled || busy;

  return (
    <div data-testid="local-speech">
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <Field>
        <FieldLabel htmlFor={languageId}>
          <Trans>Language</Trans>
        </FieldLabel>
        <NativeSelect
          id={languageId}
          className="w-full"
          value={language}
          disabled={locked}
          onChange={(event) => {
            const next = toLanguage(event.target.value);
            setLanguage(next);
            if (credential?.sttModel) void run(() => connect(credential.sttModel, next));
          }}
        >
          <NativeSelectOption value="auto">{t`Automatic`}</NativeSelectOption>
          <NativeSelectOption value="en">English</NativeSelectOption>
          <NativeSelectOption value="pt">Português</NativeSelectOption>
        </NativeSelect>
      </Field>
      {models === null ? (
        <Spinner className="mt-6" />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {models.map((model) => {
            const inUse = credential?.sttModel === model.id && model.state === "ready";
            return (
              <li
                key={model.id}
                data-testid={`local-model-${model.id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{model.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round(model.sizeBytes / 1_000_000)} MB
                  </div>
                  {model.state === "downloading" ? (
                    <progress
                      className="mt-2 h-1.5 w-full"
                      value={model.bytesDone}
                      max={model.sizeBytes}
                      aria-label={t`Download progress`}
                    />
                  ) : null}
                  {model.state === "failed" && model.error ? (
                    <div className="text-sm text-destructive">{model.error}</div>
                  ) : null}
                </div>
                {model.state === "downloading" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      void run(() =>
                        rpcRef.current.voice.cancelLocalModelDownload({ id: model.id }),
                      )
                    }
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                ) : null}
                {model.state === "absent" || model.state === "failed" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={locked}
                    onClick={() =>
                      void run(() => rpcRef.current.voice.downloadLocalModel({ id: model.id }))
                    }
                  >
                    <Trans>Download</Trans>
                  </Button>
                ) : null}
                {model.state === "ready" ? (
                  <>
                    {inUse ? (
                      <span className="text-sm text-muted-foreground">
                        <Trans>In use</Trans>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={locked}
                        onClick={() => void run(() => connect(model.id, language))}
                      >
                        <Trans>Use</Trans>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={locked}
                      onClick={() =>
                        void run(async () => {
                          await rpcRef.current.voice.removeLocalModel({ id: model.id });
                          await onChanged();
                        })
                      }
                    >
                      <Trans>Remove</Trans>
                    </Button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
