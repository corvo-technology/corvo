import type { SpaceBot, SpaceGroup, Ticket, TicketStatus } from "@corvo/contracts";
import { isRunWorking } from "@corvo/core";
import { findFirstBot } from "./first-bot";

export type TeamMember = { bot: SpaceBot; working: boolean; needsYou: boolean };
export type Team = {
  group: SpaceGroup;
  members: TeamMember[];
  working: number;
  /** Members waiting for an answer or for you, or that failed. */
  needsYou: number;
};

/** Waiting on the person, or failed: the states a person should look at first. */
export function botNeedsYou(status: string): boolean {
  return status === "waiting_input" || status === "waiting_takeover" || status === "failed";
}

const rank = (member: TeamMember) => (member.needsYou ? 0 : member.working ? 1 : 2);

/**
 * Every team with who is in it, the ones that need you first and then the ones working, the
 * Chief that leads them, and the agents that belong to no team yet.
 */
export function buildTeamRoster(bots: readonly SpaceBot[], groups: readonly SpaceGroup[]) {
  // An agent another agent created or installed (the Chief does) is a colleague like any other:
  // `parentBotId` is only where it came from.
  const staff = bots;
  const byId = new Map(staff.map((bot) => [bot.id, bot]));
  const firstBot = findFirstBot(staff.map((bot) => ({ ...bot, spawnKey: bot.spawnKey ?? null })));
  const chief = firstBot ? byId.get(firstBot.id) : undefined;
  const teams: Team[] = groups.flatMap((group) => {
    const members = group.members
      .flatMap((member) => {
        const bot = byId.get(member.botId);
        return bot
          ? [{ bot, working: isRunWorking(bot.status), needsYou: botNeedsYou(bot.status) }]
          : [];
      })
      .sort((a, b) => rank(a) - rank(b));
    if (members.length === 0) return [];
    return [
      {
        group,
        members,
        working: members.filter((member) => member.working).length,
        needsYou: members.filter((member) => member.needsYou).length,
      },
    ];
  });
  const placed = new Set(groups.flatMap((group) => group.members.map((member) => member.botId)));
  return {
    chief,
    teams,
    unassigned: staff.filter((bot) => !placed.has(bot.id) && bot.id !== chief?.id),
  };
}

/** The columns where an agent is actually at work: started, waiting to be checked, or stuck. */
export const TICKET_WORK_STATUSES: readonly TicketStatus[] = ["doing", "review", "blocked"];

/** What each agent is working on, newest first. */
export function ticketsByOwner(tickets: readonly Ticket[]): Map<string, Ticket[]> {
  const byOwner = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    if (!ticket.assigneeBotId || !TICKET_WORK_STATUSES.includes(ticket.status)) continue;
    const list = byOwner.get(ticket.assigneeBotId) ?? [];
    list.push(ticket);
    byOwner.set(ticket.assigneeBotId, list);
  }
  for (const list of byOwner.values()) {
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return byOwner;
}
