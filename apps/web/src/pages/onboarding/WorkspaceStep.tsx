import { SPACE_NAME_MAX_LENGTH } from "@corvo/contracts";
import { Button, Input } from "@corvo/ui-web";
import { useLingui } from "@lingui/react/macro";
import { useId, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export function WorkspaceStep({
  spaceId,
  initialName,
  onDone,
}: {
  spaceId: string;
  initialName: string;
  onDone: (name: string) => void;
}) {
  const { t } = useLingui();
  const headingId = useId();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function submit() {
    if (started.current) return;
    const trimmed = name.trim();
    if (trimmed === initialName) {
      onDone(trimmed);
      return;
    }
    if (trimmed.length === 0 || trimmed.length > SPACE_NAME_MAX_LENGTH) {
      setError(t`Enter a name up to ${SPACE_NAME_MAX_LENGTH} characters.`);
      return;
    }
    started.current = true;
    setPending(true);
    setError(null);
    try {
      const saved = await rpc.spaces.rename({ spaceId, name: trimmed });
      onDone(saved.name);
    } catch (err) {
      started.current = false;
      setPending(false);
      setError(errorText(err, t`Could not save the name`));
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 id={headingId} className="text-[32px] font-medium text-foreground">
        {t`Name your workspace`}
      </h1>
      <Input
        aria-labelledby={headingId}
        className="mt-8"
        maxLength={SPACE_NAME_MAX_LENGTH}
        value={name}
        disabled={pending}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="mt-8 w-full" disabled={pending}>
        {t`Continue`}
      </Button>
    </form>
  );
}
