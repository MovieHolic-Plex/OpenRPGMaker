import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = process.argv[2] ?? "9863";
const outDir = process.argv[3] ?? "verify-shots/region-drag-clear/after";
const base = `http://127.0.0.1:${port}`;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const log = (line) => console.log(`[capture] ${line}`);
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });

const chipsCount = () =>
  page.locator("[data-testid='selection-action-chips']").count();

await page.goto(`${base}/?freshProject=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__oprnRegionTaskHarness), { timeout: 60_000 });
const canvas = page.locator("[data-testid='edit-canvas'] canvas");
await canvas.waitFor({ state: "visible", timeout: 60_000 });
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas box");

await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForFunction(
  () => document.querySelector("[data-testid='cursor-position']")?.textContent !== "outside",
  { timeout: 30_000 },
);
await shot("00-editor");

await page.mouse.move(box.x + 220, box.y + 200);
await page.mouse.down({ button: "right" });
await page.mouse.move(box.x + 460, box.y + 380, { steps: 16 });
await page.mouse.up({ button: "right" });
await page.locator("[data-testid='region-task-popover']").waitFor({ state: "visible", timeout: 30_000 });
log("region task popover open (drag created the selection)");
await shot("01-region-task-open");

await page.locator("[data-testid='region-task-close']").click();
await page.locator("[data-testid='selection-action-chips']").waitFor({ state: "visible", timeout: 30_000 });
log(`selection chips visible before the work: count=${await chipsCount()}`);
await shot("02-drag-selection-chips");

await page.locator("[data-testid='selection-chip-ai']").click();
const modal = page.locator("[data-testid='region-task-popover'], [data-testid='region-task-modal']").first();
await modal.waitFor({ state: "visible", timeout: 30_000 });
await shot("03-region-task-modal");

await page.locator("[data-testid='region-task-direct-disclosure'] summary").click();
await page.locator("[data-testid='region-task-direct-room']").click();
await page.locator("[data-testid='region-task-apply']").waitFor({ state: "visible", timeout: 120_000 });
log("draft ready for review (no LLM: direct interior draft)");
await shot("04-draft-review");

await page.locator("[data-testid='region-task-apply']").click();
await page.waitForFunction(
  () => !document.querySelector("[data-testid='region-task-popover'], [data-testid='region-task-modal']"),
  { timeout: 60_000 },
);
const chipsAfter = await chipsCount();
log(`selection chips after apply: count=${chipsAfter}`);
await shot("05-after-apply");

console.log(JSON.stringify({ port, outDir, chipsAfterApply: chipsAfter }));
await browser.close();
