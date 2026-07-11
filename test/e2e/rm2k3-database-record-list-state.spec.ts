import { expect, test } from "@playwright/test";

test("RM2K3 database record list resets modal state and exposes decorative fillers", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();

  await page.getByTestId("db-tab-skills").click();
  const skillRows = page.locator('[data-testid^="db-record-row-"]');
  await expect(skillRows.nth(1)).toBeVisible();
  await skillRows.nth(1).click();
  await expect(skillRows.nth(1)).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await page.getByTestId("toolbar-database").click();
  await expect(page.locator('[data-testid^="db-record-row-"]').first()).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("db-tab-actors").click();
  const actorSearch = page.locator(".db-search input").first();
  await actorSearch.fill("Hero");
  await expect(actorSearch).toHaveValue("Hero");
  await page.getByTestId("db-tab-skills").click();
  await expect(page.locator(".db-search input").first()).toHaveValue("");

  await page.getByTestId("db-tab-classes").click();
  const fillerRows = page.locator(".db-list-row-visual-filler");
  await expect(fillerRows.first()).toBeVisible();
  await expect(page.locator('.db-list-row-visual-filler[data-testid^="db-record-row-"]')).toHaveCount(0);
  await expect(fillerRows.first()).toHaveAttribute("aria-hidden", "true");
  await expect(fillerRows.first()).toBeDisabled();
});
