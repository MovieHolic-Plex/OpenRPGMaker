import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function gotoShowcaseEditor(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`/?devProject=1&logCabinShowcase=1&surfaceSpec=${Date.now()}-${attempt}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(500);
    }
  }
}

test("test play opens windowed and toggles fullscreen with Alt+Enter", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoShowcaseEditor(page);

  await expect(page.getByTestId("mode-play")).toBeVisible();
  await page.getByTestId("mode-play").click();
  const testWindow = page.getByTestId("test-play-window");
  await expect(testWindow).toBeVisible();
  await expect(testWindow).toHaveAttribute("data-window-mode", "windowed");
  await expect.poll(async () => {
    const box = await testWindow.boundingBox();
    return box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
  }).toEqual({ width: 642, height: 512 });
  const windowedBounds = await testWindow.boundingBox();
  if (!windowedBounds) throw new Error("missing windowed test play bounds");
  expect(Math.abs((windowedBounds.x + windowedBounds.width / 2) - 1280 / 2)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Alt+Enter");
  await expect(testWindow).toHaveAttribute("data-window-mode", "fullscreen");
  await page.waitForTimeout(350);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await expect(page.getByTestId("play-canvas")).toHaveCount(0);

  const titleSurface = await page.evaluate(() => {
    const body = document.querySelector("[data-testid='test-play-window-body']");
    const title = document.querySelector("[data-testid='title-screen']");
    const titleText = document.querySelector(".rm-title-screen-title");
    const menu = document.querySelector(".rm-title-menu");
    const hint = document.querySelector("[data-testid='title-input-hint']");
    if (!(body instanceof HTMLElement)) throw new Error("missing test play body");
    if (!(title instanceof HTMLElement)) throw new Error("missing title screen");
    if (!(titleText instanceof HTMLElement)) throw new Error("missing title text");
    if (!(menu instanceof HTMLElement)) throw new Error("missing title menu");
    if (!(hint instanceof HTMLElement)) throw new Error("missing title input hint");
    const bodyRect = body.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const titleTextRect = titleText.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const hintRect = hint.getBoundingClientRect();
    return {
      bodyHeight: bodyRect.height,
      bodyLeft: bodyRect.left,
      bodyTop: bodyRect.top,
      bodyWidth: bodyRect.width,
      hintBottom: hintRect.bottom,
      hintTop: hintRect.top,
      menuBottom: menuRect.bottom,
      menuTop: menuRect.top,
      titleTextBottom: titleTextRect.bottom,
      titleTextTop: titleTextRect.top,
      titleHeight: titleRect.height,
      titleLeft: titleRect.left,
      titleTop: titleRect.top,
      titleWidth: titleRect.width,
    };
  });

  expect(Math.round(titleSurface.bodyWidth)).toBe(1280);
  expect(Math.round(titleSurface.bodyHeight)).toBe(900);
  expect(Math.round(titleSurface.titleWidth)).toBe(960);
  expect(Math.round(titleSurface.titleHeight)).toBe(720);
  expect(Math.abs(titleSurface.titleWidth / titleSurface.titleHeight - 4 / 3)).toBeLessThanOrEqual(0.02);
  expect(Math.abs((titleSurface.titleLeft + titleSurface.titleWidth / 2) - (titleSurface.bodyLeft + titleSurface.bodyWidth / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs((titleSurface.titleTop + titleSurface.titleHeight / 2) - (titleSurface.bodyTop + titleSurface.bodyHeight / 2))).toBeLessThanOrEqual(2);
  expect(titleSurface.titleTop).toBeGreaterThanOrEqual(titleSurface.bodyTop);
  expect(titleSurface.titleTop + titleSurface.titleHeight).toBeLessThanOrEqual(titleSurface.bodyTop + titleSurface.bodyHeight);
  expect(titleSurface.titleTextTop).toBeGreaterThanOrEqual(titleSurface.bodyTop);
  expect(titleSurface.hintBottom).toBeLessThanOrEqual(titleSurface.titleTop + titleSurface.titleHeight);
  expect(titleSurface.titleTextBottom).toBeLessThan(titleSurface.menuTop);
  expect(titleSurface.menuBottom).toBeLessThan(titleSurface.hintTop);

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
  expect(surface.modalWidth).toBe(1280);
  expect(surface.modalHeight).toBe(900);
  expect(Math.round(surface.viewportWidth)).toBe(1280);
  expect(Math.round(surface.viewportHeight)).toBe(900);
  expect(Math.round(surface.stageWidth)).toBe(1280);
  expect(Math.round(surface.stageHeight)).toBe(960);
  expect(surface.stageWidth).toBeGreaterThanOrEqual(surface.viewportWidth);
  expect(surface.stageHeight).toBeGreaterThanOrEqual(surface.viewportHeight);
  expect(Math.abs(surface.stageWidth / surface.stageHeight - 4 / 3)).toBeLessThanOrEqual(0.02);
  expect(Math.abs((surface.stageLeft + surface.stageWidth / 2) - (surface.viewportLeft + surface.viewportWidth / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs((surface.stageTop + surface.stageHeight / 2) - (surface.viewportTop + surface.viewportHeight / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.canvasWidth - surface.stageWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(surface.canvasHeight - surface.stageHeight)).toBeLessThanOrEqual(2);
  expect(surface.scale).toBe("4.000");
  expect(Number.isInteger(Number(surface.scale))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("play-runtime-filled.png"), fullPage: true });
  await page.getByTestId("mode-edit").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});

test("test play exposes the runtime menu through X without an on-screen menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoShowcaseEditor(page);

  await expect(page.getByTestId("mode-play")).toBeVisible();
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible();

  await expect(page.getByTestId("main-menu-button")).toHaveCount(0);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await page.keyboard.press("KeyX");
  await expect(page.getByTestId("main-menu")).toBeVisible();
});

test("test play can exit to the editor from title quit and restore to a window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoShowcaseEditor(page);

  await page.getByTestId("mode-play").click();
  const testWindow = page.getByTestId("test-play-window");
  await expect(testWindow).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();

  await page.getByTestId("test-play-window-maximize").click();
  await expect(testWindow).toHaveAttribute("data-window-mode", "fullscreen");
  await expect.poll(async () => {
    const box = await testWindow.boundingBox();
    return box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
  }).toEqual({ width: 1280, height: 900 });

  await page.getByTestId("test-play-window-restore").click();
  await expect(testWindow).toHaveAttribute("data-window-mode", "windowed");
  const windowedBounds = await testWindow.boundingBox();
  expect(windowedBounds?.width).toBeLessThan(1280);
  expect(windowedBounds?.height).toBeLessThan(900);

  await page.getByTestId("title-quit-game").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0);
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});
