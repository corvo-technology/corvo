import type { SpaceBot, SpaceGroup } from "@corvo/contracts";
import { isRunWorking } from "@corvo/core";

export type TeamMember = { bot: SpaceBot; working: boolean };
export type Team = { group: SpaceGroup; members: TeamMember[]; working: number };

/** Every team with who is in it and who is busy, plus the bots that belong to no team yet. */
export function buildTeamRoster(bots: readonly SpaceBot[], groups: readonly SpaceGroup[]) {
  // Helpers a bot starts for one task are part of that task, not of the company.
  const staff = bots.filter((bot) => !bot.parentBotId);
  const byId = new Map(staff.map((bot) => [bot.id, bot]));
  const teams: Team[] = groups.map((group) => {
    const members = group.members.flatMap((member) => {
      const bot = byId.get(member.botId);
      return bot ? [{ bot, working: isRunWorking(bot.status) }] : [];
    });
    return { group, members, working: members.filter((member) => member.working).length };
  });
  const placed = new Set(groups.flatMap((group) => group.members.map((member) => member.botId)));
  return { teams, unassigned: staff.filter((bot) => !placed.has(bot.id)) };
}
