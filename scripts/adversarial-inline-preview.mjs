
import { chromium } from "playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";
const evidenceDir = path.resolve("output/evidence/event-quick-authoring-adversarial");
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox","--use-gl=swiftshader","--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("oprn:editor-session-id", "adversarial-inline-preview");
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const page = await context.newPage();
await page.goto("https://127.0.0.1:9999/?freshProject=1", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);
const eventLayerButton = page.getByTestId("layer-event");
await eventLayerButton.click();
const eventTool = page.locator('[data-testid="tool-event"]:visible').first();
if (await eventTool.count()) await eventTool.click();
const canvas = page.getByTestId("edit-canvas").locator("canvas");
const box = await canvas.boundingBox();
await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
const editor = page.getByTestId("event-editor-modal");
await editor.waitFor({ state: "visible" });
async function openPicker() {
  const current = page.getByTestId("event-command-picker");
  if (await current.isVisible().catch(() => false)) {
    await current.getByTestId("event-command-picker-tab-1").click();
    return current;
  }
  await editor.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await picker.waitFor({ state: "visible" });
  await picker.getByTestId("event-command-picker-tab-1").click();
  return picker;
}
const shots = [
  { id: "m2-001-show-text", sel: "[data-testid=event-command-text-live-preview]", name: "inline-text-preview" },
  { id: "m2-001-show-text", sel: ".event-command-text-preview-card", name: "inline-text-preview-card" },
  { id: "m2-035-transfer-player", sel: ".transfer-command-editor-inline", name: "inline-transfer" },
  { id: "m2-057-move-event", sel: ".move-route-editor", name: "inline-move-route" },
  { id: "m2-032-shop-processing", sel: ".shop-processing-command-body", name: "inline-shop" },
  { id: "m2-003-change-faceset", sel: "[data-testid=event-command-preview]", name: "faceset-right-preview" },
];
for (const shot of shots) {
  const picker = await openPicker();
  const wrap = picker.locator(`.event-command-picker-command-wrap[data-command-id="${shot.id}"] > .event-command-picker-command`).first();
  await wrap.scrollIntoViewIfNeeded();
  await wrap.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await dialog.waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(evidenceDir, `focus-${shot.name}-full.png`) });
  const target = page.locator(shot.sel).first();
  if (await target.count() && await target.isVisible().catch(() => false)) {
    await target.screenshot({ path: path.join(evidenceDir, `focus-${shot.name}.png`) });
    const metrics = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || "").trim().slice(0, 400);
      const imgs = [...el.querySelectorAll("img")].map((i) => ({w:i.naturalWidth,h:i.naturalHeight,src:i.currentSrc}));
      const canvases = [...el.querySelectorAll("canvas")].map((c) => ({w:c.width,h:c.height}));
      return { w:r.width,h:r.height,text,imgs,canvases,htmlLen: el.innerHTML.length };
    });
    console.log(JSON.stringify({ name: shot.name, metrics }));
  } else {
    console.log(JSON.stringify({ name: shot.name, missing: true }));
  }
  const cancel = dialog.getByTestId("event-command-edit-cancel");
  if (await cancel.count()) await cancel.click();
  else await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
}
await browser.close();
