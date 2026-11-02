import type { AgentCatalogLocale, SkillStoreEntry } from "@corvo/contracts";
import { rpc } from "./rpc";

/** Whether a skill with either of the entry's names is already installed (names ignore case). */
export function isSkillInstalled(
  entry: SkillStoreEntry,
  installedNames: readonly string[],
): boolean {
  const names = new Set(installedNames.map((name) => name.trim().toLowerCase()));
  return names.has(entry.name.en.toLowerCase()) || names.has(entry.name["pt-BR"].toLowerCase());
}

/** Install a store skill, in the person's language, for all their agents. */
export async function installStoreSkill(
  entry: SkillStoreEntry,
  locale: AgentCatalogLocale,
): Promise<void> {
  await rpc.agentSkills.create({
    name: entry.name[locale],
    description: entry.description[locale],
    body: entry.body[locale],
  });
}
