import { expect, test } from "@playwright/test";

test("editor shell keeps RM2K3 workbench controls visible and mode switches cleanly", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("layer-selector")).toBeVisible();
  await expect(page.getByTestId("layer-lower")).toBeVisible();
  await expect(page.getByTestId("layer-upper")).toBeVisible();
  await expect(page.getByTestId("layer-event")).toBeVisible();
  await expect(page.getByTestId("tool-grid")).toBeVisible();
  await expect(page.getByTestId("tool-paint")).toBeVisible();
  await expect(page.getByTestId("tool-fill")).toBeVisible();
  await expect(page.getByTestId("tool-erase")).toBeVisible();
  await expect(page.getByTestId("tile-palette")).toBeVisible();
  await expect(page.getByTestId("map-tree")).toBeVisible();

  await page.getByTestId("right-tab-database").click();
  await page.getByTestId("right-tab-resources").click();
  await expect(page.getByTestId("resource-kind-select")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("editor-desktop.png"), fullPage: true });

  await page.click('[data-testid="mode-play"]');
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.click('[data-testid="title-new-game"]');
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await page.click('[data-testid="mode-edit"]');
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await page.click('[data-testid="mode-play"]');
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.click('[data-testid="title-new-game"]');
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await page.click('[data-testid="mode-edit"]');
  await expect(page.getByTestId("edit-canvas")).toBeVisible();

  for (let i = 0; i < 3; i++) {
    await page.click('[data-testid="mode-play"]');
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.click('[data-testid="title-new-game"]');
    await expect(page.getByTestId("play-canvas")).toBeVisible();
    await page.click('[data-testid="mode-edit"]');
    await expect(page.getByTestId("edit-canvas")).toBeVisible();
  }
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("tool-grid")).toHaveCount(1);
  await expect(page.getByTestId("tile-palette")).toHaveCount(1);
  await expect(page.getByTestId("map-tree")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("editor-mobile.png"), fullPage: true });
});
