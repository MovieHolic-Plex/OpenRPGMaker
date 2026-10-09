import { expect, test } from "@playwright/test";

test.use({ browserName: "firefox", launchOptions: {} });
test.setTimeout(180_000);

test("fresh editor stays usable without automatic guides", async ({ page }) => {
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tool-erase").click();
  await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "erase");

  await expect(page.locator(".coach-mark-card")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("oprn:standard-welcome-seen"))).toBeNull();

  await page.getByTestId("tool-paint").click();
  await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "paint");
  await expect(page.getByTestId("tool-paint")).toBeVisible();
});
