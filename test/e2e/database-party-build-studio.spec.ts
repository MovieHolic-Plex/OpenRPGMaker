import { expect, test } from "@playwright/test";

test("Party Studio previews an actor build and follows class backlinks in the same modal", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-actors").click();
  const modal = page.getByTestId("database-modal");
  await expect(modal).toBeVisible();
  await modal.evaluate((element) => { element.setAttribute("data-party-build-instance", "same"); });

  await expect(page.getByTestId("db-actor-build-preview")).toBeVisible();
  await page.getByTestId("db-actor-build-level").fill("20");
  await expect(page.getByTestId("db-actor-build-stat-attack")).not.toHaveText("");
  await expect(page.getByTestId("db-actor-build-growth-source")).toHaveAttribute("data-source", "actor-base");

  await page.getByTestId("db-actor-build-open-class").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("oprn:database.activeTab"))).toBe("classes");
  await expect(page.getByTestId("db-tab-classes")).toHaveClass(/active/);
  await expect(page.getByTestId("db-class-build-summary")).toBeVisible();
  await expect(modal).toHaveAttribute("data-party-build-instance", "same");

  await page.locator("[data-testid^='db-class-build-open-actor-']").first().click();
  await expect(page.getByTestId("db-tab-actors")).toHaveClass(/active/);
  await expect(page.getByTestId("db-actor-build-preview")).toBeVisible();
  await expect(modal).toHaveAttribute("data-party-build-instance", "same");
});
