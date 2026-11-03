import { expect, test } from "@playwright/test";
import { showIndividualTiles } from "./showIndividualTiles";
import { clickMoreMenuItem } from "./topbarNavigation";

// 왼쪽 열의 그리기 도구·붓 옵션·선택 타일은 접힌 「붓 설정」 안에 있다(2026-11-03) — 이 스펙은 그걸 직접 누르므로 펴 두고 시작한다.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:brush-settings-open", "1"));
});


test("editor exposes RM2003-style chrome and bitmap chipset palette", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // RM2K3 chrome (classic toolbar, layer buttons, dense canvas controls) is expert-only.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/");

  // 2026-09-03 스튜디오 바: 프로젝트 메뉴의 얼굴은 프로젝트 이름, 맵·게임 메뉴와 클래식 툴바 행은 없다.
  // 2026-11 톱바 개편: 세계관·음악·찾기는 ⌘K 명령으로만 닿고, 도움말은 ⋯ 더 보기 안의 하위 메뉴다.
  await expect(page.getByTestId("oprn-menu-bar")).toBeVisible();
  await expect(page.getByTestId("menu-project")).toBeVisible();
  await expect(page.getByTestId("menu-project")).toHaveAttribute("title", /^프로젝트 메뉴 — /);
  await clickMoreMenuItem(page, "menu-help");
  await expect(page.getByTestId("menu-popup-help")).toBeVisible();
  await page.keyboard.press("Escape");
  for (const gone of ["menu-map", "menu-game", "menu-tools", "oprn-toolbar", "authoring-task-launcher"]) {
    await expect(page.getByTestId(gone)).toHaveCount(0);
  }
  for (const moved of ["toolbar-world", "toolbar-sound-test", "toolbar-search"]) {
    await expect(page.getByTestId(moved)).toHaveCount(0);
  }

  await expect(page.getByTestId("toolbar-save")).toHaveAttribute("title", "프로젝트 저장 (Ctrl+S)");
  // 2026-08-30 헤더 용어 통일: title 은 언제나 uiCopy 정본이다(expert = technical 스타일).
  // 구 기대값 "자료 보관함"·"시연 실행" 은 하드코딩된 폐기 문구였다.
  await expect(page.getByTestId("toolbar-database")).toHaveAttribute("title", "데이터베이스");
  await expect(page.getByTestId("toolbar-resource-manager")).toHaveAttribute("title", "리소스 보관함");
  await expect(page.getByTestId("mode-play")).toHaveAttribute("title", "테스트 실행");

  // Default edit surface is the event layer — switch to a tile layer so the chipset palette renders.
  await page.getByTestId("layer-lower").click();
  await showIndividualTiles(page);
  // The RM2K palette sheet is data-testid="tile-palette" (band UI was removed from the product).
  await expect(page.getByTestId("tile-palette")).toBeVisible();
  const chipsetImage = page.locator("[data-testid='tile-palette'] img");
  await expect(chipsetImage).toHaveCount(0);
  const chipsetTileCount = await page.locator("[data-testid^='chipset-tile-']").count();
  expect(chipsetTileCount).toBeGreaterThan(0);
  const firstChipsetTestId = await page.getByTestId("tile-palette").evaluate((node) => {
    const cell = node.querySelector("[data-testid^='chipset-tile-']");
    return cell instanceof HTMLElement ? cell.dataset.testid ?? "" : "";
  });
  expect(firstChipsetTestId).toContain("chipset-tile-");
  const firstChipsetCell = page.getByTestId(firstChipsetTestId);
  // 셀은 RM2K3 칩셋 팰릿의 비트맵 셀 — 정사각형이며 충분한 크기.
  const cellWidth = await firstChipsetCell.evaluate((n) => parseFloat(getComputedStyle(n).width));
  const cellHeight = await firstChipsetCell.evaluate((n) => parseFloat(getComputedStyle(n).height));
  expect(cellWidth).toBeGreaterThan(20);
  expect(Math.abs(cellWidth - cellHeight)).toBeLessThanOrEqual(1);
  await expect(firstChipsetCell).toHaveCSS("background-image", /easyrpg-chipset-combined-town|oprn-original-chipset|chipset/);

  // 배율 목록은 캔버스 알약의 「200%」 단추 아래에 뜨고, 고르면 닫힌다(2026-11) — 고를 때마다 다시 연다.
  await expect(page.getByTestId("editor-zoom-controls")).toBeVisible();
  await expect(page.getByTestId("editor-zoom-stepper")).toHaveText("200%");
  await page.getByTestId("editor-zoom-stepper").click();
  await expect(page.getByTestId("editor-zoom-2")).toHaveClass(/active/);
  await page.getByTestId("editor-zoom-4").click();
  await expect(page.getByTestId("editor-zoom-stepper")).toHaveText("400%");
  await page.getByTestId("editor-zoom-stepper").click();
  await expect(page.getByTestId("editor-zoom-4")).toHaveClass(/active/);
  await page.getByTestId("editor-zoom-2").click();
  await expect(page.getByTestId("editor-zoom-stepper")).toHaveText("200%");

  await expect(page.getByTestId("tile-palette")).toBeVisible();
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("#0 호수 외곽");
  // The RM2K palette lists every tile directly — band filters were removed from the product.
  await page.getByTestId("chipset-tile-360").click();
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("#360 흙길 중심");
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("하층 / 통행 가능 / 지형 0");
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("매핑 확정");

  await page.getByTestId("layer-lower").click();
  await expect(page.getByTestId("chipset-tile-132")).toBeEnabled();
  await page.getByTestId("chipset-tile-132").click();
  await expect(page.getByTestId("layer-lower")).toHaveClass(/active/);
  await expect(page.getByTestId("selected-tile-status")).toContainText("132 나무 집벽 중단");
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("하층 / 통행 불가");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("rm2003-editor-fidelity.png"), fullPage: true });
});
