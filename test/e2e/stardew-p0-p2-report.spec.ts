import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const REPORT = pathToFileURL(resolve("reports/stardew-p0-p2-implementation-report.html")).href;
const EVIDENCE_DIR = ".superpowers/sdd/qa-shots/stardew-report";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1440, height: 900 }] as const;

test("P0-P2 HTML report loads every image and remains readable at both target widths", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(REPORT, { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /별빛 농장 마을/ })).toBeVisible();
    await expect(page.locator("#verdict .path")).toContainText("stardew-p0-p2-implementation-report.html");
    await expect.poll(async () => page.locator("img[src]").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `${viewport.width}px report overflow`).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const firstShot = page.locator(".shot img").first();
    await firstShot.click();
    await expect(page.locator("#lightbox")).toHaveJSProperty("open", true);
    await page.locator("#lightbox button").click();
    await expect(page.locator("#lightbox")).toHaveJSProperty("open", false);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: `${EVIDENCE_DIR}/report-hero-${viewport.width}x${viewport.height}.png` });
    await page.locator("#visual").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${EVIDENCE_DIR}/report-visual-${viewport.width}x${viewport.height}.png` });
  }
  expect(errors).toEqual([]);
});
