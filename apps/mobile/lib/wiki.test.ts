import type { WikiPageInfo } from "@corvo/contracts";
import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ rpc }));

import {
  decideWikiChange,
  getWikiChange,
  groupWikiPages,
  keepMessageInWiki,
  listWikiChanges,
  listWikiPages,
  readWikiPage,
  wikiDisplayBody,
} from "./wiki";

const info = (title: string, kind: string): WikiPageInfo => ({
  title,
  path: `${title}.md`,
  kind,
  summary: `About ${title}.`,
  revision: 1,
  updatedAt: "2026-11-04T10:00:00.000Z",
});

beforeEach(() => rpc.mockReset());

it("groups the pages by kind, kinds and titles in order", () => {
  const groups = groupWikiPages([
    info("Zed", "Person"),
    info("Plan", "Project"),
    info("Ana", "Person"),
  ]);
  expect(groups.map((group) => [group.kind, group.pages.map((page) => page.title)])).toEqual([
    ["Person", ["Ana", "Zed"]],
    ["Project", ["Plan"]],
  ]);
  expect(groupWikiPages([])).toEqual([]);
});

it("draws a link to a page that exists and leaves the label of one that does not", () => {
  const known = [info("Ana Souza", "Person"), info("Alpha (Beta)", "Client")];
  expect(
    wikiDisplayBody(
      "---\ntype: Project\n---\nOwner: [[ana souza]]. See [[Alpha (Beta)]], [[Budget]].",
      known,
    ),
  ).toBe(
    "Owner: [ana souza](corvo-mention:ana%20souza). See [Alpha (Beta)](corvo-mention:Alpha%20%28Beta%29), Budget.",
  );
});

it("asks the server for the index and for one page", async () => {
  rpc.mockResolvedValueOnce([info("Ana", "Person")]);
  expect(await listWikiPages()).toEqual([info("Ana", "Person")]);
  expect(rpc).toHaveBeenLastCalledWith("wiki/index");
  rpc.mockResolvedValueOnce({ title: "Ana" });
  await readWikiPage("Ana");
  expect(rpc).toHaveBeenLastCalledWith("wiki/read", { title: "Ana" });
});

it("asks for the changes that wait, one change by its id, and answers one", async () => {
  rpc.mockResolvedValue([]);
  await listWikiChanges(["pending"]);
  expect(rpc).toHaveBeenLastCalledWith("wiki/changes/list", { state: ["pending"] });
  await getWikiChange("c1");
  expect(rpc).toHaveBeenLastCalledWith("wiki/changes/get", { changeId: "c1" });
  await decideWikiChange("c1", "apply");
  expect(rpc).toHaveBeenLastCalledWith("wiki/changes/decide", {
    changeId: "c1",
    decision: "apply",
  });
});

it("keeps a message of a chat or of a channel", async () => {
  rpc.mockResolvedValue({ ok: true });
  await keepMessageInWiki({ botId: "b1" }, "m1");
  expect(rpc).toHaveBeenLastCalledWith("wiki/keep", { botId: "b1", messageId: "m1" });
  await keepMessageInWiki({ groupId: "g1" }, "m2");
  expect(rpc).toHaveBeenLastCalledWith("wiki/keep", { groupId: "g1", messageId: "m2" });
});
