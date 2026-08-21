import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // 클래식 툴바(도움말 버튼 포함)는 전문가 모드에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("help button opens a wiki-style editor guide", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-help").click();

  const modal = page.getByTestId("help-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading", { name: "에디터 가이드" })).toBeVisible();
  // 목차와 주요 섹션이 모두 렌더링된다.
  await expect(page.getByTestId("help-modal-nav")).toBeVisible();
  for (const section of ["overview", "layout", "map", "event", "database", "resource", "play", "save", "shortcuts"]) {
    await expect(page.getByTestId(`help-modal-section-${section}`)).toBeAttached();
  }
  // 개요 섹션 본문이 보인다.
  await expect(modal.getByText("브라우저에서 돌아가는 탑다운 타일 JRPG 제작 도구입니다.")).toBeVisible();
  // 섹션 스크린샷이 렌더링된다.
  const overviewImg = modal.locator("img.help-modal-figure-img").first();
  await expect(overviewImg).toBeVisible();
  await expect(overviewImg).toHaveAttribute("src", "/assets/help/overview.png");
  // 단축키 섹션에 kbd 키 캡이 렌더링된다.
  await expect(modal.locator("kbd.help-modal-key").first()).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath("help-modal.png"), fullPage: true });

  // 목차를 누르면 해당 섹션으로 스크롤된다.
  await page.getByTestId("help-modal-nav-database").click();
  await page.waitForTimeout(450);
  const dbSection = page.getByTestId("help-modal-section-database");
  await expect(dbSection).toBeInViewport();

  // Esc로 닫힌다.
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();

  // 다시 열고 닫기 버튼으로도 닫힌다.
  await page.getByTestId("toolbar-help").click();
  await expect(modal).toBeVisible();
  await page.getByTestId("help-modal-dismiss").click();
  await expect(modal).toBeHidden();
});

test("help menu item opens the same modal", async ({ page }) => {
  await page.goto("/?freshProject=1");

  await page.getByTestId("menu-help").click();
  await page.getByTestId("menu-help-shortcuts").click();

  await expect(page.getByTestId("help-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help-modal")).toBeHidden();
});
