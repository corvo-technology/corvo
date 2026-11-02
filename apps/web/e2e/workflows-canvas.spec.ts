import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

test("a workflow is a flow you can read: what starts it, each step, and how the last run went", async ({
  page,
}, testInfo) => {
  await signup(page, `workflows-canvas-${Date.now()}@corvo.test`, "password12", "Flow QA");
  await completeOnboarding(page, testInfo);
  await page.route("**/rpc/routines/workflows", (route) =>
    route.fulfill({
      json: {
        json: [
          {
            id: "routine-1",
            botId: "unknown-bot",
            name: "Morning summary",
            prompt: "Read last night's email and pick out what is urgent.",
            active: true,
            crons: ["0 9 * * *"],
            timezone: "UTC",
            webhookEnabled: false,
            githubEnabled: false,
            messageProvider: null,
            watch: null,
            nextRunAt: new Date(Date.now() + 20 * 60 * 60_000).toISOString(),
            lastRun: { state: "done", at: minutesAgo(40) },
            steps: [
              {
                id: "step-2",
                botId: "unknown-bot",
                position: 2,
                instruction: "Check which invoices fall due today.",
                lastRun: { state: "running", at: minutesAgo(1) },
              },
              {
                id: "step-3",
                botId: "unknown-bot",
                position: 3,
                instruction: "Write one note that sums it all up.",
                lastRun: null,
              },
            ],
          },
        ],
      },
    }),
  );
  await page.goto("/app/workflows");

  const flow = page.getByTestId("workflow");
  await expect(flow).toContainText("Morning summary");
  await expect(flow).toContainText("Trigger");
  await expect(flow).toContainText("Step 1");
  await expect(flow).toContainText("Step 3");
  await expect(flow).toContainText("Active");
  await expect(flow.getByRole("button", { name: "Run now" })).toBeVisible();
  await expect(page.getByTestId("flow-link").first()).toHaveAttribute("data-state", "done");
  await captureScreenshot(page, testInfo, "workflows-canvas");

  await flow.getByRole("button", { name: "Add a step here" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await captureScreenshot(page, testInfo, "workflows-canvas-add-step");
});
