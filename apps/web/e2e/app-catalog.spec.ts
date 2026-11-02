import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("the Integrations screen lists built-in apps that search and open", async ({
  page,
}, testInfo) => {
  await signup(page, `app-catalog-${Date.now()}@corvo.test`, "password12", "App Catalog");
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Store", exact: true }).click();
  const notion = page.getByTestId("app-tile-notion");
  await expect(notion).toBeVisible();
  await expect(notion.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "app-catalog-grid");

  await page.getByRole("textbox", { name: "Search apps", exact: true }).fill("linear");
  await expect(page.getByTestId("app-tile-linear")).toBeVisible();
  await expect(notion).toHaveCount(0);

  await page.getByTestId("app-tile-linear").getByText("Linear", { exact: true }).click();
  await expect(page.getByTestId("app-detail")).toBeVisible();
  await captureScreenshot(page, testInfo, "app-catalog-detail");

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("app-tile-linear")).toBeVisible();
});
