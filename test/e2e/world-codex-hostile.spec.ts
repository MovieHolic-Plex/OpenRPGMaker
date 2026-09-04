import { expect, test } from "@playwright/test";

test("codex tab shows item-concept cards, locks guard manual save, and card is keyboard operable", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  if (await page.getByTestId("db-tab-world-codex").isHidden()) {
    await page.getByTestId("db-tab-group-lore").click();
  }
  await page.getByTestId("db-tab-world-codex").click();
  await expect(page.getByTestId("db-world-codex-lead")).toBeVisible();

  await page.getByLabel("추가할 세계관 타입").selectOption("item");
  await page.getByTestId("world-add-entity").click();
  await page.getByTestId("world-edit-name").fill("설정집검증검");
  await page.getByTestId("world-edit-summary").fill("아이템 카드");
  await page.getByTestId("world-edit-save").click();
  const card = page.locator("[data-testid^='world-card-w_']").first();
  await expect(card).toBeVisible();

  await page.getByTestId("world-tab-item-concept").click();
  await expect(card).toBeVisible();
  await page.getByTestId("world-tab-character").click();
  await expect(page.locator(".world-card-grid.empty")).toBeVisible();

  await page.getByTestId("world-tab-item-concept").click();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("world-wiki-view")).toContainText("설정집검증검");

  await page.getByTestId("world-edit-toggle").click();
  await page.getByLabel("잠금").check();
  await page.getByTestId("world-edit-save").click();
  await expect(page.getByTestId("world-tab-item-concept")).toHaveClass(/active/);
  await expect(page.getByTestId("world-wiki-view")).toBeVisible();
  await page.getByTestId("world-edit-toggle").click();
  await page.getByTestId("world-edit-name").fill("무단 변경");
  await page.getByTestId("world-edit-save").click();
  await expect(page.getByTestId("world-edit-error")).toContainText("잠금");
});
