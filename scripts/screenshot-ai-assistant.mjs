/**
 * Capture AI assistant UI surfaces only (panel/settings/tools).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:4173";
const OUT = "output/evidence/ai-assistant-ux";

async function shot(page, name, locator) {
  const file = path.join(OUT, name);
  if (locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: false });
  }
  console.log("shot", name);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", (d) => d.accept());
await mkdir(OUT, { recursive: true });

console.log("goto…");
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
await page.waitForTimeout(1500);

// 1) collapsed rail/float state (default may be collapsed)
const panel = page.getByTestId("ai-panel");
await panel.waitFor({ state: "attached", timeout: 15_000 });
await shot(page, "01-full-editor-with-ai.png");

// Expand if collapsed
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) {
  await shot(page, "02-collapsed-restore-control.png", restore);
  await restore.click();
  await page.waitForTimeout(400);
}

await shot(page, "03-ai-panel-expanded.png", panel);

// Header + toolbar crop
const header = panel.locator(".ai-chat-header");
if (await header.count()) await shot(page, "04-ai-header.png", header);
const toolbar = page.getByTestId("ai-chat-toolbar");
if (await toolbar.isVisible().catch(() => false)) await shot(page, "05-ai-toolbar.png", toolbar);

// Command bar (bottom)
const commandBar = panel.locator(".ai-command-bar");
if (await commandBar.count()) await shot(page, "06-ai-command-bar.png", commandBar);

// Settings
console.log("open settings…");
await page.getByTestId("ai-settings-toggle").click();
await page.waitForTimeout(400);
const settings = panel.locator(".ai-config, details, [data-testid^=ai-config]").first();
// settings form is details element with fields
const settingsBlock = panel.locator("details, .ai-config-form, form").filter({ has: page.getByTestId("ai-config-baseurl") }).first();
if (await page.getByTestId("ai-config-baseurl").isVisible().catch(() => false)) {
  // screenshot a bounding box covering settings fields
  const base = page.getByTestId("ai-config-baseurl");
  const parent = base.locator("xpath=ancestor::details[1] | ancestor::form[1] | ancestor::div[contains(@class,'ai-config')][1]");
  if (await parent.count()) await shot(page, "07-ai-settings-form.png", parent.first());
  else await shot(page, "07-ai-settings-form.png", panel);
} else {
  await shot(page, "07-ai-settings-form.png", panel);
}
await shot(page, "08-ai-panel-with-settings.png", panel);

// 구 09번 컷은 `chat-dock-toggle` 을 눌러 다른 도크를 찍었다. 도크 축이 2026-08-31 에
// 사라져 토글도 다른 도크도 없다 — 대신 접힘/복귀를 찍는다. 지금 남은 유일한 표면 전환이다.
console.log("collapse toggle…");
const collapse = page.getByTestId("ai-collapse");
if (await collapse.isVisible().catch(() => false)) {
  await collapse.click();
  await page.waitForTimeout(500);
  await shot(page, "09-ai-collapsed.png");
  await page.getByTestId("ai-collapsed-restore").click();
  await page.waitForTimeout(400);
}

// Tools browser modal
console.log("tools browser…");
await page.getByTestId("ai-tools-browser").click();
await page.waitForTimeout(500);
const toolsModal = page.locator("[data-testid=tool-browser-modal], .tool-browser-modal, [role=dialog]").first();
if (await toolsModal.isVisible().catch(() => false)) {
  await shot(page, "10-tools-browser.png", toolsModal);
  await page.keyboard.press("Escape");
} else {
  await shot(page, "10-tools-browser.png");
  await page.keyboard.press("Escape");
}
await page.waitForTimeout(300);

// Harness modal
console.log("harness…");
await page.getByTestId("ai-harness").click();
await page.waitForTimeout(500);
const harness = page.getByTestId("ai-harness-modal");
if (await harness.isVisible().catch(() => false)) {
  await shot(page, "11-harness-modal.png", harness);
  await page.keyboard.press("Escape");
} else {
  await shot(page, "11-harness-modal.png");
  await page.keyboard.press("Escape");
}
await page.waitForTimeout(300);

// Studio mode
console.log("studio…");
await page.getByTestId("ai-studio-toggle").click();
await page.waitForTimeout(600);
await shot(page, "12-ai-studio-mode.png", panel);
await page.getByTestId("ai-studio-toggle").click();
await page.waitForTimeout(400);

// History / dock-history button
console.log("history…");
await page.getByTestId("ai-dock-toggle").click();
await page.waitForTimeout(500);
await shot(page, "13-ai-history-open.png", panel);
await page.getByTestId("ai-dock-toggle").click().catch(() => {});
await page.waitForTimeout(300);

// Start screen / empty log
const log = page.getByTestId("ai-chat-log");
if (await log.isVisible().catch(() => false)) await shot(page, "14-ai-chat-log-start.png", log);

// Collapse again
await page.getByTestId("ai-collapse").click();
await page.waitForTimeout(400);
await shot(page, "15-ai-collapsed-again.png", panel);
await shot(page, "16-full-editor-collapsed-ai.png");

// DOM inventory of AI testids
const inventory = await page.evaluate(() => {
  const root = document.querySelector("[data-testid=ai-panel]");
  if (!root) return { error: "no panel" };
  const rect = root.getBoundingClientRect();
  const styles = getComputedStyle(root);
  const testids = [...root.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"));
  const buttons = [...root.querySelectorAll("button")].map((b) => ({
    text: (b.textContent || "").trim().slice(0, 40),
    title: b.getAttribute("title") || "",
    testid: b.getAttribute("data-testid") || "",
    visible: !!(b.offsetWidth || b.offsetHeight),
  }));
  return {
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    classes: root.className,
    fontSize: styles.fontSize,
    zIndex: styles.zIndex,
    testids,
    buttons,
  };
});
const { writeFile } = await import("node:fs/promises");
await writeFile(path.join(OUT, "ai-ui-inventory.json"), JSON.stringify(inventory, null, 2));
console.log("inventory", JSON.stringify(inventory, null, 2).slice(0, 2000));

await browser.close();
console.log("done →", OUT);
