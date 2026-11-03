import { SKILL_STORE } from "@corvo/core";
import { describe, expect, it, vi } from "vitest";
import { installStoreSkillFromTool, listStoreSkills } from "./store-skills.js";

const owner = { spaceId: "space-1", userId: "user-1" };
const first = SKILL_STORE[0]!;

function setup(existing: { name: string }[] = []) {
  const create = vi.fn(async (args: { data: { name: string } }) => ({
    id: "skill-1",
    ...args.data,
  }));
  const prisma = {
    agentSkill: {
      findMany: vi.fn(async () => existing.map((skill, index) => ({ id: `s${index}`, ...skill }))),
      findFirst: vi.fn(async () => null),
      create,
    },
  };
  return { deps: { prisma } as unknown as Parameters<typeof listStoreSkills>[0], create };
}

describe("listStoreSkills", () => {
  it("lists the Store's skills in the owner's language and marks the ones already added", async () => {
    const { deps } = setup([{ name: first.name["pt-BR"] }]);
    const result = await listStoreSkills(deps, owner, { language: "pt-BR" });
    expect(result.skills).toHaveLength(SKILL_STORE.length);
    expect(result.skills[0]).toMatchObject({
      slug: first.slug,
      name: first.name["pt-BR"],
      description: first.description["pt-BR"],
      installed: true,
    });
    expect(result.skills.filter((skill) => skill.installed)).toHaveLength(1);
  });

  it("narrows by words describing the task, in either language", async () => {
    const { deps } = setup();
    const result = await listStoreSkills(deps, owner, { query: "email" });
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.skills.length).toBeLessThan(SKILL_STORE.length);
    expect(result.skills.map((skill) => skill.slug)).toContain("email-reply");
    expect((await listStoreSkills(deps, owner, { query: "zzzz-nothing" })).skills).toEqual([]);
  });

  it("never returns a skill's body", async () => {
    const { deps } = setup();
    expect(JSON.stringify(await listStoreSkills(deps, owner, {}))).not.toContain(
      first.body.en.slice(0, 40),
    );
  });
});

describe("installStoreSkillFromTool", () => {
  it("adds the Store's own text for the slug, so the model cannot change what is installed", async () => {
    const { deps, create } = setup();
    const result = await installStoreSkillFromTool(deps, owner, {
      slug: first.slug,
      language: "pt-BR",
    });
    expect(result).toMatchObject({ ok: true, name: first.name["pt-BR"] });
    const saved = create.mock.calls[0]?.[0].data as { name: string; content?: string };
    expect(saved.name).toBe(first.name["pt-BR"]);
    expect(saved.content).toContain(first.body["pt-BR"].trim().slice(0, 40));
  });

  it("does nothing the second time and says it was already added", async () => {
    const { deps, create } = setup([{ name: first.name.en }]);
    const result = await installStoreSkillFromTool(deps, owner, { slug: first.slug });
    expect(result).toMatchObject({ ok: true, already: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a slug the Store does not have", async () => {
    const { deps, create } = setup();
    expect(await installStoreSkillFromTool(deps, owner, { slug: "made-up" })).toEqual({
      error: expect.stringContaining("store_skills"),
    });
    expect(create).not.toHaveBeenCalled();
  });
});
