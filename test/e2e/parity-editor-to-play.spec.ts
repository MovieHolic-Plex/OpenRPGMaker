import { expect, test } from "@playwright/test";

test("editor database edit persists into the project the player runs", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-skills").click();

  const selectSkillAttack = async (): Promise<void> => {
    const search = page.locator(".db-search input").first();
    await search.fill("skill_attack");
    await page.locator('[data-testid^="db-record-row-"]').first().click();
  };

  await selectSkillAttack();
  const power = page.getByTestId("db-field-power");
  await power.fill("123");
  await expect(power).toHaveValue("123");

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-tab-skills").click();
  await selectSkillAttack();
  await expect(page.getByTestId("db-field-power")).toHaveValue("123");
});
