import { expect, test } from "@playwright/test";

test.use({ browserName: "firefox", launchOptions: {} });
test.setTimeout(180_000);

for (const mode of ["beginner", "standard"] as const) {
  test(`fresh ${mode} editor stays usable without automatic guides`, async ({ page }) => {
    await page.addInitScript((mode) => {
      localStorage.setItem("oprn:editor-ui-mode", mode);
    }, mode);
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 120_000 });
    await page.getByTestId("tool-erase").click();
    await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "erase");

    await expect(page.locator(".coach-mark-card")).toHaveCount(0);
    expect(await page.evaluate(() => ({
      coach: localStorage.getItem("oprn:coachmarks-basic-v1"),
      standard: localStorage.getItem("oprn:standard-welcome-seen"),
    }))).toEqual({ coach: null, standard: null });

    await page.getByTestId("tool-paint").click();
    await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "paint");
    await page.getByTestId("workspace-panels-button").click();
    await page.getByTestId(`workspace-ui-mode-${mode === "beginner" ? "standard" : "beginner"}`).click();
    await expect(page.getByTestId("tool-paint")).toBeVisible();
    await expect(page.locator(".coach-mark-card")).toHaveCount(0);
  });
}
