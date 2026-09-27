// Screenshots the editor chrome (full window + left sidebar crop + open top menus)
// for each UI mode, into a labelled evidence folder. Used for the before/after pair of the
// menu/sidebar IA change.
// Usage: node scripts/shoot-editor-chrome.mjs <label> [base-url]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const LABEL = process.argv[2] ?? "shot";
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:9806";
const OUT = `.omo/evidence/menu-ia/shots-${LABEL}`;
const MODES = ["editor"];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const mode of MODES) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript((m) => {
    try {
      localStorage.clear();
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
    } catch {}
  }, mode);
  const page = await context.newPage();
  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator(".oprn-menu-bar").waitFor({ state: "visible", timeout: 30_000 });
  // Let the palette finish its first paint before shooting: wait for the actual surface,
  // not for a duration.
  await page
    .locator("[data-testid='left-palette-root']")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {});

  await page.screenshot({ path: `${OUT}/${mode}-full.png` });

  const sidebar = page.locator(".left-panel").first();
  if (await sidebar.count()) await sidebar.screenshot({ path: `${OUT}/${mode}-sidebar.png` }).catch(() => {});

  const topbar = page.locator(".oprn-menu-bar").first();
  if (await topbar.count()) await topbar.screenshot({ path: `${OUT}/${mode}-topbar.png` }).catch(() => {});

  // Each top menu popup, one shot per menu.
  const menuIds = await page.evaluate(
    `[...document.querySelectorAll('.oprn-menu-bar > .oprn-menu-item[data-testid^="menu-"]')].map((n) => n.dataset.testid)`
  );
  for (const id of menuIds) {
    await page.click(`[data-testid="${id}"]`).catch(() => {});
    const popup = page.locator(`[data-testid="menu-popup-${id.replace(/^menu-/, "")}"]`).first();
    if (await popup.count()) await popup.screenshot({ path: `${OUT}/${mode}-popup-${id}.png` }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
  }
  console.log(`${mode}: shot menus ${JSON.stringify(menuIds)}`);
  await context.close();
}

await browser.close();
console.log(`SHOTS_SAVED=${OUT}`);
