import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

// The E2E server is not a desktop engine, so the linked-number transport is off there: the
// screen is exercised against stubbed routes, the way the voice spec models a catalog.
const NUMBER = {
  id: "inst-1",
  number: "+•••••••0100",
  botId: "bot-1",
  botName: "Chief",
  status: "active",
  paused: false,
  visitorConnectors: [] as string[],
};

test("the Store links a WhatsApp number by QR and lists it", async ({ page }, testInfo) => {
  let linked = false;
  await page.route("**/rpc/messaging/whatsapp/numbers/list", (route) =>
    route.fulfill({
      json: { json: { available: true, numbers: linked ? [NUMBER] : [] } },
    }),
  );
  await page.route("**/rpc/messaging/whatsapp/link/start", (route) =>
    route.fulfill({ json: { json: { linkId: "link-1" } } }),
  );
  await page.route("**/rpc/messaging/whatsapp/link/status", (route) =>
    route.fulfill({
      json: {
        json: linked
          ? { state: "linked", number: NUMBER.number }
          : { state: "qr", qr: "2@example-qr-for-a-screenshot,AAAA,BBBB,CCCC" },
      },
    }),
  );

  await signup(page, `whatsapp-${Date.now()}@corvo.test`, "password12", "WhatsApp");
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Store", exact: true }).click();

  const card = page.getByTestId("whatsapp-numbers");
  await expect(card.getByText("WhatsApp", { exact: true })).toBeVisible();
  await expect(card.getByText(/official API/)).toHaveCount(0);

  await card.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    card.getByText("This uses WhatsApp without the official API.", { exact: false }),
  ).toBeVisible();
  await expect(card.getByRole("img", { name: "QR code" })).toBeVisible();
  await captureScreenshot(page, testInfo, "whatsapp-link-qr");

  linked = true;
  await expect(card.getByText(NUMBER.number)).toBeVisible({ timeout: 10_000 });
  await expect(card.getByRole("img", { name: "QR code" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "whatsapp-number-linked");
});
