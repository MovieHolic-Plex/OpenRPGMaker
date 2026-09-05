import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    battlePreviewFrameChange: Promise<string>;
    battlePreviewIntervals: Set<number>;
  }
}

test.setTimeout(120_000);
test.use({ viewport: { width: 1440, height: 900 } });

async function openAnimations(page: Page): Promise<void> {
  // Code-only QA must not write to the shared project database.
  await page.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    if (new URL(request.url()).hostname.endsWith("supabase.co") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      throw new Error(`Unexpected remote write: ${request.method()} ${request.url()}`);
    }
    await route.continue();
  });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 60_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible()) await welcome.click();
  const now = new Date("2026-09-05T12:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date("2026-09-05T13:00:00Z"));
  await page.evaluate(() => {
    const browserWindow: Window = window;
    const setInterval = browserWindow.setInterval.bind(browserWindow);
    const clearInterval = browserWindow.clearInterval.bind(browserWindow);
    window.battlePreviewIntervals = new Set();
    browserWindow.setInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
      const id = setInterval(handler, timeout, ...args);
      if (timeout === 67) window.battlePreviewIntervals.add(id);
      return id;
    };
    browserWindow.clearInterval = (id?: number): void => {
      if (id !== undefined) window.battlePreviewIntervals.delete(id);
      clearInterval(id);
    };
  });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-search").fill("애니메이션");
  await page.getByTestId("db-tab-animations").click();
  await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "ready");
}

async function position(page: Page): Promise<string> {
  return page.getByTestId("db-animation-sheet-preview-surface").evaluate((surface) => {
    const cell = surface.querySelector(".db-animation-stage-cell-sprite");
    if (!(cell instanceof HTMLElement)) throw new Error("No rendered animation cell");
    const bounds = cell.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) throw new Error("Animation cell has no visible area");
    return getComputedStyle(cell).backgroundPosition;
  });
}

async function advanceFrame(page: Page): Promise<string> {
  // Install the exact DOM-change subscription before advancing animation time.
  await page.getByTestId("db-animation-sheet-preview-surface").evaluate((surface) => {
    const read = (): string => {
      const cell = surface.querySelector(".db-animation-stage-cell-sprite");
      return cell instanceof HTMLElement ? getComputedStyle(cell).backgroundPosition : "";
    };
    const before = read();
    window.battlePreviewFrameChange = new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => { observer.disconnect(); reject(new Error("No visible frame change")); }, 1000);
      const observer = new MutationObserver(() => {
        const next = read();
        if (next === before) return;
        observer.disconnect(); window.clearTimeout(timeout); resolve(next);
      });
      observer.observe(surface, { childList: true, subtree: true, attributes: true });
    });
  });
  await page.clock.runFor(67);
  return page.evaluate(() => window.battlePreviewFrameChange);
}

async function activeLoops(page: Page): Promise<number> {
  return page.evaluate(() => window.battlePreviewIntervals.size);
}

test("entry and record switch autoplay visible frames, wrap, and cleanly remount", async ({ page }, testInfo) => {
  await openAnimations(page);
  const play = page.getByTestId("db-animation-play");
  await expect(play).toHaveAttribute("aria-pressed", "true");
  const first = await position(page);
  expect(await advanceFrame(page)).not.toBe(first);
  const count = await page.locator(".db-animation-frame-row").count();
  await page.clock.runFor(67 * (count - 1));
  expect(await position(page)).toBe(first);
  expect(await activeLoops(page)).toBe(1);
  const surface = page.getByTestId("db-animation-sheet-preview-surface");
  const frame0 = await surface.screenshot({ path: testInfo.outputPath("autoplay-frame-0.png") });
  await advanceFrame(page);
  const frame1 = await surface.screenshot({ path: testInfo.outputPath("autoplay-frame-1.png") });
  expect(frame1.equals(frame0)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("autoplay-editor.png") });

  await play.click();
  expect(await activeLoops(page)).toBe(0);
  await page.getByTestId("db-record-row-anim_sword").click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  expect(await activeLoops(page)).toBe(1);
  await advanceFrame(page);

  await page.getByTestId("db-tab-search").fill("");
  await page.getByTestId("db-tab-overview").click();
  expect(await activeLoops(page)).toBe(0);
  await page.getByTestId("db-tab-search").fill("애니메이션");
  await page.getByTestId("db-tab-animations").click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  expect(await activeLoops(page)).toBe(1);

  await page.getByTestId("database-modal-close").click();
  await expect(play).toHaveCount(0);
  expect(await activeLoops(page)).toBe(0);
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-search").fill("애니메이션");
  await page.getByTestId("db-tab-animations").click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  expect(await activeLoops(page)).toBe(1);
});

test("frame selection and explicit stop survive field rerenders; clearing graphic is honestly empty", async ({ page }) => {
  await openAnimations(page);
  const play = page.getByTestId("db-animation-play");
  await page.getByTestId("db-animation-frame-1").click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("db-animation-frame-1")).toHaveClass(/active/);
  const selected = await position(page);
  await page.getByTestId("db-animation-timing-add").click();
  await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "ready");
  await page.clock.runFor(67 * 6);
  await expect(play).toHaveAttribute("aria-pressed", "false");
  expect(await position(page)).toBe(selected);
  await play.click();
  await advanceFrame(page);
  await play.click();
  expect(await position(page)).toBe(selected);
  await page.getByTestId("db-animation-cell-add").click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  expect(await activeLoops(page)).toBe(0);
  await page.getByTestId("db-field-animation-resource-set").click();
  await page.getByTestId("db-field-animation-resource-dialog-clear").click();
  await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "empty");
  await expect(play).toBeDisabled();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".db-animation-stage-cell-sprite")).toHaveCount(0);
  expect(await activeLoops(page)).toBe(0);
});

test("reduced motion stays on the editing frame until manual play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAnimations(page);
  const play = page.getByTestId("db-animation-play");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(play).toBeEnabled();
  const selected = await position(page);
  await page.clock.runFor(67 * 4);
  expect(await position(page)).toBe(selected);
  expect(await activeLoops(page)).toBe(0);
  await play.click();
  expect(await advanceFrame(page)).not.toBe(selected);
  await expect(play).toHaveAttribute("aria-pressed", "true");
  expect(await activeLoops(page)).toBe(1);
});
