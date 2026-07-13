import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 768, height: 720 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.describe("default adventure visual QA", () => {
  for (const viewport of VIEWPORTS) {
    test(`renders title and village without blank or clipped surfaces on ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
      });
      await page.goto(`/?freshProject=1&defaultAdventureVisual=${viewport.name}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
      const takeover = page.getByTestId("map-lock-banner-takeover");
      if (await takeover.isVisible().catch(() => false)) await takeover.click();
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-editor.png`), fullPage: true });

      await page.getByTestId("mode-play").click({ force: true });
      await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-title.png`), fullPage: true });
      await expect(page.getByTestId("title-screen").getByRole("heading", { name: "이슬 마을" })).toBeVisible();
      await startNewGameFromTitle(page);
      await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-village.png`), fullPage: true });

      const metrics = await playMetrics(page);
      expect(metrics.eventMarkers).toBeGreaterThan(0);
      expect(metrics.stageWidth).toBeGreaterThan(0);
      expect(metrics.stageHeight).toBeGreaterThan(0);
      expect(Math.abs(metrics.stageWidth / metrics.stageHeight - 4 / 3)).toBeLessThanOrEqual(0.05);
    });
  }
});

async function playMetrics(page: Page): Promise<{ readonly eventMarkers: number; readonly stageWidth: number; readonly stageHeight: number }> {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-testid='play-stage']");
    if (!(stage instanceof HTMLElement)) throw new Error("missing play stage");
    const rect = stage.getBoundingClientRect();
    return {
      eventMarkers: document.querySelectorAll("[data-testid^='event-']").length,
      stageWidth: rect.width,
      stageHeight: rect.height,
    };
  });
}
