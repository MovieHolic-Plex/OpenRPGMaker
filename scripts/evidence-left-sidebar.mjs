import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.EVIDENCE_URL || "http://localhost:9999/";
const OUT = join(ROOT, "evidence", "browser-screenshots");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  localStorage.setItem("rpg-zzu:editor-welcome-dismissed", "1");
  // Set ALL possible layout keys
  const layout = JSON.stringify({ leftWidth: 340, mapTreeHeight: 120, leftCollapsed: false, chatDock: "side" });
  localStorage.setItem("rpg-zzu:editor-layout", layout);
  localStorage.setItem("rpg-zzu:editor-layout:v2", layout);
  localStorage.setItem("rpg-zzu:editor-layout:v3", layout);
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Debug
const debug = await page.evaluate(() => {
  const lp = document.querySelector(".left-panel");
  return {
    exists: !!lp,
    display: lp ? getComputedStyle(lp).display : "N/A",
    hidden: lp ? lp.hidden : "N/A",
    classes: lp ? lp.className : "N/A",
    layoutV3: localStorage.getItem("rpg-zzu:editor-layout:v3"),
    layoutV2: localStorage.getItem("rpg-zzu:editor-layout:v2"),
    layoutOld: localStorage.getItem("rpg-zzu:editor-layout"),
  };
});
console.log("Debug:", JSON.stringify(debug, null, 2));

// Force toggle if needed
const btn = page.locator('[data-testid="toolbar-left-panel"]');
if (await btn.isVisible().catch(() => false)) {
  const lp = page.locator(".left-panel").first();
  if (!(await lp.isVisible().catch(() => false))) {
    await btn.click();
    await page.waitForTimeout(1000);
  }
}

await page.waitForTimeout(500);
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
await page.screenshot({ path: join(OUT, ts + "-left-sidebar-full.png"), fullPage: false });

const leftPanel = page.locator(".left-panel").first();
if (await leftPanel.isVisible().catch(() => false)) {
  await leftPanel.screenshot({ path: join(OUT, ts + "-left-sidebar-panel.png") });
  console.log("Panel screenshot saved");
}

await browser.close();
console.log("Done");
