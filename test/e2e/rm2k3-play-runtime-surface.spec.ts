import { expect, test } from "@playwright/test";

test("test play opens as a modal with a centered integer-scale 320x240 runtime", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?logCabinShowcase=1");

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible();

  const surface = await page.evaluate(() => {
    const viewport = document.querySelector("[data-testid='play-viewport']");
    const stage = document.querySelector("[data-testid='play-stage']");
    const canvas = document.querySelector("[data-testid='play-canvas'] canvas");
    if (!(viewport instanceof HTMLElement)) throw new Error("missing play viewport");
    if (!(stage instanceof HTMLElement)) throw new Error("missing play stage");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("missing play canvas");
    const viewportRect = viewport.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      logicalWidth: canvas.width,
      logicalHeight: canvas.height,
      visualWidth: Math.round(canvasRect.width),
      visualHeight: Math.round(canvasRect.height),
      viewportCenterX: Math.round(viewportRect.left + viewportRect.width / 2),
      viewportCenterY: Math.round(viewportRect.top + viewportRect.height / 2),
      stageCenterX: Math.round(stageRect.left + stageRect.width / 2),
      stageCenterY: Math.round(stageRect.top + stageRect.height / 2),
      scale: viewport.dataset.scale ?? "",
      modalWidth: Math.round((document.querySelector("[data-testid='test-play-window']") as HTMLElement).getBoundingClientRect().width),
      modalHeight: Math.round((document.querySelector("[data-testid='test-play-window']") as HTMLElement).getBoundingClientRect().height),
    };
  });

  await testInfo.attach("play-surface-scale.json", {
    body: `${JSON.stringify(surface, null, 2)}\n`,
    contentType: "application/json",
  });

  expect(surface.logicalWidth).toBe(320);
  expect(surface.logicalHeight).toBe(240);
  expect(surface.visualWidth).toBeGreaterThan(320);
  expect(surface.visualWidth % 320).toBe(0);
  expect(surface.visualHeight % 240).toBe(0);
  expect(surface.stageCenterX).toBe(surface.viewportCenterX);
  expect(surface.stageCenterY).toBe(surface.viewportCenterY);
  await page.screenshot({ path: testInfo.outputPath("play-runtime-centered.png"), fullPage: true });
  await page.getByTestId("mode-edit").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});
