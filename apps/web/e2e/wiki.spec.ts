import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./helpers";

test.use({ viewport: { width: 1300, height: 820 } });
const url = (theme: string, extra = "") =>
  `/e2e/fixtures/wiki.html?theme=${theme}&locale=en${extra}`;

for (const theme of ["light", "dark"]) {
  test(`the Wiki shows the pages by kind and a page with its links (${theme})`, async ({
    page,
  }, testInfo) => {
    await page.goto(url(theme, "&page=Alpha%20Builders"));

    // The pages are grouped by kind, each with the sentence that sums it up.
    await expect(page.getByTestId("wiki-kind-Person")).toContainText("Marina Costa");
    await expect(page.getByTestId("wiki-kind-Decision")).toContainText("Safety Audit");
    await expect(page.getByTestId("wiki-page-Alpha Builders")).toContainText(
      "A construction company",
    );

    // The open page: its text without front matter, links to pages that exist as buttons.
    await expect(page.getByTestId("wiki-title")).toHaveText("Alpha Builders");
    const body = page.getByTestId("wiki-body");
    await expect(body).toContainText("approves every quote");
    await expect(body).not.toContainText("type: Client");
    await expect(body.getByRole("button", { name: "Marina Costa" })).toBeVisible();

    // Which pages cite this one is shown beside what it cites.
    await expect(page.getByRole("navigation", { name: "Cited by" })).toContainText("Marina Costa");
    await captureScreenshot(page, testInfo, `wiki-${theme}`);

    // A link opens the page it names.
    await body.getByRole("button", { name: "Office Renovation" }).click();
    await expect(page.getByTestId("wiki-title")).toHaveText("Office Renovation");
  });
}

test("a person fixes a page, looks back at it and restores an earlier revision", async ({
  page,
}, testInfo) => {
  await page.goto(url("light", "&page=Weekly%20Report"));
  await page.getByRole("button", { name: "Page options" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const text = page.getByRole("textbox", { name: "Page text" });
  await text.fill("Every Thursday the team writes one page.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("Every Thursday");

  await page.getByRole("button", { name: "Page options" }).click();
  await page.getByRole("menuitem", { name: "History" }).click();
  await expect(page.getByTestId("wiki-history").getByRole("listitem")).toHaveCount(2);
  await captureScreenshot(page, testInfo, "wiki-history");
  await page.getByTestId("wiki-history").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("restored from revision 1");
});

test("searching the text of the pages replaces the kinds with the matches", async ({ page }) => {
  await page.goto(url("light"));
  await page.getByRole("textbox", { name: "Search" }).fill("quote");
  const hits = page.getByTestId("wiki-hits");
  await expect(hits).toContainText("Alpha Builders");
  await expect(hits).toContainText("Office Renovation");
  await expect(hits).not.toContainText("Weekly Report");
});

test("on a phone the list and the page take turns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(url("dark"));
  await expect(page.getByTestId("wiki-page-Marina Costa")).toBeVisible();
  await expect(page.getByTestId("wiki-title")).toHaveCount(0);
  await page.getByTestId("wiki-page-Marina Costa").click();
  await expect(page.getByTestId("wiki-title")).toHaveText("Marina Costa");
  await expect(page.getByTestId("wiki-page-Marina Costa")).toBeHidden();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByTestId("wiki-page-Marina Costa")).toBeVisible();
});
