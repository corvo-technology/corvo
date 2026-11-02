import { describe, expect, it } from "vitest";
import { groupBotsForSidebar, reorderBotTo } from "./bot-sections.js";

const sections = [
  { id: "work", name: "Work" },
  { id: "home", name: "Home" },
];

describe("groupBotsForSidebar", () => {
  it("labels only built-in groups and preserves keys and the heading-free list", () => {
    const labels = { pinned: "Angeheftet", unassigned: "Nicht zugewiesen" };
    const bots = [
      { id: "pin", pinned: true, sectionId: null },
      { id: "loose", pinned: false, sectionId: null },
    ];
    expect(
      groupBotsForSidebar(bots, [{ id: "custom", name: "Pinned" }], {
        labels,
        includeEmptySections: true,
      }).map(({ key, title }) => [key, title]),
    ).toEqual([
      ["pinned", labels.pinned],
      ["section:custom", "Pinned"],
      ["unassigned", labels.unassigned],
    ]);
    expect(groupBotsForSidebar([bots[1]!], [], { labels })[0]?.title).toBeNull();
  });
  it("keeps pinned bots in one top-level group without duplicating them", () => {
    const groups = groupBotsForSidebar(
      [
        { id: "pinned", pinned: true, sectionId: "home" },
        { id: "work", pinned: false, sectionId: "work" },
        { id: "home", pinned: false, sectionId: "home" },
        { id: "loose", pinned: false, sectionId: null },
      ],
      sections,
    );

    expect(groups.map((group) => [group.title, group.bots.map((bot) => bot.id)])).toEqual([
      ["Pinned", ["pinned"]],
      ["Work", ["work"]],
      ["Home", ["home"]],
      ["Unassigned", ["loose"]],
    ]);
  });

  it("treats bots pointing at an unavailable section as unassigned", () => {
    const groups = groupBotsForSidebar(
      [{ id: "orphan", pinned: false, sectionId: "missing" }],
      sections,
    );
    expect(groups).toEqual([
      {
        key: "unassigned",
        title: "Unassigned",
        bots: [{ id: "orphan", pinned: false, sectionId: "missing" }],
      },
    ]);
  });

  it("puts the Chief first and alone, even when pinned or in a section, then pinned, groups, sections, the rest", () => {
    const groups = groupBotsForSidebar(
      [
        { id: "loose", pinned: false, sectionId: null },
        { id: "team", pinned: false, sectionId: null, isGroup: true },
        { id: "work-bot", pinned: false, sectionId: "work" },
        { id: "pinned", pinned: true, sectionId: null },
        { id: "chief", pinned: true, sectionId: "home", isChief: true },
        { id: "pinned-group", pinned: true, sectionId: null, isGroup: true },
        { id: "work-group", pinned: false, sectionId: "work", isGroup: true },
      ],
      sections,
      { labels: { pinned: "Pinned", unassigned: "Unassigned", groups: "Grupos" } },
    );
    expect(
      groups.map((group) => [group.key, group.title, group.bots.map((bot) => bot.id)]),
    ).toEqual([
      ["chief", null, ["chief"]],
      ["pinned", "Pinned", ["pinned", "pinned-group"]],
      ["groups", "Grupos", ["team"]],
      ["section:work", "Work", ["work-bot", "work-group"]],
      ["unassigned", "Unassigned", ["loose"]],
    ]);
  });

  it("heads the loose bots once there are groups next to them, and not before", () => {
    const loose = { id: "loose", pinned: false, sectionId: null };
    const group = { id: "team", pinned: false, sectionId: null, isGroup: true };
    expect(groupBotsForSidebar([loose, group], []).map((item) => item.title)).toEqual([
      "Groups",
      "Unassigned",
    ]);
    const chief = { id: "chief", pinned: false, sectionId: null, isChief: true };
    expect(groupBotsForSidebar([chief, loose], []).map((item) => item.title)).toEqual([null, null]);
  });

  it("does not add a heading before sections or pins exist", () => {
    const groups = groupBotsForSidebar([{ id: "first", pinned: false, sectionId: null }], []);
    expect(groups[0]?.title).toBeNull();
  });
});

describe("reorderBotTo", () => {
  const bots = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("moves a bot to the target bot's position in either direction", () => {
    expect(reorderBotTo(bots, "a", "c").map((bot) => bot.id)).toEqual(["b", "c", "a"]);
    expect(reorderBotTo(bots, "c", "a").map((bot) => bot.id)).toEqual(["c", "a", "b"]);
  });

  it("leaves the list alone when either bot is missing or unchanged", () => {
    expect(reorderBotTo(bots, "a", "missing")).toBe(bots);
    expect(reorderBotTo(bots, "a", "a")).toBe(bots);
  });
});
