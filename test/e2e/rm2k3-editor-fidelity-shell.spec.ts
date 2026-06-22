import { expect, test } from "@playwright/test";

test("editor exposes RM2003-style chrome and bitmap chipset palette", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("rm2k3-menu-bar")).toBeVisible();
  await expect(page.getByTestId("menu-project")).toContainText("프로젝트");
  await expect(page.getByTestId("menu-map")).toContainText("맵");
  await expect(page.getByTestId("menu-tools")).toContainText("도구");
  await expect(page.getByTestId("menu-game")).toContainText("게임");
  await expect(page.getByTestId("menu-help")).toContainText("도움말");

  await expect(page.getByTestId("rm2k3-toolbar")).toBeVisible();
  await expect(page.getByTestId("toolbar-save")).toHaveAttribute("title", "프로젝트 저장");
  await expect(page.getByTestId("toolbar-database")).toHaveAttribute("title", "데이터베이스");
  await expect(page.getByTestId("toolbar-resource-manager")).toHaveAttribute("title", "소재 관리자");
  await expect(page.getByTestId("mode-play")).toHaveAttribute("title", "테스트 플레이");

  await expect(page.getByTestId("chipset-sheet")).toBeVisible();
  const chipsetImage = page.getByTestId("chipset-sheet-image");
  await expect(chipsetImage).toHaveCount(0);
  const chipsetTileCount = await page.locator("[data-testid^='chipset-tile-']").count();
  expect(chipsetTileCount).toBeGreaterThan(0);
  const firstChipsetTestId = await page.getByTestId("chipset-sheet").evaluate((node) => {
    const cell = node.querySelector("[data-testid^='chipset-tile-']");
    return cell instanceof HTMLElement ? cell.dataset.testid ?? "" : "";
  });
  expect(firstChipsetTestId).toContain("chipset-tile-");
  const firstChipsetCell = page.getByTestId(firstChipsetTestId);
  await expect(firstChipsetCell).toHaveCSS("width", "32px");
  await expect(firstChipsetCell).toHaveCSS("height", "32px");
  await expect(firstChipsetCell).toHaveCSS("background-image", /rm2k3-original-chipset/);

  await expect(page.getByTestId("editor-zoom-controls")).toBeVisible();
  await expect(page.getByTestId("editor-zoom-2")).toHaveClass(/active/);
  await page.getByTestId("editor-zoom-4").click();
  await expect(page.getByTestId("editor-zoom-4")).toHaveClass(/active/);
  await page.getByTestId("editor-zoom-2").click();
  await expect(page.getByTestId("editor-zoom-2")).toHaveClass(/active/);

  await expect(page.getByTestId("tile-palette")).toBeVisible();
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("#0 호수 외곽");
  await page.getByTestId("chipset-band-a2").click();
  await page.getByTestId("chipset-tile-360").click();
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("#360 흙길 중심");
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("하층 / 통행 가능 / 지형 0");
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("매핑 확정");

  await page.getByTestId("layer-lower").click();
  await page.getByTestId("chipset-band-a3").click();
  await expect(page.getByTestId("chipset-tile-132")).toBeEnabled();
  await page.getByTestId("chipset-tile-132").click();
  await expect(page.getByTestId("layer-lower")).toHaveClass(/active/);
  await expect(page.getByTestId("selected-tile-status")).toContainText("132 나무 집벽 중단");
  await expect(page.getByTestId("tile-mapping-inspector")).toContainText("상층 / 통행 불가");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("rm2003-editor-fidelity.png"), fullPage: true });
});
