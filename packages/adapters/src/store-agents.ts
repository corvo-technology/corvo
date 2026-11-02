import { agentCatalogLocale, agentCatalogSpawnKey } from "@corvo/contracts";
import { AGENT_CATALOG, APP_CATALOG, SKILL_STORE } from "@corvo/core";
import type { PrismaClient } from "@corvo/db";
import { createRepos } from "@corvo/db";
import { getLogger } from "@corvo/logging";
import type { FleetRun } from "./fleet-tools.js";
import { listAgentSkillRecords, skillCreateFromTool } from "./skill-tools.js";

const appName = (slug: string) => APP_CATALOG.find((app) => app.slug === slug)?.name ?? slug;

/** The Store's language for what the model says it is speaking with the owner. */
function languageOf(args: { language?: unknown }) {
  return agentCatalogLocale(typeof args.language === "string" ? args.language : "en");
}

/**
 * The ready-made agents the owner can add, with whether each is already added and which of its
 * apps are connected. Only what the owner sees in the Store: never the agents' instructions.
 */
export async function listStoreAgents(
  deps: { prisma: PrismaClient },
  run: FleetRun,
  args: { language?: unknown },
) {
  const locale = languageOf(args);
  const [bots, servers] = await Promise.all([
    deps.prisma.bot.findMany({
      where: {
        spaceId: run.spaceId,
        userId: run.userId,
        archivedAt: null,
        spawnKey: { not: null },
      },
      select: { spawnKey: true },
    }),
    deps.prisma.mcpServer.findMany({
      where: { spaceId: run.spaceId, userId: run.userId, enabled: true },
      select: { slug: true },
    }),
  ]);
  const keys = new Set(bots.map((bot) => bot.spawnKey));
  const connected = new Set(servers.map((server) => server.slug));
  return {
    agents: AGENT_CATALOG.map((entry) => ({
      slug: entry.slug,
      name: entry.name[locale],
      description: entry.description[locale],
      added:
        entry.setup === "email"
          ? [...keys].some((key) => key?.startsWith("email-agent:"))
          : keys.has(agentCatalogSpawnKey(entry.slug)),
      needsSetup: entry.setup === "email",
      apps: entry.apps.map((slug) => ({
        slug,
        name: appName(slug),
        added: connected.has(slug),
      })),
    })),
    note: "Ask the owner before adding one. An agent that needs setup is added by the owner from the Store, under Agents, after connecting an inbox service under Apps.",
  };
}

type StoreDeps = {
  prisma: PrismaClient;
  /** Defaults to the shared bot creation; replaceable so tests need no database. */
  createBot?: ReturnType<typeof createRepos>["createBot"];
};

/**
 * Add a catalog agent for the owner, as the Store's Add button does: the bot in the owner's
 * language, the apps it uses that are already added, and the skills it works best with. Adding
 * twice returns the agent already there.
 */
export async function installStoreAgent(
  deps: StoreDeps,
  run: FleetRun,
  args: { slug?: unknown; language?: unknown },
) {
  const entry = AGENT_CATALOG.find((agent) => agent.slug === String(args.slug ?? ""));
  if (!entry) return { error: "No agent with that slug. Call store_agents for the list." };
  const locale = languageOf(args);
  if (entry.setup === "email") {
    return {
      error: `${entry.name[locale]} needs an inbox service first. The owner connects MillionSend or Resend under Apps in the Store, then adds it under Agents.`,
    };
  }
  const owner = { spaceId: run.spaceId, userId: run.userId };
  const spawnKey = agentCatalogSpawnKey(entry.slug);
  let duplicate = false;
  let created: { id: string; name: string; title: string; threadId: string | null };
  try {
    const create = deps.createBot ?? createRepos(deps.prisma).createBot;
    created = await create(
      { ...owner, email: "", isDeploymentOwner: false },
      {
        name: entry.name[locale],
        title: "",
        description: entry.description[locale],
        instructions: entry.instructions[locale],
        notifyOnFinish: true,
        color: entry.color,
        // Creation provenance only; the agent stays a peer in the roster.
        parentBotId: run.botId,
        spawnKey,
        ...(entry.disabledTools ? { disabledBuiltinTools: [...entry.disabledTools] } : {}),
      },
    );
  } catch (error) {
    const existing = await deps.prisma.bot.findUnique({
      where: { spaceId_spawnKey: { spaceId: run.spaceId, spawnKey } },
      include: { thread: true },
    });
    if (!existing) throw error;
    duplicate = true;
    created = {
      id: existing.id,
      name: existing.name,
      title: existing.title,
      threadId: existing.thread?.id ?? null,
    };
  }

  const servers = await deps.prisma.mcpServer.findMany({
    where: { ...owner, enabled: true, slug: { in: entry.apps } },
    select: { id: true, slug: true },
  });
  for (const server of servers) {
    await deps.prisma.botMcpServer.upsert({
      where: { botId_serverId: { botId: created.id, serverId: server.id } },
      create: {
        ...owner,
        botId: created.id,
        serverId: server.id,
        allowAllTools: true,
        allowedTools: [],
      },
      update: {},
    });
  }

  const have = new Set(
    (await listAgentSkillRecords(deps.prisma, owner)).map((skill) => skill.name.toLowerCase()),
  );
  const skillsInstalled: string[] = [];
  for (const skill of SKILL_STORE.filter((item) => entry.skills?.includes(item.slug))) {
    if (have.has(skill.name.en.toLowerCase()) || have.has(skill.name["pt-BR"].toLowerCase()))
      continue;
    const result = await skillCreateFromTool(deps.prisma, owner, {
      name: skill.name[locale],
      description: skill.description[locale],
      body: skill.body[locale],
    });
    if (result.ok) skillsInstalled.push(skill.name[locale]);
    else getLogger().warn("store agent skill not installed", { skill: skill.slug });
  }

  const connected = new Set(servers.map((server) => server.slug));
  return {
    ok: true as const,
    ...(duplicate ? { duplicate: true as const } : {}),
    botId: created.id,
    name: created.name,
    title: created.title,
    threadId: created.threadId,
    skillsInstalled,
    appsToConnect: entry.apps.filter((slug) => !connected.has(slug)).map(appName),
  };
}
