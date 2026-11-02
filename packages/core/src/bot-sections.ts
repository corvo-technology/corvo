export type BotListSection<T> = {
  key: string;
  title: string | null;
  bots: T[];
};

/** The key the Chief is created with; it is the one agent that leads the sidebar. */
export const CHIEF_BOT_SPAWN_KEY = "onboarding:first";

type Section = { id: string; name: string };
type SectionedBot = {
  pinned: boolean;
  sectionId: string | null;
  /** The Chief always leads the list, above everything, pinned or not. */
  isChief?: boolean;
  /** A group chat; the ones not pinned or sorted into a section share one list. */
  isGroup?: boolean;
};

export function groupBotsForSidebar<T extends SectionedBot>(
  bots: readonly T[],
  sections: readonly Section[],
  options: {
    includeEmptySections?: boolean;
    labels?: { pinned: string; unassigned: string; groups?: string };
  } = {},
): BotListSection<T>[] {
  const knownSectionIds = new Set(sections.map((section) => section.id));
  const chief: T[] = [];
  const pinned: T[] = [];
  const groups: T[] = [];
  const sectionMembers = new Map<string, T[]>();
  const unassigned: T[] = [];
  const grouped: BotListSection<T>[] = [];

  for (const bot of bots) {
    if (bot.isChief) {
      chief.push(bot);
    } else if (bot.pinned) {
      pinned.push(bot);
    } else if (bot.sectionId && knownSectionIds.has(bot.sectionId)) {
      const members = sectionMembers.get(bot.sectionId) ?? [];
      members.push(bot);
      sectionMembers.set(bot.sectionId, members);
    } else if (bot.isGroup) {
      groups.push(bot);
    } else {
      unassigned.push(bot);
    }
  }

  if (chief.length > 0) grouped.push({ key: "chief", title: null, bots: chief });
  if (pinned.length > 0) {
    grouped.push({ key: "pinned", title: options.labels?.pinned ?? "Pinned", bots: pinned });
  }
  if (groups.length > 0) {
    grouped.push({ key: "groups", title: options.labels?.groups ?? "Groups", bots: groups });
  }
  for (const section of sections) {
    const members = sectionMembers.get(section.id) ?? [];
    if (members.length > 0 || options.includeEmptySections) {
      grouped.push({ key: `section:${section.id}`, title: section.name, bots: members });
    }
  }
  if (unassigned.length > 0) {
    grouped.push({
      key: "unassigned",
      title:
        pinned.length > 0 || groups.length > 0 || sections.length > 0
          ? (options.labels?.unassigned ?? "Unassigned")
          : null,
      bots: unassigned,
    });
  }

  return grouped;
}

export function reorderBotTo<T extends { id: string }>(
  bots: readonly T[],
  sourceId: string,
  targetId: string,
): readonly T[] {
  const sourceIndex = bots.findIndex((bot) => bot.id === sourceId);
  const targetIndex = bots.findIndex((bot) => bot.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return bots;
  const reordered = [...bots];
  const [source] = reordered.splice(sourceIndex, 1);
  if (!source) return bots;
  reordered.splice(targetIndex, 0, source);
  return reordered;
}
