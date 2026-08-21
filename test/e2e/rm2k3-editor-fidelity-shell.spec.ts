import { expect, test } from "@playwright/test";

test("editor exposes RM2003-style chrome and bitmap chipset palette", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // RM2K3 chrome (classic toolbar, layer buttons, dense canvas controls) is expert-only.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/");

  await expect(page.getByTestId("rm2k3-menu-bar")).toBeVisible();
  await expect(page.getByTestId("menu-project")).toContainText("프로젝트");
  await expect(page.getByTestId("menu-map")).toContainText("맵");
  await expect(page.getByTestId("menu-tools")).toContainText("도구");
  await expect(page.getByTestId("menu-game")).toContainText("게임");
  await expect(page.getByTestId("menu-help")).toContainText("도움말");

  await expect(page.getByTestId("rm2k3-toolbar")).toBeVisible();
  await expect(page.getByTestId("toolbar-save")).toHaveAttribute("title", "프로젝트 저장 (Ctrl+S)");
  await expect(page.getByTestId("toolbar-database")).toHaveAttribute("title", "데이터베이스");
  await expect(page.getByTestId("toolbar-resource-manager")).toHaveAttribute("title", "소재 관리자");
  await expect(page.getByTestId("mode-play")).toHaveAttribute("title", "테스트 플레이");

  // Default edit surface is the event layer — switch to a tile layer so the chipset palette renders.
  await page.getByTestId("layer-lower").click();
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
  await expect(firstChipsetCell).toHaveCSS("background-image", /easyrpg-chipset-combined-town|rm2k3-original-chipset|chipset/);

  // Dense zoom buttons sit behind the ⋯ expand gate in expert mode, and the canvas
  // toolbar re-renders (collapses) on every zoom change — re-open the gate per click.
  await page.getByTestId("editor-canvas-toolbar-expand").click();
  await expect(page.getByTestId("editor-zoom-controls")).toBeVisible();
  await expect(page.getByTestId("editor-zoom-2")).toHaveClass(/active/);
  await page.getByTestId("editor-zoom-4").click();
  await expect(page.getByTestId("editor-zoom-4")).toHaveClass(/active/);
  await page.getByTestId("editor-canvas-toolbar-expand").click();
  await page.getByTestId("editor-zoom-2").click();
  await expect(page.getByTestId("editor-zoom-2")).toHaveClass(/active/);

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
