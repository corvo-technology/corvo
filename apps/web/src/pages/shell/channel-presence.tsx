import type { GroupMember } from "@corvo/contracts";
import { BotAvatar } from "@corvo/ui-web";
import { useLingui } from "@lingui/react/macro";

/** How many faces the row shows before a count says the rest. */
const PRESENCE_FACES = 3;

/**
 * Who is working in a channel, at the end of its sidebar row: the faces of the bots that are, and
 * a slow mint dot. It appears only while someone works and says nothing else, so a channel row
 * stays its name until then.
 */
export function ChannelPresence({ members }: { members: readonly GroupMember[] }) {
  const { t } = useLingui();
  if (members.length === 0) return null;
  const faces = members.slice(0, PRESENCE_FACES);
  const rest = members.length - faces.length;
  const working = t`Working…`;
  return (
    <span
      role="img"
      aria-label={`${members.map((member) => member.name).join(", ")}: ${working}`}
      data-testid="channel-presence"
      className="corvo-message-in flex shrink-0 items-center gap-1"
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {faces.map((member) => (
          <BotAvatar key={member.botId} color={member.color} identity={member.botId} size={16} />
        ))}
        {rest > 0 ? (
          <span className="ps-0.5 text-[11px] tabular-nums text-muted-foreground">+{rest}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="corvo-presence-dot size-1.5 shrink-0 rounded-full bg-status-working"
      />
    </span>
  );
}
