import { expect, test } from "@playwright/test";

test("test play opens as a modal with a runtime surface that fills the play window", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?logCabinShowcase=1");

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();

  const titleSurface = await page.evaluate(() => {
    const body = document.querySelector("[data-testid='test-play-window-body']");
    const title = document.querySelector("[data-testid='title-screen']");
    if (!(body instanceof HTMLElement)) throw new Error("missing test play body");
    if (!(title instanceof HTMLElement)) throw new Error("missing title screen");
    const bodyRect = body.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    return {
      bodyHeight: bodyRect.height,
      bodyLeft: bodyRect.left,
      bodyTop: bodyRect.top,
      bodyWidth: bodyRect.width,
      titleHeight: titleRect.height,
      titleLeft: titleRect.left,
      titleTop: titleRect.top,
      titleWidth: titleRect.width,
    };
  });

  expect(Math.abs(titleSurface.titleWidth - titleSurface.bodyWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(titleSurface.titleHeight - titleSurface.bodyHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(titleSurface.titleLeft - titleSurface.bodyLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(titleSurface.titleTop - titleSurface.bodyTop)).toBeLessThanOrEqual(2);

  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("main-menu-button")).toHaveCount(0);

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
      canvasHeight: canvasRect.height,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
      canvasWidth: canvasRect.width,
      stageHeight: stageRect.height,
      stageLeft: stageRect.left,
      stageTop: stageRect.top,
      stageWidth: stageRect.width,
      viewportHeight: viewportRect.height,
      viewportLeft: viewportRect.left,
      viewportTop: viewportRect.top,
      viewportWidth: viewportRect.width,
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
  expect(Math.abs(surface.stageWidth - surface.viewportWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.stageHeight - surface.viewportHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.stageLeft - surface.viewportLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.stageTop - surface.viewportTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.canvasWidth - surface.viewportWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.canvasHeight - surface.viewportHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.canvasLeft - surface.viewportLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.canvasTop - surface.viewportTop)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("play-runtime-filled.png"), fullPage: true });
  await page.getByTestId("mode-edit").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});

test("test play exposes the runtime menu through X without an on-screen menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?logCabinShowcase=1");

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible();

  await expect(page.getByTestId("main-menu-button")).toHaveCount(0);
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
});
