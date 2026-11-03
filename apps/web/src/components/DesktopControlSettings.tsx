import type { CorvoDesktopControlStatus } from "@corvo/contracts";
import { Button, Switch } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useEffect, useState } from "react";
import { desktopBridge } from "../lib/desktop";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { SettingsGroup, SettingsRow } from "./SettingsRows";

const SERVER_SLUG = "desktop-control";

/**
 * The switch that lets bots see and use the apps on this computer. It exists only in the desktop
 * app. Turning it on adds the desktop control tools as an MCP server in this Space and gives them to
 * every bot, so nothing else needs setting up; every action still asks first. Turning it off removes
 * the server, and with it every bot's access.
 */
export function DesktopControlSettings() {
  const { t } = useLingui();
  const control = desktopBridge()?.desktopControl;
  const [status, setStatus] = useState<CorvoDesktopControlStatus | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!control) return;
    const [next, servers] = await Promise.all([control.status(), rpc.mcp.servers.list()]);
    setStatus(next);
    setServerId(servers.find((server) => server.slug === SERVER_SLUG)?.id ?? null);
  }, [control]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  if (!control || !status?.supported) return null;

  const on = serverId !== null;

  async function turnOn() {
    const prepared = await control?.prepare();
    // Declining the app's own question leaves everything as it was.
    if (!prepared) return;
    const created = await rpc.mcp.servers.create({
      transport: "stdio",
      slug: SERVER_SLUG,
      name: t`Desktop control`,
      description: "",
      enabled: true,
      command: prepared.command,
      args: [],
      env: {},
    });
    // One switch, nothing more to set up: every bot gets the tools. replace() overwrites a bot's
    // whole list, so each keeps what it already has.
    const [bots, assigned] = await Promise.all([rpc.bots.list(), rpc.mcp.assignments.all()]);
    await Promise.all(
      bots.map((bot) =>
        rpc.mcp.assignments.replace({
          botId: bot.id,
          assignments: [
            ...assigned
              .filter((entry) => entry.botId === bot.id && entry.serverId !== created.id)
              .map(({ serverId, allowAllTools, allowedTools }) => ({
                serverId,
                allowAllTools,
                allowedTools,
              })),
            { serverId: created.id, allowAllTools: true, allowedTools: [] },
          ],
        }),
      ),
    );
    setServerId(created.id);
    setStatus(prepared.status);
  }

  async function turnOff() {
    if (serverId === null) return;
    await rpc.mcp.servers.remove({ id: serverId });
    setServerId(null);
  }

  async function change(next: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await (next ? turnOn() : turnOff());
    } catch (err) {
      setError(errorText(err, t`Could not change desktop control`));
    } finally {
      setPending(false);
    }
  }

  const needsAccess = on && status.installed && status.permissions.accessibility !== "granted";

  return (
    <SettingsGroup data-testid="desktop-control-settings">
      <SettingsRow
        label={t`Desktop control`}
        control={
          <Switch
            checked={on}
            disabled={pending}
            aria-label={t`Desktop control`}
            onCheckedChange={(checked) => void change(checked)}
          />
        }
      >
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          <Trans>Let bots see and use your apps. Actions ask first.</Trans>
        </p>
        {needsAccess ? (
          <div className="mt-3">
            <p className="text-[13px] leading-relaxed text-foreground">
              <Trans>Allow Rook under Accessibility in your system's privacy settings.</Trans>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void control.openPermissionGuide()}
              >
                <Trans>Open privacy settings</Trans>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void refresh().catch(() => undefined)}
              >
                <Trans>Check again</Trans>
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-destructive">
            {error}
          </p>
        ) : null}
      </SettingsRow>
    </SettingsGroup>
  );
}
