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

  it("keeps an agent another agent created in its team, as a colleague like any other", () => {
    // The Chief installs and creates agents; the creator is only where it came from.
    const roster = buildTeamRoster(
      [bot("chief"), bot("made", "running", { parentBotId: "chief" })],
      [group("eng", ["made"])],
    );
    expect(roster.teams[0]?.members.map((member) => member.bot.id)).toEqual(["made"]);
    expect(roster.teams[0]?.working).toBe(1);
  });

  it("lists an agent another agent created among those with no team, when it has none", () => {
    const roster = buildTeamRoster(
      [bot("chief"), bot("made", "idle", { parentBotId: "chief" })],
      [],
    );
    expect(roster.unassigned.map((item) => item.id)).toEqual(["chief", "made"]);
  });

  it("skips members that are no longer in the space", () => {
    const roster = buildTeamRoster([bot("a")], [group("eng", ["a", "gone"])]);
    expect(roster.teams[0]?.members).toHaveLength(1);
  });

  it("sets the Chief apart, found by its first-run key or by its old name", () => {
    const byKey = buildTeamRoster(
      [bot("a"), bot("c", "idle", { spawnKey: "onboarding:first" })],
      [group("eng", ["a"])],
    );
    expect(byKey.chief?.id).toBe("c");
    expect(byKey.unassigned.map((item) => item.id)).toEqual([]);

    const byName = buildTeamRoster([bot("a"), bot("old", "idle", { name: "Chief" })], []);
    expect(byName.chief?.id).toBe("old");
    expect(buildTeamRoster([bot("a")], []).chief).toBeUndefined();
  });

  it("leaves the Chief in a team it belongs to, where it is a member", () => {
    const roster = buildTeamRoster(
      [bot("c", "idle", { spawnKey: "onboarding:first" }), bot("a")],
      [group("eng", ["c", "a"])],
    );
    expect(roster.teams[0]?.members.map((member) => member.bot.id)).toEqual(["c", "a"]);
  });

  it("puts first those who need you or failed, then those working, then the rest in order", () => {
    const roster = buildTeamRoster(
      [
        bot("idle1"),
        bot("working", "running"),
        bot("asks", "waiting_input"),
        bot("idle2"),
        bot("broke", "failed"),
        bot("takeover", "waiting_takeover"),
      ],
      [group("eng", ["idle1", "working", "asks", "idle2", "broke", "takeover"])],
    );
    expect(roster.teams[0]?.members.map((member) => member.bot.id)).toEqual([
      "asks",
      "broke",
      "takeover",
      "working",
      "idle1",
      "idle2",
    ]);
  });

  it("does not list a team nobody is in", () => {
    const roster = buildTeamRoster([bot("a")], [group("eng", ["gone"]), group("ops", ["a"])]);
    expect(roster.teams.map((team) => team.group.id)).toEqual(["ops"]);
  });

  it("counts how many in a team need you", () => {
    const roster = buildTeamRoster(
      [bot("a", "waiting_input"), bot("b", "failed"), bot("c", "running"), bot("d")],
      [group("eng", ["a", "b", "c", "d"])],
    );
    expect(roster.teams[0]).toMatchObject({ working: 1, needsYou: 2 });
  });
});
