/**
 * C3 regression: surfaces sharing the assistant stylesheet still render/open.
 * Usage: node scripts/qa/assistant-adjacent-surfaces-qa.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyLegacyEnvAliases } from "../lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9819";
const OUT = "output/evidence/assistant-ui-modern";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${String(e).slice(0, 300)}`));
page.on("dialog", (d) => d.accept());
await mkdir(OUT, { recursive: true });

const results = {};
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
results.editCanvasVisible = await page.getByTestId("edit-canvas").isVisible();
results.assistantPanelVisible = await page.getByTestId("ai-panel").isVisible();
await page.screenshot({ path: path.join(OUT, "regression-01-canvas.png") });

const settingsEntry = page.getByTestId("topbar-ai-settings");
await settingsEntry.click({ timeout: 15_000 });
const settingsModal = page.getByTestId("ai-settings-modal");
await settingsModal.waitFor({ state: "visible", timeout: 15_000 });
results.aiSettingsModalVisible = true;
await page.screenshot({ path: path.join(OUT, "regression-02-ai-settings.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

const dataTab = page.locator('button:has-text("데이터")').first();
await dataTab.click({ timeout: 15_000 });
await page.waitForTimeout(1500);
const dbAssistant = page.locator('button:has-text("AI 어시스턴트")').first();
results.databaseAssistantEntryVisible = await dbAssistant.isVisible().catch(() => false);
await page.screenshot({ path: path.join(OUT, "regression-03-database.png") });

const report = { base: BASE, results, consoleErrors };
await writeFile(path.join(OUT, "regression-measure.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
