import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("bot settings open Avatar Studio on the Bot tab", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `avatar-studio-${stamp}@corvo.test`, "password12", "Avatar Studio");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await page.getByTestId("bot-settings-trigger").click();
  const settings = page.getByTestId("bot-settings");
  await expect(settings).toBeVisible();

  await settings.getByTestId("avatar-studio-trigger").click();
  const studio = page.getByTestId("avatar-studio");
  await expect(studio).toBeVisible();
  await expect(studio.getByText("Avatar Studio", { exact: true })).toBeVisible();
  await expect(studio.getByRole("tab", { name: "Bot", exact: true })).toBeVisible();
  await expect(studio.getByRole("tab", { name: "Upload", exact: true })).toBeVisible();
  await expect(studio.getByTestId("avatar-studio-bot-tab")).toBeVisible();

  const colors = studio.getByTestId("avatar-studio-colors");
  await expect(colors.getByRole("button")).toHaveCount(10);
  const yellow = studio.getByRole("button", { name: "Color #EAB308" });
  await yellow.click();
  await expect(yellow).toHaveAttribute("aria-pressed", "true");
  await expect(studio.locator('[data-mascot="yellow"]').first()).toBeVisible();

  const blue = studio.getByRole("button", { name: "Color #3B82F6" });
  await blue.click();
  await expect(blue).toHaveAttribute("aria-pressed", "true");
  await expect(yellow).toHaveAttribute("aria-pressed", "false");

  await studio.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(studio.locator("[data-mascot]").first()).toBeVisible();

  await captureScreenshot(page, testInfo, "avatar-studio-bot-tab");
});
