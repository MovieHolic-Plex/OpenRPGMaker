// 물 두 체계 비교: 타일 0(호수 물가 쿼터 시스템) vs 120(물 몸통) 을 같은 크기로 칠해 스크린샷.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://127.0.0.1:9851";
const OUT = "/tmp/adv-tile-qa/water-compare.png";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(15000);
page.on("dialog", (d) => d.accept());
await page.addInitScript(() => { localStorage.setItem("oprn:editor-ui-mode", "standard"); localStorage.setItem("oprn:editor-welcome-dismissed", "1"); localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:coachmarks-basic-v1", "1"); });
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4000 }).catch(() => false)) await guest.click();
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90000 });
    await page.waitForFunction(() => !!window.__oprnEditorTool && !!window.__oprnRegionTaskHarness && document.querySelector("[data-testid='edit-canvas'] canvas"), null, { timeout: 60000 });
    break;
  } catch (e) { console.error("boot retry", String(e).slice(0, 120)); }
}
const start = page.getByTestId("standard-welcome-start");
if (await start.isVisible().catch(() => false)) await start.click();
await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const mapId = window.__oprnRegionTaskHarness.currentMapId();
  const out = [];
  out.push(await window.__oprnEditorTool("paint_tiles", { mapId, layer: "lower", mode: "rect", tile: 0, from: { x: 2, y: 3 }, to: { x: 6, y: 6 } }));
  out.push(await window.__oprnEditorTool("paint_tiles", { mapId, layer: "lower", mode: "rect", tile: 120, from: { x: 9, y: 3 }, to: { x: 13, y: 6 } }));
  out.push(await window.__oprnEditorTool("fill_region", { mapId, rect: { x: 2, y: 9, w: 5, h: 4 }, material: "물" }));
  out.push(await window.__oprnEditorTool("fill_region", { mapId, rect: { x: 9, y: 9, w: 5, h: 4 }, material: "호수" }));
  const h = window.__oprnRegionTaskHarness;
  return { results: out.map((r) => ({ ok: r?.ok, summary: (r?.summary ?? r?.error ?? r?.reason ?? "").slice(0, 200) })), cell0: h.readCell(mapId, "lower", 3, 4), cell120: h.readCell(mapId, "lower", 10, 4), cellFillMul: h.readCell(mapId, "lower", 3, 10), cellFillHosu: h.readCell(mapId, "lower", 10, 10), pass0: h.passableCount(mapId, { x: 2, y: 3, w: 5, h: 4 }), pass120: h.passableCount(mapId, { x: 9, y: 3, w: 5, h: 4 }) };
});
console.log(JSON.stringify(res, null, 1));
await page.waitForTimeout(1500);
const canvas = await page.getByTestId("edit-canvas").boundingBox();
await page.screenshot({ path: OUT, clip: canvas });
console.log("shot", OUT);
await browser.close();
