import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

const OUT = "C:/Users/USER/Downloads/rpg-zzu/.omo/evidence/db-modern-overhaul/after";

test("spot-capture redesigned Database chrome", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.removeItem("oprn:db-dock-mode");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !location.search.includes("freshProject") || true);
  await page.waitForTimeout(1500);
  const dbButton = page.getByTestId("toolbar-database");
  await expect(dbButton).toBeVisible({ timeout: 15_000 });
  await dbButton.click();
  const modal = page.getByTestId("database-modal");
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  await modal.screenshot({ path: path.join(OUT, "actors.png") });
  for (const slug of ["items", "enemies", "switches"] as const) {
    const tab = page.getByTestId(`db-tab-${slug}`);
    if (await tab.count() === 0) continue;
    await tab.click({ force: true });
    await page.waitForTimeout(300);
    await modal.screenshot({ path: path.join(OUT, `${slug}.png`) });
  }
});
