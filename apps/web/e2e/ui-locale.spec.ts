import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, signup } from "./helpers";

test("account settings language picker offers the seven shipped languages", async ({
  page,
}, testInfo) => {
  await signup(page, `ui-locale-picker-${Date.now()}@corvo.test`, "password12", "Locale QA");
  await completeOnboarding(page, testInfo);
  const settings = await openUserSettings(page);

  await settings.getByTestId("ui-locale-select").click();
  await expect(page.getByRole("option")).toHaveText([
    "English",
    "Deutsch",
    "Português (Brasil)",
    "简体中文",
    "Español",
    "Français",
    "日本語",
  ]);
  await captureScreenshot(page, testInfo, "ui-locale-picker");
});

test("Portuguese can be selected, survives reload, and switches back to English", async ({
  page,
}, testInfo) => {
  await signup(page, `ui-locale-pt-${Date.now()}@corvo.test`, "password12", "Locale QA");
  await completeOnboarding(page, testInfo);
  const settings = await openUserSettings(page);
  const picker = settings.getByTestId("ui-locale-select");
  await picker.click();
  await page.getByRole("option", { name: "Português (Brasil)", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "Geral", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Conta", exact: true })).toBeVisible();
  await expect(settings.getByText("Idioma", { exact: true })).toBeVisible();
  await expect(picker).toHaveText("Português (Brasil)");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await captureScreenshot(page, testInfo, "ui-locale-settings-pt-br");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByTestId("ui-locale-select")).toHaveText("Português (Brasil)");
  await page.getByTestId("ui-locale-select").click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "General", exact: true })).toBeVisible();
});

test("Spanish can be selected from the language picker", async ({ page }, testInfo) => {
  await signup(page, `ui-locale-es-${Date.now()}@corvo.test`, "password12", "Locale QA");
  await completeOnboarding(page, testInfo);
  const settings = await openUserSettings(page);
  const picker = settings.getByTestId("ui-locale-select");
  await picker.click();
  await page.getByRole("option", { name: "Español", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "Cuenta", exact: true })).toBeVisible();
  await expect(picker).toHaveText("Español");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});
