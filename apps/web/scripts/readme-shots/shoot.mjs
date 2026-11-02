import { chromium } from "@playwright/test";
import {
  BOTS,
  calendar,
  GROUPS,
  ROUTINES,
  RUNS,
  SPACE_ID,
  SUBSCRIPTIONS,
  THREADS,
  usageOverview,
} from "./data.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const unknown = new Set();

const me = {
  ticketBoardEnabled: false,
  phoneCallsEnabled: false,
  navLinks: [],
  userId: "user-1",
  email: "alex@example.com",
  name: "Alex",
  spaceId: SPACE_ID,
  isDeploymentOwner: false,
  needsModel: false,
  defaultProvider: "anthropic",
  defaultModel: "claude-sonnet-5-5",
  hostCredentialProvider: null,
  hostCredentialSource: null,
  computerHost: null,
  canChooseHostComputer: false,
  sandboxProvider: "docker",
  mcpStdioEnabled: false,
  avatarStyle: "chick",
  billingEnabled: false,
};

const space = {
  id: SPACE_ID,
  name: "Acme",
  isDefault: true,
  hasContent: true,
  canRename: true,
  canDelete: false,
  bots: BOTS.map((b) => ({ id: b.id, name: b.name })),
  groups: GROUPS.map((g) => ({ id: g.id, name: g.name })),
  externalConversations: [],
  botSections: [],
};

const computer = (i) => ({
  botId: i?.botId ?? "fabio",
  mode: "private",
  kind: "docker",
  state: "running",
  controlHolder: "bot",
  controlBotId: i?.botId ?? "fabio",
  takeoverRequested: false,
  screenAvailable: true,
  screenWidth: 1280,
  screenHeight: 800,
  homeRevision: null,
  busyBotName: null,
  canUpdate: true,
  terminalAvailable: true,
});

const target = (i) => (i?.groupId ? `g:${i.groupId}` : `b:${i?.botId}`);
const snapshot = (i) => {
  const messages = THREADS[target(i)] ?? [];
  const g = GROUPS.find((x) => x.id === i?.groupId);
  return {
    threadId: g ? g.threadId : `thread-${i?.botId}`,
    cursor: messages.length - 1,
    messages,
    olderCursor: null,
    run: RUNS[target(i)] ?? null,
    activeRuns: RUNS[target(i)] ? [RUNS[target(i)]] : [],
    ...(g
      ? { groupId: g.id, groupName: g.name, members: g.members }
      : { botId: i?.botId, computer: computer(i) }),
  };
};

const handlers = {
  "computer/status": computer,
  "computer/boot": computer,
  "computer/screenUrl": () => ({ url: "/novnc/screen.html" }),
  "computer/heartbeat": () => ({ ok: true }),
  "threads/get": snapshot,
  "threads/head": (i) => {
    const t = snapshot(i);
    return { threadId: t.threadId, cursor: t.cursor };
  },
  "threads/markRead": () => ({}),
  "threads/context": () => ({ usedTokens: 18000, windowTokens: 200000 }),
  "routines/list": () => ROUTINES,
  "routines/calendar": calendar,
  "usage/overview": usageOverview,
  "usage/subscriptions": () => SUBSCRIPTIONS,
  "spaces/list": () => ({ spaces: [space] }),
  me: () => me,
  bootstrap: () => ({
    me,
    bots: BOTS,
    groups: GROUPS,
    botSections: [],
    archivedBots: [],
    archivedGroups: [],
    thread: {
      threadId: "thread-support",
      cursor: 6,
      messages: THREADS["g:support"],
      olderCursor: null,
      groupId: "support",
      groupName: "support",
      members: GROUPS[0].members,
      run: null,
    },
    routines: ROUTINES,
    spaces: [space],
  }),
};

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  locale: "en-US",
});
await context.addInitScript(() => localStorage.setItem("corvo.showToolActivity", "on"));
const page = await context.newPage();

await page.route("**/api/auth/capabilities", (r) =>
  r.fulfill({ json: { passwordAuth: true, sso: null, passwordReset: false, resetUrl: null } }),
);
await page.route("**/api/auth/get-session**", (r) =>
  r.fulfill({
    json: {
      session: {
        id: "s1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 864e5).toISOString(),
      },
      user: { id: "user-1", name: "Alex", email: "alex@example.com", emailVerified: true },
    },
  }),
);
await page.route("**/novnc/screen.html", (r) =>
  r.fulfill({ path: new URL("./screen.html", import.meta.url).pathname, contentType: "text/html" }),
);
await page.route("**/rpc/**", async (route) => {
  const name = new URL(route.request().url()).pathname.replace(/^\/rpc\//, "");
  const h = handlers[name];
  if (!h) {
    unknown.add(name);
    if (process.env.LOG_ALL || name.startsWith("threads/"))
      console.log(name, JSON.stringify(route.request().postDataJSON()?.json));
    return route.fulfill({ json: { json: null } });
  }
  return route.fulfill({ json: { json: h(route.request().postDataJSON()?.json) } });
});
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 160)));

const scene = process.env.SCENE ?? "/app/g/support";
const clickText = process.env.CLICK_TEXT;
await page.goto(`${BASE}${scene.startsWith("click:") ? "/app" : scene}`);
await page.waitForTimeout(3000);
if (scene.startsWith("click:")) {
  for (const label of scene.slice(6).split("|")) {
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await page.waitForTimeout(2000);
  }
}
if (clickText) {
  for (const t of clickText.split("|")) {
    await page.getByText(t, { exact: true }).first().click();
    await page.waitForTimeout(2000);
  }
}
if (process.env.MONITOR) {
  await page
    .locator("header button, button")
    .filter({ has: page.locator("svg.lucide-monitor") })
    .first()
    .click();
  await page.waitForTimeout(2500);
}
const clip = process.env.CLIP
  ? Object.fromEntries(
      process.env.CLIP.split(",").map((v, i) => [["x", "y", "width", "height"][i], Number(v)]),
    )
  : undefined;
await page.screenshot({ path: process.env.OUT ?? "/tmp/shot.png", clip });
console.log("unknown rpc:", [...unknown].join(", "));
await browser.close();
