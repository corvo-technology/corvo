// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ boards: { subscribe: vi.fn() } }));
vi.mock("../../lib/rpc", () => ({ rpc: api }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + String(values[index] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: unknown }) => children };
});

import { useBoardNotifications } from "./use-board-notifications";

const shown: Array<{ title: string; options: NotificationOptions }> = [];
class FakeNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  onclick: (() => void) | null = null;
  constructor(title: string, options: NotificationOptions) {
    shown.push({ title, options });
  }
  close() {}
}

function move(status: string, createdAt: string, byBotId: string | null = "bot-1") {
  return {
    spaceId: "s",
    ticketId: "t1",
    createdAt,
    moved: {
      ref: "RAK-3",
      title: "Call Ana",
      status,
      previousStatus: "doing",
      byBotId,
      byName: "Planner",
    },
  };
}

/** Frames from the server, then a connection that stays open. */
function stream(...items: unknown[]) {
  return (async function* () {
    for (const item of items) yield item;
    await new Promise(() => {});
  })();
}

function Probe({ enabled }: { enabled: boolean }) {
  useBoardNotifications(enabled);
  return null;
}

async function mount(enabled = true) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <Probe enabled={enabled} />
      </MemoryRouter>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return () => act(async () => root.unmount());
}

beforeEach(() => {
  shown.length = 0;
  FakeNotification.permission = "granted";
  FakeNotification.requestPermission.mockClear();
  api.boards.subscribe.mockReset();
  vi.stubGlobal("Notification", FakeNotification);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => vi.unstubAllGlobals());

it("tells the person once when an agent moves a card to review", async () => {
  api.boards.subscribe.mockResolvedValue(
    stream(
      move("review", "2026-11-05T10:00:00Z"),
      move("review", "2026-11-05T10:00:00Z"),
      move("doing", "2026-11-05T10:01:00Z"),
      move("done", "2026-11-05T10:02:00Z", null),
    ),
  );
  const stop = await mount();
  expect(shown).toHaveLength(1);
  expect(shown[0]).toMatchObject({
    title: "Planner moved RAK-3 to In review",
    options: { body: "Call Ana", tag: "t1:review" },
  });
  await stop();
});

it("does not listen while the board is off", async () => {
  const stop = await mount(false);
  expect(api.boards.subscribe).not.toHaveBeenCalled();
  await stop();
});

it("asks for permission once and shows the notice when it is granted", async () => {
  FakeNotification.permission = "default";
  FakeNotification.requestPermission.mockImplementation(async () => {
    FakeNotification.permission = "granted";
    return "granted";
  });
  api.boards.subscribe.mockResolvedValue(
    stream(move("review", "2026-11-05T10:00:00Z"), move("done", "2026-11-05T10:01:00Z")),
  );
  const stop = await mount();
  expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  expect(shown.map((item) => item.options.tag)).toEqual(["t1:review", "t1:done"]);
  await stop();
});

it("shows nothing when notifications were refused", async () => {
  FakeNotification.permission = "denied";
  api.boards.subscribe.mockResolvedValue(stream(move("review", "2026-11-05T10:00:00Z")));
  const stop = await mount();
  expect(shown).toEqual([]);
  expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  await stop();
});
