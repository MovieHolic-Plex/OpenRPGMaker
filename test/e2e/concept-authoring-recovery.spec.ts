import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("concept layout, zone, membership and seed painting remain editable", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    const button = page.getByTestId(id);
    if (await button.isVisible().catch(() => false)) await button.click();
  }
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  const tab = page.getByTestId("db-tab-scratch-concepts");
  if (!(await tab.isVisible())) await page.getByTestId("db-tab-group-world").click();
  await tab.click();
  await page.getByTestId("scratch-concept-tileset-select").selectOption("easyrpg_chipset_interior");
  const layout = page.getByTestId("scratch-concept-facility-layout");
  await layout.selectOption("double-row");
  await expect(layout).toHaveValue("double-row");
  await page.getByTestId("scratch-concept-place-zone-bedroom").selectOption("south");
  await expect(page.getByTestId("scratch-concept-place-zone-bedroom")).toHaveValue("south");
  const membership = page.getByTestId("scratch-concept-facility-place-bedroom");
  await membership.click();
  await expect(membership).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("scratch-concept-place-bedroom")).toHaveCount(0);
  await membership.click();
  await expect(membership).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("scratch-concept-place-zone-bedroom")).toHaveValue("south");
  await page.getByTestId("scratch-concept-thing-bed_h").click();
  await expect(page.getByTestId("scratch-concept-thing-paint")).toHaveText("사본 만들어 칠하기");
  mkdirSync("/tmp/rpg-zzu-concept-recovery-evidence", { recursive: true });
  await page.screenshot({ path: "/tmp/rpg-zzu-concept-recovery-evidence/concepts-1440.png", fullPage: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(layout).toBeVisible();
  await page.screenshot({ path: "/tmp/rpg-zzu-concept-recovery-evidence/concepts-1024.png", fullPage: true });
});
