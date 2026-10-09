import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = "http://localhost:9999/";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  const layout = JSON.stringify({ leftWidth: 340, mapTreeHeight: 120, leftCollapsed: false, chatDock: "side" });
  localStorage.setItem("oprn:editor-layout", layout);
  localStorage.setItem("oprn:editor-layout:v2", layout);
  localStorage.setItem("oprn:editor-layout:v3", layout);
  localStorage.setItem("oprn:editor-layout:v4", layout);
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
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
  const lmr = document.querySelector('[data-testid="left-map-root"]');
  const lpr = document.querySelector('[data-testid="left-palette-root"]');
  const res = document.querySelector(".resizer-map-tree");
  const cs = lp ? getComputedStyle(lp) : null;
  return {
    leftPanelHeight: lp ? lp.getBoundingClientRect().height : -1,
    gridTemplateRows: cs ? cs.gridTemplateRows : "N/A",
    cssVar: cs ? cs.getPropertyValue("--map-tree-height") : "N/A",
    paletteHeight: lpr ? lpr.getBoundingClientRect().height : -1,
    resizerHeight: res ? res.getBoundingClientRect().height : -1,
    mapRootHeight: lmr ? lmr.getBoundingClientRect().height : -1,
    layoutKey: localStorage.getItem("oprn:editor-layout:v3"),
    layoutKeyOld: localStorage.getItem("oprn:editor-layout"),
  };
});
console.log(JSON.stringify(m, null, 2));

await browser.close();
