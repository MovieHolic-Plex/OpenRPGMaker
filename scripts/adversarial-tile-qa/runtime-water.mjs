// 런타임(테스트 플레이) 에서 물 채움 결과가 어떻게 보이는지 — 시작 위치 옆에 물 5×4 를 채우고 테스트 창을 찍는다.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://127.0.0.1:9851";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on("dialog", (d) => d.accept());
await page.addInitScript(() => { localStorage.setItem("oprn:editor-ui-mode", "standard"); localStorage.setItem("oprn:editor-welcome-dismissed", "1"); localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:coachmarks-basic-v1", "1"); });
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
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
  const a = await window.__oprnEditorTool("fill_region", { mapId, rect: { x: 52, y: 49, w: 6, h: 4 }, material: "물" });
  const b = await window.__oprnEditorTool("fill_region", { mapId, rect: { x: 43, y: 49, w: 5, h: 4 }, material: "모래" });
  return [a, b].map((r) => ({ ok: r?.ok, summary: (r?.summary ?? r?.error ?? "").slice(0, 160) }));
});
console.log(JSON.stringify(res));
await page.waitForTimeout(1200);
const canvas = await page.getByTestId("edit-canvas").boundingBox();
await page.screenshot({ path: "/tmp/adv-tile-qa/runtime-editor-view.png", clip: canvas });
await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
const win = page.getByTestId("test-play-window");
await win.waitFor({ state: "visible", timeout: 30000 });
await page.waitForTimeout(2500);
const skip = page.getByTestId("test-play-skip-title");
console.log("skip-title visible:", await skip.isVisible().catch(() => false));
// 타이틀이 보이면 Enter 로 시작
for (let i = 0; i < 3; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(900); }
await page.waitForTimeout(2500);
const box = await win.boundingBox();
await page.screenshot({ path: "/tmp/adv-tile-qa/runtime-play-1.png", clip: box });
await page.waitForTimeout(700);
await page.screenshot({ path: "/tmp/adv-tile-qa/runtime-play-2.png", clip: box });
const state = await page.getByTestId("runtime-state-json").textContent().catch(() => null);
console.log("runtime state:", (state ?? "").slice(0, 200));
await browser.close();
