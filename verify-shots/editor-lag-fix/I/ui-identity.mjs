// UI 동일성: 조작(맵 전환·레이어 전환) 전후로 여정 띠·배너·탑바·조수 패널·핸들이 정직하게 갱신되는지 + 스크린샷
import { chromium } from "playwright";
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9850";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); });
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(4000);
const snap = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const h = q("[data-testid='ai-resize-handle']");
  const layer = [...document.querySelectorAll(".left-layer-switcher [aria-current], [class*='layer-switcher'] .is-active")].map((e) => (e.textContent || "").trim().slice(0, 12));
  return {
    topbar: (q(".topbar")?.textContent || "").replace(/\s+/g, " ").slice(0, 160),
    journal: (q("[data-testid*='journey'], .authoring-journey")?.textContent || "").replace(/\s+/g, " ").slice(0, 160),
    banner: (q("[data-testid*='persistence'], .paint-persistence-banner")?.textContent || "").slice(0, 120),
    handleAria: h ? [h.getAttribute("aria-valuemin"), h.getAttribute("aria-valuemax"), h.getAttribute("aria-valuenow")] : null,
    handleLast: h ? h.parentElement?.lastElementChild === h : null,
    chips: [...document.querySelectorAll(".ai-context-chips > *")].map((e) => e.textContent.trim()),
    activeLayer: layer,
    width: q(".ai-deck")?.style.getPropertyValue("--ai-float-bar-width") ?? null,
  };
});
const out = { fresh: await snap() };
await page.screenshot({ path: "ui-after-fresh.png" });
// 레이어 전환
const layerBtns = page.locator(".left-layer-switcher button, [data-testid^='layer-']");
const n = await layerBtns.count();
out.layerButtons = n;
if (n > 1) { await layerBtns.nth(1).click(); await page.waitForTimeout(600); out.afterLayer1 = await snap(); await page.screenshot({ path: "ui-after-layer1.png" }); await layerBtns.nth(0).click(); await page.waitForTimeout(600); out.backLayer0 = await snap(); }
// 맵 추가 후 전환
await page.evaluate(async () => {
  const s = window.__oprnEditorStore; const { editorState } = await import("/src/editor/editorState.ts");
  const a = s.getCurrent().startMapId;
  s.update((d) => { const c = JSON.parse(JSON.stringify(d.maps[a])); c.id = "ui_b"; c.name = "구조B"; d.maps.ui_b = c; if (d.mapOrder) d.mapOrder.push("ui_b"); });
  window.__a = a;
});
await page.waitForTimeout(1500);
await page.evaluate(async () => { const { editorState } = await import("/src/editor/editorState.ts"); editorState.setCurrentMap?.("ui_b") ?? editorState.update?.((d) => { d.currentMapId = "ui_b"; }); });
await page.waitForTimeout(1500);
out.mapB = await snap(); await page.screenshot({ path: "ui-after-mapB.png" });
await page.evaluate(async () => { const { editorState } = await import("/src/editor/editorState.ts"); editorState.setCurrentMap?.(window.__a) ?? editorState.update?.((d) => { d.currentMapId = window.__a; }); });
await page.waitForTimeout(1500);
out.mapA = await snap();
console.log(JSON.stringify(out, null, 1));
const same = JSON.stringify(out.fresh) === JSON.stringify(out.mapA);
console.log("fresh == back-to-A:", same);
await b.close();
