import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("a group opens as one lane per bot from its chat header", async ({ page }, testInfo) => {
  await signup(page, `squad-lanes-${Date.now()}@corvo.test`, "password12", "Squad Lanes");
  await completeOnboarding(page);
  const chiefId = activeBotId(page);
  const peer = await rpc<{ id: string }>(page, "bots/create", {
    name: "Design",
    title: "",
    description: "",
    notifyOnFinish: true,
  });
  const group = await rpc<{ id: string }>(page, "groups/create", {
    name: "Product",
    botIds: [chiefId, peer.id],
  });
  await rpc(page, "groups/update", { groupId: group.id, purpose: "Analisa concorrentes" });

  await page.goto(`/app/g/${group.id}`);
  await page.getByRole("button", { name: "Squad", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/g/${group.id}/squad$`));

  await expect(page.getByTestId(`squad-lane-${peer.id}`)).toBeVisible();
  await expect(page.getByTestId(`squad-lane-${chiefId}`)).toBeVisible();
  await expect(page.locator('[data-testid^="squad-lane-"]')).toHaveCount(2);
  await captureScreenshot(page, testInfo, "squad-lanes");

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/g/${group.id}$`));
});
