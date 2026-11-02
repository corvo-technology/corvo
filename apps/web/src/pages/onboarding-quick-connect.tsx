import type { ModelCatalogEntry } from "@corvo/contracts";
import { detectProviderFromKey, pickCatalogModelId } from "@corvo/core";
import { Button, Input } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useId, useState } from "react";
import { runModelConnectionPreflight } from "../lib/model-connection-preflight";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/**
 * The one-step way to connect a model: paste a key, and the provider, the model and the key check
 * follow from it. Subscriptions and every other provider stay one click away.
 */
export function QuickKeyConnect({
  catalog,
  signInOptions,
  onSelectProvider,
  onMore,
  onConnected,
}: {
  catalog: readonly ModelCatalogEntry[];
  /** Sign-in with a subscription, as the provider list names them. */
  signInOptions: ReadonlyArray<{ value: string; label: string }>;
  onSelectProvider: (option: string) => void;
  onMore: () => void;
  onConnected: () => void;
}) {
  const { t } = useLingui();
  const fieldId = useId();
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = detectProviderFromKey(key);
  const entry = provider ? catalog.find((item) => item.provider === provider) : undefined;
  const providerName = entry?.providerName ?? provider;

  async function connect() {
    if (!provider || !entry || pending) return;
    setPending(true);
    setError(null);
    const apiKey = key.trim();
    const modelId = pickCatalogModelId([...catalog], provider);
    const checked = await runModelConnectionPreflight({
      authKind: "api-key",
      provider,
      apiKey,
      modelId,
      catalogProbe: true,
      probeCatalog: rpc.models.probeCatalog,
    });
    // A provider that cannot be listed in advance is verified by saving, as in the full form.
    if (!checked.ok && checked.failure.outcome !== "unknown") {
      setError(`${checked.failure.message} ${checked.failure.nextAction}`);
      setPending(false);
      return;
    }
    try {
      await rpc.models.connect({
        provider,
        apiKey,
        modelId,
        label: providerName ?? provider,
      });
      onConnected();
    } catch (err) {
      setError(errorText(err, t`Could not save model`));
      setPending(false);
    }
  }

  return (
    <form
      className="mt-8"
      onSubmit={(event) => {
        event.preventDefault();
        void connect();
      }}
    >
      <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
        <Trans>API key</Trans>
      </label>
      <Input
        id={fieldId}
        type="password"
        value={key}
        onChange={(event) => {
          setKey(event.target.value);
          setError(null);
        }}
        aria-label={t`API key`}
        placeholder={t`Paste your API key`}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        className="mt-2"
      />
      {entry ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {providerName}
        </p>
      ) : key.trim() ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          <Trans>Key not recognized. Choose a provider.</Trans>
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="mt-6" type="submit" disabled={!entry || pending}>
        {pending ? <Trans>Testing…</Trans> : <Trans>Continue</Trans>}
      </Button>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {signInOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className="underline underline-offset-4 hover:text-foreground"
            onClick={() => onSelectProvider(option.value)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="underline underline-offset-4 hover:text-foreground"
          onClick={onMore}
        >
          <Trans>Other providers</Trans>
        </button>
      </div>
    </form>
  );
}
