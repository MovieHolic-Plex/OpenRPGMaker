// 수정 뒤 결정적 증거 사진 — LLM 없이 __oprnEditorTool 로 같은 시나리오를 재현해 전/후를 찍는다.
//   1) 집 위 모래 채움: 벽·지붕 보존   2) 시작 위치 주변 물: 출구 통로   3) NPC 위 연못: 이벤트 칸 보존   4) idle 컴포저의 선택 칩
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE ?? "http://127.0.0.1:9851";
const OUT = process.env.OUT ?? "/tmp/adv-tile-qa-fix";
mkdirSync(OUT, { recursive: true });
const TILE = 16;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const want = (id) => !ONLY || ONLY.has(id);
let m;
let r;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on("dialog", (d) => d.accept());
await page.addInitScript(() => { localStorage.setItem("oprn:editor-ui-mode", "standard"); localStorage.setItem("oprn:editor-welcome-dismissed", "1"); localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:coachmarks-basic-v1", "1"); });
async function boot() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
      const guest = page.getByTestId("login-guest");
      if (await guest.isVisible({ timeout: 4000 }).catch(() => false)) await guest.click();
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90000 });
      await page.waitForFunction(() => !!window.__oprnEditorTool && !!window.__oprnRegionTaskHarness && !!window.__oprnEditWorldToClient && document.querySelector("[data-testid='edit-canvas'] canvas"), null, { timeout: 60000 });
      const start = page.getByTestId("standard-welcome-start");
      if (await start.isVisible().catch(() => false)) await start.click();
      await page.waitForTimeout(1800);
      return;
    } catch (e) { console.error("boot retry", String(e).slice(0, 120)); }
  }
  throw new Error("boot failed");
}
async function zoomShot(name, bbox, pad = 48) {
  const canvas = await page.getByTestId("edit-canvas").boundingBox();
  const rect = await page.evaluate(({ bbox, tile }) => {
    const a = window.__oprnEditWorldToClient(bbox.x * tile, bbox.y * tile);
    const b = window.__oprnEditWorldToClient((bbox.x + bbox.w) * tile, (bbox.y + bbox.h) * tile);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }, { bbox, tile: TILE });
  const x0 = Math.max(canvas.x, rect.x - pad), y0 = Math.max(canvas.y, rect.y - pad);
  const x1 = Math.min(canvas.x + canvas.width, rect.x + rect.w + pad), y1 = Math.min(canvas.y + canvas.height, rect.y + rect.h + pad);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
}
const tool = (name, args) => page.evaluate(({ name, args }) => window.__oprnEditorTool(name, args), { name, args });
const mapId = async () => page.evaluate(() => window.__oprnRegionTaskHarness.currentMapId());

// 1) 집 위 모래
if (want("1")) {
await boot();
m = await mapId();
await zoomShot("1-house-before", { x: 31, y: 38, w: 8, h: 6 });
r = await tool("fill_region", { mapId: m, rect: { x: 31, y: 38, w: 8, h: 6 }, material: "모래" });
console.log("house fill:", JSON.stringify({ ok: r.ok, summary: r.summary, warnings: r.diff?.warnings ?? r.warnings }));
await page.waitForTimeout(900);
await zoomShot("1-house-after", { x: 31, y: 38, w: 8, h: 6 });
}

// 2) 시작 위치 주변 물
if (want("2")) {
await boot();
m = await mapId();
r = await tool("fill_region", { mapId: m, rect: { x: 48, y: 50, w: 5, h: 5 }, material: "물" });
console.log("start fill:", JSON.stringify({ ok: r.ok, summary: r.summary, warnings: r.diff?.warnings ?? r.warnings }));
const startPass = await page.evaluate((m) => { const h = window.__oprnRegionTaskHarness; return [[51,52],[49,52],[50,53],[50,51]].map(([x, y]) => h.passableCount(m, { x, y, w: 1, h: 1 })); }, m);
console.log("start neighbours passable:", JSON.stringify(startPass));
await page.waitForTimeout(900);
await zoomShot("2-start-exit-after", { x: 48, y: 50, w: 5, h: 5 });
}

// 3) NPC 위 둥근 연못
if (want("3")) {
await boot();
m = await mapId();
await zoomShot("3-pond-before", { x: 50, y: 45, w: 9, h: 9 });
r = await tool("fill_region", { mapId: m, rect: { x: 50, y: 45, w: 9, h: 9 }, material: "물", shape: "circle" });
console.log("pond fill:", JSON.stringify({ ok: r.ok, summary: r.summary, warnings: r.diff?.warnings ?? r.warnings }));
const evCells = await page.evaluate((m) => { const h = window.__oprnRegionTaskHarness; return { elder: h.readCell(m, "lower", 50, 48), sign: h.readCell(m, "lower", 50, 51), merchant: h.readCell(m, "lower", 53, 52) }; }, m);
console.log("event cells lower after:", JSON.stringify(evCells));
await page.waitForTimeout(900);
await zoomShot("3-pond-after", { x: 50, y: 45, w: 9, h: 9 });
}

// 4) idle 컴포저의 선택 칩
if (want("4")) {
await boot();
m = await mapId();
await page.evaluate((m) => window.__oprnRegionTaskHarness.setSelection({ mapId: m, x: 42, y: 46, width: 6, height: 5 }), m);
await page.waitForTimeout(700);
const chip = await page.evaluate(() => { const c = document.querySelector("[data-testid='ai-selection-chip']"); const host = document.querySelector("[data-testid='ai-context-chips']"); const rect = c?.getBoundingClientRect(); return { inDom: !!c, visible: !!rect && rect.width > 0 && rect.height > 0, hostDisplay: host ? getComputedStyle(host).display : null, text: c?.textContent ?? null }; });
console.log("chip:", JSON.stringify(chip));
const composer = await page.getByTestId("ai-composer").boundingBox();
const chipRect = await page.evaluate(() => document.querySelector("[data-testid='ai-selection-chip']")?.getBoundingClientRect().toJSON());
console.log("composer rect:", JSON.stringify(composer), "chip rect:", JSON.stringify(chipRect));
const x0 = Math.max(0, Math.min(composer.x, chipRect?.x ?? composer.x) - 12);
const y0 = Math.max(0, Math.min(composer.y, chipRect?.y ?? composer.y) - 12);
const x1 = Math.min(1600, Math.max(composer.x + composer.width, (chipRect?.x ?? 0) + (chipRect?.width ?? 0)) + 12);
const y1 = Math.min(1000, Math.max(composer.y + composer.height, (chipRect?.y ?? 0) + (chipRect?.height ?? 0)) + 12);
await page.screenshot({ path: `${OUT}/4-composer-chip.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
}
await browser.close();
console.log("done", OUT);
