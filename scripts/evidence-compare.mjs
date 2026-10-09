import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "evidence", "browser-screenshots");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 810, height: 920 } });
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
});
await page.goto("http://127.0.0.1:9888/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);
const btn = page.locator('[data-testid="toolbar-left-panel"]');
if (await btn.isVisible().catch(() => false)) {
  const lp = page.locator(".left-panel").first();
  if (!(await lp.isVisible().catch(() => false))) {
    await btn.click();
    await page.waitForTimeout(1000);
  }
}
await page.waitForTimeout(1000);
const m = await page.evaluate(() => {
  const lp = document.querySelector(".left-panel");
  const cs = lp ? getComputedStyle(lp) : null;
  const lpr = document.querySelector('[data-testid="left-palette-root"]');
  const lmr = document.querySelector('[data-testid="left-map-root"]');
  return {
    gridRows: cs ? cs.gridTemplateRows : "N/A",
    paletteH: lpr ? Math.round(lpr.getBoundingClientRect().height) : -1,
    mapTreeH: lmr ? Math.round(lmr.getBoundingClientRect().height) : -1,
  };
});
console.log("preview", JSON.stringify(m));
const leftPanel = page.locator(".left-panel").first();
if (await leftPanel.isVisible().catch(() => false)) {
  await leftPanel.screenshot({ path: join(OUT, "after-preview-80px.png") });
  console.log("saved");
}
await browser.close();
