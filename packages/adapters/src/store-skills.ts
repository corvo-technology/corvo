import type { SkillStoreEntry } from "@corvo/contracts";
import { agentCatalogLocale } from "@corvo/contracts";
import { SKILL_STORE } from "@corvo/core";
import type { PrismaClient } from "@corvo/db";
import { listAgentSkillRecords, skillCreateFromTool } from "./skill-tools.js";

type Owner = { spaceId: string; userId: string };
type Locale = ReturnType<typeof agentCatalogLocale>;

const MAX_QUERY_CHARS = 100;

/** The Store's language for what the model says it is speaking with the owner. */
function languageOf(args: { language?: unknown }): Locale {
  return agentCatalogLocale(typeof args.language === "string" ? args.language : "en");
}

async function installedNames(prisma: PrismaClient, owner: Owner): Promise<Set<string>> {
  return new Set(
    (await listAgentSkillRecords(prisma, owner)).map((skill) => skill.name.toLowerCase()),
  );
}

const isInstalled = (have: ReadonlySet<string>, entry: SkillStoreEntry) =>
  have.has(entry.name.en.toLowerCase()) || have.has(entry.name["pt-BR"].toLowerCase());

/**
 * The ready-made skills the owner can add, optionally narrowed by words describing the task.
 * Only what the owner sees in the Store: name, what it is for, whether it is already added.
 */
export async function listStoreSkills(
  deps: { prisma: PrismaClient },
  owner: Owner,
  args: { query?: unknown; language?: unknown },
) {
  const locale = languageOf(args);
  const words = String(args.query ?? "")
    .toLowerCase()
    .slice(0, MAX_QUERY_CHARS)
    .split(/\s+/)
    .filter(Boolean);
  const have = await installedNames(deps.prisma, owner);
  const matches = (entry: SkillStoreEntry) => {
    if (words.length === 0) return true;
    const text =
      `${entry.slug} ${entry.name.en} ${entry.name["pt-BR"]} ${entry.description.en} ${entry.description["pt-BR"]}`.toLowerCase();
    return words.some((word) => text.includes(word));
  };
  return {
    skills: SKILL_STORE.filter(matches).map((entry) => ({
      slug: entry.slug,
      name: entry.name[locale],
      description: entry.description[locale],
      installed: isInstalled(have, entry),
    })),
    note: "Add one with skill_install when it fits the task, then follow it with skill_read. Say which one you added.",
  };
}

/** Add one Store skill to the owner's library, as the Store's Add button does. Safe to repeat. */
export async function installStoreSkill(
  deps: { prisma: PrismaClient },
  owner: Owner,
  entry: SkillStoreEntry,
  locale: Locale,
): Promise<{ ok: true; name: string; already?: true } | { error: string }> {
  if (isInstalled(await installedNames(deps.prisma, owner), entry)) {
    return { ok: true, name: entry.name[locale], already: true };
  }
  const result = await skillCreateFromTool(deps.prisma, owner, {
    name: entry.name[locale],
    description: entry.description[locale],
    body: entry.body[locale],
  });
  return result.ok ? { ok: true, name: entry.name[locale] } : { error: String(result.error) };
}

/** skill_install: add a Store skill by its slug. The text is the Store's, never the model's. */
export async function installStoreSkillFromTool(
  deps: { prisma: PrismaClient },
  owner: Owner,
  args: { slug?: unknown; language?: unknown },
) {
  const entry = SKILL_STORE.find((skill) => skill.slug === String(args.slug ?? ""));
  if (!entry) return { error: "No skill with that slug. Call store_skills for the list." };
  const installed = await installStoreSkill(deps, owner, entry, languageOf(args));
  if ("error" in installed) return installed;
  return {
    ...installed,
    note: `${installed.already ? "Already added." : "Added to the owner's skills."} Load it with skill_read name "${installed.name}" and follow it. Tell the owner you added it; they can remove it under Skills.`,
  };
}
