// 옵션 정리 — ⋯ 메뉴가 자주 쓰는 3줄 + 「고급·진단」 접힘으로 바뀐 것을 찍는다.
// (여러 맵 × 여러 조수 스크립트의 부팅 부분 재사용) — 실제 맵별 대기열(aiMapRunQueue)에 표를 올리고 다른 맵 보드를 흘려 넣어 존재감 표면을 찍는다.
// 사용: QA_BASE_URL=http://127.0.0.1:<포트> node scripts/qa/ai-presence-multimap.mjs → verify-shots/ai-presence/
import { chromium } from "playwright";
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9816";
const out = "verify-shots/ai-presence";
const browser = await chromium.launch({ args: ["--disable-features=NetworkChangeNotifier", "--disable-network-change-notifier"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("dialog", d => d.accept());
page.on("pageerror", e => console.log("pageerror", e.message));
page.on("console", m => { const t = m.text(); if (["error", "warning"].includes(m.type()) && !/CONNECTION_REFUSED|GL Driver/.test(t)) console.log(m.type(), t.slice(0, 300)); });

// vite 는 HMR 로 바뀐 모듈의 import 에 ?t= 를 붙인다 — 같은 인스턴스를 얻으려면 앱이 실제로 읽은 URL 을 써야 한다.
const MOD = `window.__mod = async (path) => { const hit = performance.getEntriesByType("resource").map(e => e.name).find(n => n.includes(path) && !n.includes("?import")); return import(hit ?? "/" + path); };`;
await page.addInitScript(MOD);
await page.goto(`${base}/?freshProject=1&lang=ko`, { waitUntil: "commit", timeout: 300000 });
// 부하가 큰 박스에서는 부팅이 수 분 걸린다 — 시간 대기 + evaluate 폴링.
let booted = false;
for (let i = 0; i < 100 && !booted; i++) { await page.waitForTimeout(5000); booted = await page.evaluate(() => !!document.querySelector('[data-testid="ai-panel"]') && !!document.querySelector('[data-testid="edit-canvas"]')).catch(() => false); }
if (!booted) { console.log(await page.evaluate(() => location.href + " | " + document.body.innerText.slice(0, 200))); throw new Error("편집기가 부팅하지 않았습니다"); }
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const { store } = await window.__mod("src/project/store.ts");
  const ms = await window.__mod("src/editor/mapSelection.ts");
  const p = store.getCurrent();
  const src = Object.values(p.maps)[0];
  const names = ["시장 마을", "여관 내부", "달빛 숲", "던전 입구", "항구", "마을 정문"];
  const maps = {};
  names.forEach((name, i) => { maps[`demo_${i}`] = { ...src, id: `demo_${i}`, name }; });
  store.replaceProject({ ...p, maps, startMapId: "demo_0" });
  ms.selectEditorMap("demo_0", { checkoutForEditing: false });
});
await page.waitForTimeout(2500);
const info = await page.evaluate(async () => {
  const { store } = await window.__mod("src/project/store.ts");
  const st = await window.__mod("src/editor/editorState.ts");
  return { current: st.editorState.get().currentMapId, maps: Object.entries(store.getCurrent().maps).map(([id, m]) => [id, m.name]) };
});
console.log(JSON.stringify(info));

await page.evaluate(() => document.querySelector('[data-testid="ai-collapsed-restore"]')?.click());
await page.waitForTimeout(1500);
await page.click('[data-testid="ai-command-menu-toggle"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/11-menu-grouped.png` });
await page.click('[data-testid="ai-command-menu-advanced"] summary');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/12-menu-advanced-open.png` });
console.log(JSON.stringify(await page.evaluate(() => ({
  top: [...document.querySelectorAll('[data-testid="ai-command-menu"] > .ai-command-menu-item')].map(b => b.textContent.trim()),
  advanced: [...document.querySelectorAll('[data-testid="ai-command-menu-advanced"] .ai-command-menu-item')].map(b => b.textContent.trim()),
}))));
await browser.close();
