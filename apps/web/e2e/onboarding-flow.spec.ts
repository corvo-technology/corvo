import type { Bot } from "@corvo/contracts";
import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, rpc, signup, signupToOnboarding } from "./helpers";

const CHIEF_KEY = "onboarding:first";

test("a new user picks a template and lands in its chat, with the Chief made as always", async ({
  page,
}, testInfo) => {
  await signupToOnboarding(page, `flow-${Date.now()}@corvo.test`, "password12", "Flow");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Choose your first bot" })).toBeVisible();
  const first = page.locator("button[aria-pressed]").first();
  await first.click();
  await expect(page.getByRole("button", { name: "Create bot", exact: true })).toBeEnabled();
  await captureScreenshot(page, testInfo, "flow-template-chosen");
  await page.getByRole("button", { name: "Create bot", exact: true }).click();
  await page.waitForURL(/\/app\//, { timeout: 20_000 });

  const bots = await rpc<Bot[]>(page, "bots/list", {});
  const chosen = bots.find((bot) => bot.id === activeBotId(page));
  expect(chosen?.spawnKey).toMatch(/^agent-catalog:/);
  expect(bots.filter((bot) => bot.spawnKey === CHIEF_KEY)).toHaveLength(1);
});

test("renaming the workspace shows the new name in the sidebar", async ({ page }) => {
  await signupToOnboarding(page, `flow-name-${Date.now()}@corvo.test`, "password12", "Flow name");
  await page.getByRole("textbox", { name: "Name your workspace" }).fill("Alves Studio");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Alves Studio" })).toBeVisible();
});

test("the computer step is not offered on web", async ({ page }) => {
  await signupToOnboarding(page, `flow-computer-${Date.now()}@corvo.test`, "password12", "Flow");
  await page.goto("/onboarding/computer");
  await expect(page.getByRole("heading", { name: "Where should bots run?" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible();
});

test("reloading the first-bot step does not make a second Chief", async ({ page }) => {
  await signupToOnboarding(page, `flow-reload-${Date.now()}@corvo.test`, "password12", "Flow");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your first bot" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose your first bot" })).toBeVisible();
  await expect
    .poll(async () => {
      const bots = await rpc<Bot[]>(page, "bots/list", {});
      return bots.filter((bot) => bot.spawnKey === CHIEF_KEY).length;
    })
    .toBe(1);
});

test("an account that already has a bot goes straight to its chat from /onboarding", async ({
  page,
}) => {
  await signup(page, `flow-existing-${Date.now()}@corvo.test`, "password12", "Flow");
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
  await page.goto("/onboarding");
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Name your workspace" })).toHaveCount(0);
});
