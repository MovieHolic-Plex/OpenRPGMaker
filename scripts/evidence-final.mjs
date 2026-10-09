import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "evidence", "browser-screenshots");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 810, height: 920 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
});
await page.goto("http://127.0.0.1:9888/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Open left panel
const btn = page.locator('[data-testid="toolbar-left-panel"]');
if (await btn.isVisible().catch(() => false)) {
  const lp = page.locator(".left-panel").first();
  if (!(await lp.isVisible().catch(() => false))) {
    await btn.click();
    await page.waitForTimeout(800);
  }
}
await page.waitForTimeout(800);

// Check if the empty-hint text is gone
const hintText = await page.evaluate(() => {
  const hints = document.querySelectorAll(".empty-hint");
  return Array.from(hints).map(h => h.textContent);
});
console.log("empty-hint texts found:", JSON.stringify(hintText));

// Screenshot left panel
const lp = page.locator(".left-panel").first();
if (await lp.isVisible().catch(() => false)) {
  await lp.screenshot({ path: join(OUT, "after-hint-removed.png") });
  console.log("saved after-hint-removed.png");
}

await browser.close();
