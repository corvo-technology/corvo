import type { SpaceBot, SpaceGroup } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import { buildTeamRoster } from "./team-roster";

const bot = (id: string, status = "idle", extra: Partial<SpaceBot> = {}) =>
  ({ id, name: id, color: "#000", status, preview: "", parentBotId: null, ...extra }) as SpaceBot;
const group = (id: string, botIds: string[]) =>
  ({
    id,
    name: id,
    members: botIds.map((botId) => ({ botId, name: botId, color: "#000" })),
  }) as SpaceGroup;

describe("buildTeamRoster", () => {
  it("lists each team with its members and who is working", () => {
    const roster = buildTeamRoster([bot("a", "running"), bot("b")], [group("eng", ["a", "b"])]);
    expect(roster.teams).toHaveLength(1);
    expect(roster.teams[0]?.working).toBe(1);
    expect(roster.teams[0]?.members.map((member) => member.bot.id)).toEqual(["a", "b"]);
  });

  it("keeps bots outside every team in their own list", () => {
    const roster = buildTeamRoster([bot("a"), bot("b")], [group("eng", ["a"])]);
    expect(roster.unassigned.map((item) => item.id)).toEqual(["b"]);
  });

  it("ignores helpers a bot started for one task", () => {
    const roster = buildTeamRoster([bot("a"), bot("h", "idle", { parentBotId: "a" })], []);
    expect(roster.unassigned.map((item) => item.id)).toEqual(["a"]);
  });

  it("skips members that are no longer in the space", () => {
    const roster = buildTeamRoster([bot("a")], [group("eng", ["a", "gone"])]);
    expect(roster.teams[0]?.members).toHaveLength(1);
  });
});
