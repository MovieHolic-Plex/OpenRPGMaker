import { expect, test } from "@playwright/test";

test("database modal does not render external manual source chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();

  await expect(page.locator(".database-modal-body .db-manual-source")).toHaveCount(0);
  await expect(page.getByText("RM2003 manual")).toHaveCount(0);
  await expect(page.getByText("https://haylee.garden/rpg2003/dactors.htm")).toHaveCount(0);
});
