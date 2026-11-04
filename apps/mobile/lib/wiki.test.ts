import type { WikiPageInfo } from "@corvo/contracts";
import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ rpc }));

import { groupWikiPages, listWikiPages, readWikiPage, wikiDisplayBody } from "./wiki";

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
