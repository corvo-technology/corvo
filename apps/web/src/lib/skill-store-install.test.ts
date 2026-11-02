import { SKILL_STORE } from "@corvo/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installStoreSkill, isSkillInstalled } from "./skill-store-install";

const create = vi.hoisted(() => vi.fn());
vi.mock("./rpc", () => ({ rpc: { agentSkills: { create } } }));

const entry = SKILL_STORE.find((skill) => skill.slug === "project-plan")!;
beforeEach(() => create.mockReset().mockResolvedValue({}));

describe("isSkillInstalled", () => {
  it("matches the English or the Portuguese name, ignoring case and spacing", () => {
    expect(isSkillInstalled(entry, ["project plan"])).toBe(true);
    expect(isSkillInstalled(entry, ["  Plano de projeto "])).toBe(true);
    expect(isSkillInstalled(entry, ["Weekly Summary"])).toBe(false);
    expect(isSkillInstalled(entry, [])).toBe(false);
  });
});

describe("installStoreSkill", () => {
  it("installs the skill with its text in the person's language", async () => {
    await installStoreSkill(entry, "pt-BR");
    expect(create).toHaveBeenCalledWith({
      name: "Plano de projeto",
      description: entry.description["pt-BR"],
      body: entry.body["pt-BR"],
    });
  });

  it("uses English for everything else", async () => {
    await installStoreSkill(entry, "en");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Project Plan" }));
  });
});
