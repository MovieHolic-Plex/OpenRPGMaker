import { expect, test } from "@playwright/test";

test("RM2K3 database record list resets modal state and has no decorative fillers", async ({ page }) => {
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

  // 가짜 직업 채움 행("마검사"/"기사"/... 비활성 장식 행)은 fix(db)에서 제거됐다 — 목록은
  // 실제 레코드 개수만큼만 렌더된다.
  await page.getByTestId("db-tab-classes").click();
  await expect(page.locator(".db-list-row-visual-filler")).toHaveCount(0);
  const classRows = page.locator('[data-testid^="db-record-row-"]');
  await expect(classRows.first()).toBeVisible();

  // 직업 탭 검색도 다른 탭과 동일하게 실동작한다(과거엔 무조건 무시됐다).
  const classSearch = page.locator(".db-search input").first();
  const classRowCountBefore = await classRows.count();
  await classSearch.fill("존재하지않는직업검색어zzz");
  await expect(page.locator('[data-testid^="db-record-row-"]')).toHaveCount(0);
  await classSearch.fill("");
  await expect(page.locator('[data-testid^="db-record-row-"]')).toHaveCount(classRowCountBefore);
});
