// 여러 맵 × 여러 조수 — 실제 맵별 대기열(aiMapRunQueue)에 표를 올리고 다른 맵 보드를 흘려 넣어 존재감 표면을 찍는다.
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

await page.evaluate(async () => {
  const q = await window.__mod("src/editor/aiMapRunQueue.ts");
  const pr = await window.__mod("src/editor/panels/aiPresence.ts");
  const tb = await window.__mod("src/ai/piAgent/teamBoardState.ts");
  const { store } = await window.__mod("src/project/store.ts");
  const st = await window.__mod("src/editor/editorState.ts");
  const ids = Object.keys(store.getCurrent().maps);
  st.editorState.set({ currentMapId: "demo_0" });
  const here = "demo_0";
  const others = ids.filter(i => i !== here);
  const now = Date.now();
  const board = (mapId, name, role, task, phase, tool) => {
    let s = tb.createTeamBoardState("single", task);
    s = tb.reduceTeamBoard(s, { type: "agent_spawn", agentId: `a-${mapId}`, role, mapId, mapName: name, task, at: now - 40000 });
    if (tool) s = tb.reduceTeamBoard(s, { type: "agent_event", agentId: `a-${mapId}`, event: { type: "tool_start", id: "t", name: tool, args: {}, at: now - 2000 } });
    if (phase === "검토 대기") s = tb.reduceTeamBoard(s, { type: "agent_done", agentId: `a-${mapId}`, ok: true, summary: "끝났어요", stats: { turns: 3, toolCalls: 5 }, changedKeys: [], spills: [], conflicts: [], at: now - 1000 });
    return { ...s, phase };
  };
  window.__release = [];
  const jobs = [
    [here, "광장 정리해줘", null],
    [others[0], "여관 내부 가구 배치", ["일하는 중", "paint_tiles"]],
    [others[1], "숲길 나무 심기", ["일하는 중", "scatter_object"]],
    [others[2], "던전 입구 다듬기", ["검토 대기", null]],
    [others[3] ?? others[0], "항구 부두 놓기", ["일하는 중", "place_props"]],
    [others[4] ?? others[1], "마을 문 달기", ["일하는 중", "place_door"]],
  ];
  for (const [mapId, label, spec] of jobs) {
    if (!mapId) continue;
    let release; const hold = new Promise(r => { release = r; });
    window.__release.push(release);
    const t = q.mapRunQueue().enqueue({ mapKey: mapId, label, start: () => hold });
    if (spec) pr.reportBackgroundBoard(t.id, board(mapId, store.getCurrent().maps[mapId].name, "builder", label, spec[0], spec[1]));
  }
  // 앞 턴(대화 요청)도 현재 맵에서 한 명 돈다.
  const ta = await window.__mod("src/ai/piAgent/teamActivity.ts");
  let s = tb.createTeamBoardState("single", "광장 정리해줘");
  s = tb.reduceTeamBoard(s, { type: "agent_spawn", agentId: "fg", role: "builder", mapId: here, mapName: store.getCurrent().maps[here].name, task: "광장 정리", at: now - 70000 });
  s = tb.reduceTeamBoard(s, { type: "agent_event", agentId: "fg", event: { type: "tool_start", id: "x", name: "paint_tiles", args: {}, at: now - 1000 } });
  ta.publishTeamActivity({ ...s, phase: "실행 중" });
});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(async () => { const pr = await window.__mod("src/editor/panels/aiPresence.ts"); return pr.currentPresences().map(p => [p.id, p.source, p.state, p.mapName]); })));
await page.screenshot({ path: `${out}/06-multimap-bar.png` });
await page.click('[data-testid="ai-status-more"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/07-multimap-all.png` });
await page.keyboard.press("Escape");
await page.evaluate(() => document.querySelector('[data-testid="ai-collapsed-restore"]')?.click());
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/08-multimap-inbox.png` });
await browser.close();
