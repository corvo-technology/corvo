import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./helpers";

test.use({ viewport: { width: 1100, height: 400 } });

for (const theme of ["light", "dark"]) {
  test(`a channel shows who is working, in the sidebar and in its header (${theme})`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/e2e/fixtures/presence.html?theme=${theme}`);
    const rows = page.getByTestId("channel-row");
    await expect(rows).toHaveCount(4);

    await expect(rows.nth(0).getByTestId("channel-presence")).toHaveCount(0);
    await expect(rows.nth(1).getByRole("img", { name: "Leo: Working…" })).toBeVisible();
    await expect(rows.nth(2).getByRole("img", { name: "Nina, Theo: Working…" })).toBeVisible();
    await expect(rows.nth(3).getByTestId("channel-presence")).toContainText("+2");

    const working = page.getByTestId("channel-working");
    await expect(working).toHaveCount(2);
    await expect(working.nth(0)).toHaveText("Leo · Working…");
    await expect(working.nth(1)).toHaveText("Leo +2 · Working…");
    await captureScreenshot(page, testInfo, `channel-presence-${theme}`);
  });
}
