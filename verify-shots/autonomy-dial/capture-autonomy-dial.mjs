/**
 * Autonomy dial browser evidence capture.
 * Usage: BASE=http://127.0.0.1:9845 node verify-shots/autonomy-dial/capture-autonomy-dial.mjs
 * Proves: settings modal renders ai-config-autonomy select, and moving it syncs
 * the visible reasoning (ai-config-reasoning) + agentMode (ai-config-agentmode) selects.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? "http://127.0.0.1:9845";
mkdirSync(HERE, { recursive: true });
const shots = [];
async function snap(page, name, caption, locator) {
  const path = join(HERE, `${name}.png`);
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
  const box = locator ? await locator.boundingBox().catch(() => null) : null;
  shots.push({ file: `${name}.png`, caption, box });
  console.log("shot", name, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "");
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
});
for (let attempt = 0; attempt < 3; attempt += 1) {
  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  const ok = await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 45_000 }).then(() => true).catch(() => false);
  if (ok) break;
  console.log("boot retry", attempt + 1);
}
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 45_000 });

// Open settings: topbar button first, composer/header menu item as fallback.
const modal = page.getByTestId("ai-settings-modal");
let opened = false;
for (const opener of ["topbar-ai-settings", "ai-more-settings", "ai-command-menu-settings"]) {
  const btn = page.getByTestId(opener);
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    if (await modal.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false)) { opened = true; break; }
  }
}
if (!opened) {
  // Last resort: open the composer ☰ menu then click its settings entry.
  const toggle = page.getByTestId("ai-command-menu-toggle");
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.getByTestId("ai-command-menu-settings").click().catch(() => {});
    opened = await modal.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false);
  }
}
if (!opened) throw new Error("settings modal did not open from any known trigger");

const autonomy = page.getByTestId("ai-config-autonomy");
const reasoning = page.getByTestId("ai-config-reasoning");
const agentMode = page.getByTestId("ai-config-agentmode");
await autonomy.waitFor({ state: "visible", timeout: 10_000 });

const read = () =>
  page.evaluate(() => ({
    autonomy: document.querySelector('[data-testid="ai-config-autonomy"]')?.value ?? null,
    reasoning: document.querySelector('[data-testid="ai-config-reasoning"]')?.value ?? null,
    agentMode: document.querySelector('[data-testid="ai-config-agentmode"]')?.value ?? null,
  }));

// 1. Dial renders (scroll behavior section into view for a tight crop).
const behavior = page.getByTestId("ai-settings-section-behavior");
if (await behavior.isVisible().catch(() => false)) await behavior.scrollIntoViewIfNeeded();
await snap(page, "01-dial-render", "settings modal behavior section renders ai-config-autonomy dial", behavior.isVisible().catch(() => false) ? behavior : modal);
console.log("initial", JSON.stringify(await read()));

// 2. Move dial to max -> reasoning=high, agentMode=auto.
await autonomy.selectOption("max");
await page.waitForFunction(() => document.querySelector('[data-testid="ai-config-reasoning"]')?.value === "high", null, { timeout: 8_000 });
const afterMax = await read();
console.log("after max", JSON.stringify(afterMax));
if (afterMax.reasoning !== "high" || afterMax.agentMode !== "auto") throw new Error(`max sync failed: ${JSON.stringify(afterMax)}`);
await snap(page, "02-dial-max-sync", "dial=max syncs reasoning=high + agentMode=auto (visible labels)", behavior.isVisible().catch(() => false) ? behavior : modal);

// 3. Move dial to confirm -> reasoning=low, agentMode=chat.
await autonomy.selectOption("confirm");
await page.waitForFunction(() => document.querySelector('[data-testid="ai-config-agentmode"]')?.value === "chat", null, { timeout: 8_000 });
const afterConfirm = await read();
console.log("after confirm", JSON.stringify(afterConfirm));
if (afterConfirm.reasoning !== "low" || afterConfirm.agentMode !== "chat") throw new Error(`confirm sync failed: ${JSON.stringify(afterConfirm)}`);
await snap(page, "03-dial-confirm-sync", "dial=confirm syncs reasoning=low + agentMode=chat (visible labels)", behavior.isVisible().catch(() => false) ? behavior : modal);

// 4. Full modal context + persisted config proof.
await snap(page, "04-settings-modal-full", "full settings modal with dial at confirm", modal);
const stored = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && /ai-config|aiconfig|oprn:ai/i.test(k)) { try { out[k] = JSON.parse(localStorage.getItem(k)); } catch { out[k] = localStorage.getItem(k); } }
  }
  return out;
});
console.log("stored", JSON.stringify(stored).slice(0, 400));

writeFileSync(join(HERE, "evidence.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), afterMax, afterConfirm, stored, shots }, null, 2));
await browser.close();
console.log("done", shots.length);
