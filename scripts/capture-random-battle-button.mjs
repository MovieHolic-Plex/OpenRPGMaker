/**
 * Smoke: topbar random battle button opens a battle scene.
 * Expects dev server on :9999.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const OUT = path.resolve("output/evidence/random-battle-button");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(45_000);

const base = process.env.OPRN_URL || "http://127.0.0.1:9999/";
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
});
await page.goto(`${base}?blankProject=1&cb=${Date.now()}`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(1500);

await expectVisible(page, "topbar-battle-test");
await page.getByTestId("topbar-battle-test").click();
await page.waitForSelector('[data-testid="test-play-window"]', { timeout: 20_000 });
await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 20_000 });
await page.waitForTimeout(600);

const meta = await page.evaluate(() => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const title = document.querySelector('[data-testid="test-play-window-title"]')?.textContent ?? "";
  return {
    title,
    hasBattle: !!scene,
    battleSystem: scene?.getAttribute("data-battle-system-resource") ?? "",
    backdrop: document.querySelector("[data-testid='battle-backdrop']")?.getAttribute("data-backdrop-resource-id") ?? "",
  };
});
console.log("meta", meta);

await page.screenshot({ path: path.join(OUT, "random-battle-from-topbar.png") });
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ meta, ok: meta.hasBattle }, null, 2));

await browser.close();
if (!meta.hasBattle) process.exit(1);

async function expectVisible(page, testId) {
  await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 20_000 });
}
