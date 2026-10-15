// 조수·팀 모드 렉 실측 하네스 — 실제 편집기(Phaser 포함)·실제 스토어·실제 입력창/보내기 경로, 모델 서버만 대본(NDJSON)이다.
//
//   격리 netns 에서 dev 서버와 함께 돌린다(이 박스는 크로미움이 ERR_NETWORK_CHANGED 로 백지가 난다):
//     unshare -rn bash -c 'ip link set lo up; (npm run dev:worktree -- --port 9901 &) ; sleep 25; \
//        QA_BASE_URL=http://127.0.0.1:9901 LABEL=before node scripts/qa/perf-ai-lag.mjs'
//   또는 scripts/qa/perf-ai-lag-netns.sh (dev 서버까지 한 번에).
//
// 시나리오(SCENARIOS=콤마 목록, 기본 전부). 각 시나리오는 같은 페이지·같은 96×80 마을 위에서 차례로 돈다:
//   idle        조수 접힘, 아무것도 안 함
//   panel       조수 패널 열림, 아무것도 안 함
//   stream      조수 대본 스트림(생각·도구·map_delta·체크포인트 적용)이 흐르는 동안
//   team        팀 모드 대본 스트림(팀장+시공 2+검수, 보드·체크포인트)이 흐르는 동안
//   각 시나리오 안에서 «입력 구간»(칠하기 드래그 → 가운데 버튼 팬 → Ctrl+휠 줌)을 돌려 입력 지연을 잰다.
//   idle/panel 도 같은 입력 구간을 돌리므로 «AI 가 켜져 있을 때 얼마나 더 느려지나» 가 같은 잣대로 나온다.
//
// 재는 것(verify-shots/perf-ai-lag/<LABEL>.json + <LABEL>-<시나리오>-profile.txt):
//   ① Phaser 프레임: step 간격(p50/p95/최대), step 비용, 렌더한 프레임 비율, 렌더 비용
//   ② 메인 스레드 Long Task(합·최대·개수) + Long Animation Frame 의 스크립트 귀속(소스별 합)
//   ③ 입력 지연: 캔버스 포인터 이벤트의 큐 대기(performance.now()-event.timeStamp) p50/p95/최대, Event Timing(≥16ms) 최대
//   ④ CDP 프로파일(PROFILE=1): 시나리오별 self/inclusive 상위 함수
// 옵션: STREAM_SEC(스트림 길이, 기본 24) · VILLAGE=96x80 · PROFILE=1 · ATTR=1(rAF/타이머 등록자 집계)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9901";
const label = process.env.LABEL ?? "run";
const SCEN = (process.env.SCENARIOS ?? "idle,panel,stream,team").split(",").map((s) => s.trim()).filter(Boolean);
const STREAM_SEC = Number(process.env.STREAM_SEC ?? 24);
const [VW, VH] = (process.env.VILLAGE ?? "96x80").split("x").map(Number);
const PROFILE = process.env.PROFILE === "1";
const NOINPUT = process.env.NOINPUT === "1"; // 입력 구간을 건너뛴다 — AI 스트림만의 비용을 분리해 본다.
const out = "verify-shots/perf-ai-lag";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--js-flags=--max-old-space-size=6144"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
page.on("console", (m) => { if (m.text().startsWith("[perf]") || m.type() === "error") console.log("[page]", m.text().slice(0, 300)); });

await page.addInitScript(({ attr, gbcr }) => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(k, "1");
  const P = window.__perf = { on: false, t0: 0, long: [], loaf: [], evt: [], input: [], step: [], regs: {} };
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (P.on) P.long.push([Math.round(e.startTime - P.t0), +e.duration.toFixed(1), e.startTime]); }).observe({ type: "longtask" });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!P.on) continue;
        P.loaf.push({ at: Math.round(e.startTime - P.t0), dur: +e.duration.toFixed(1), block: +(e.blockingDuration ?? 0).toFixed(1), render: +((e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0)).toFixed(1),
          scripts: (e.scripts ?? []).map((s) => ({ d: +s.duration.toFixed(1), url: String(s.sourceURL).replace(/^.*\/src\//, "src/").replace(/\?.*$/, ""), fn: s.sourceFunctionName, pos: s.sourceCharPosition, type: s.invokerType, inv: String(s.invoker).slice(0, 80) })) });
      }
    }).observe({ type: "long-animation-frame" });
  } catch {}
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (P.on) P.evt.push({ st: e.startTime, name: e.name, delay: +(e.processingStart - e.startTime).toFixed(1), proc: +(e.processingEnd - e.processingStart).toFixed(1), dur: e.duration }); }).observe({ type: "event", durationThreshold: 16 });
  } catch {}
  // 입력 큐 대기 — 캔버스 위 포인터 이벤트가 핸들러에 닿기까지(메인 스레드가 막혔던 시간).
  window.addEventListener("pointermove", (e) => { if (P.on && P.measureInput) P.input.push([P.phase ?? "", performance.now() - e.timeStamp]); }, { capture: true, passive: true });
  if (gbcr) {
    // 강제 레이아웃 귀속: getBoundingClientRect/scrollHeight 등 레이아웃을 강제하는 읽기의 호출 수·시간을 호출 파일:줄 별로 집계한다.
    const forced = P.forced = {};
    const note = (what, ms) => { if (!P.on) return; const st = (new Error().stack?.split("\n") ?? []).slice(3, 5).map((l) => (l.match(/\/src\/([^?:)]+)\??[^:]*:(\d+)/) || [])[0]?.replace(/^\/src\//, "") ?? "?").join(" < "); const k = what + " @ " + st; const e = forced[k] ??= { n: 0, ms: 0, max: 0 }; e.n += 1; e.ms += ms; e.max = Math.max(e.max, ms); };
    // DOM 변경 귀속: 변경 대상의 가장 가까운 data-testid/class 별 레코드 수(스트림 동안 어디가 계속 바뀌는가).
    const muts = P.muts = {};
    P.mutsRef = muts;
    const label = (node) => { const el = node.nodeType === 1 ? node : node.parentElement; if (!el) return "?"; const t = el.closest("[data-testid]"); return t ? "testid:" + t.dataset.testid : (el.closest("[class]")?.className?.toString().split(" ")[0] ?? el.tagName); };
    const startMut = () => new MutationObserver((list) => { if (!P.on) return; for (const m of list) { const k = m.type + (m.attributeName ? ":" + m.attributeName : "") + " " + label(m.target); muts[k] = (muts[k] ?? 0) + 1; } }).observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
    document.addEventListener("DOMContentLoaded", startMut, { once: true });
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { const a = performance.now(); const r = orig.call(this); note("gBCR", performance.now() - a); return r; };
    for (const prop of ["scrollHeight", "clientHeight", "offsetHeight", "offsetWidth", "scrollTop"]) {
      const d = Object.getOwnPropertyDescriptor(Element.prototype, prop) ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
      if (!d?.get) continue;
      Object.defineProperty(Element.prototype, prop, { ...d, get() { const a = performance.now(); const v = d.get.call(this); note(prop, performance.now() - a); return v; } });
    }
  }
  if (attr) {
    const wrap = (name) => { const orig = window[name]; window[name] = function (cb, ...rest) { const s = new Error().stack?.split("\n")[2]?.replace(/^.*\/src\//, "src/").replace(/\?[^:]*/, "") ?? "?"; if (P.on) P.regs[name + " " + s] = (P.regs[name + " " + s] ?? 0) + 1; return orig.call(this, cb, ...rest); }; };
    wrap("requestAnimationFrame"); wrap("setTimeout"); wrap("setInterval");
  }
}, { attr: process.env.ATTR === "1", gbcr: process.env.GBCR === "1" });

// 모델 서버: 의도 선언(/chat/completions)·읽기 전용 실행은 고정 응답.
await page.route("**/*", async (route) => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.endsWith("/auth/status")) return route.fulfill({ json: { connected: true, authKind: "oauth" } });
  if (url.pathname.endsWith("/chat/completions") && req.method() === "POST") {
    const body = req.postDataJSON();
    const coverage = String(body.messages[0]?.content).startsWith("REQUEST_COVERAGE_AUDIT");
    const content = coverage ? { requirements: [{ text: "바닥 여러 칸 수정", criteria: [{ kind: "functionalUnresolved", reason: "타일 확인" }] }], clarifies: [] }
      : { mode: "modify", space: "none", facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [], summary: "바닥 여러 칸 수정" };
    return route.fulfill({ json: { choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } }] } });
  }
  return url.origin === new URL(base).origin || ["image", "font"].includes(req.resourceType()) ? route.continue() : route.abort();
});

const t0boot = Date.now();
await page.goto(base + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 240000 });
await page.getByTestId("edit-canvas").waitFor({ timeout: 420000 });
await page.waitForFunction(() => typeof window.__oprnEditorTool === "function" && typeof window.__oprnEditWorldToClient === "function", undefined, { timeout: 120000 });
const bootMs = Date.now() - t0boot;

// 큰 프로젝트: 새 프로젝트 기본 자료(번들 타일셋 전부) + 버들항 마을 VW×VH.
const village = await page.evaluate(async ([w, h]) => {
  const res = window.__oprnEditorTool("author_beodeul_town", { name: "perf village", theme: "river", width: w, height: h, seed: 11 });
  if (!res.ok) return { ok: false, summary: String(res.summary).slice(0, 300) };
  const { editorState } = await import("/src/editor/editorState.ts");
  editorState.set({ currentMapId: res.data.mapId, tool: "paint", layer: "lower", selectedTile: 6, paintShape: "pen", activePaletteStamp: null, brushSize: 1, zoom: 2 });
  const { store } = await import("/src/project/store.ts");
  const p = store.getCurrent();
  return { ok: true, mapId: res.data.mapId, w: p.maps[res.data.mapId].width, h: p.maps[res.data.mapId].height, maps: Object.keys(p.maps).length, tilesets: Object.keys(p.tilesets).length };
}, [VW, VH]);
if (!village.ok) throw new Error("village build failed: " + village.summary);
console.log("[perf] village", JSON.stringify(village), "boot ms", bootMs);
await page.waitForTimeout(4000);

// Phaser 계측 — step/렌더 비용, 렌더한 프레임 수.
await page.evaluate(async () => {
  const { getGame } = await import("/src/app/mode.ts");
  const { editRenderGateStats } = await import("/src/editor/editRenderGate.ts");
  for (let i = 0; i < 100 && !getGame(); i += 1) await new Promise((r) => setTimeout(r, 200));
  const game = getGame();
  const P = window.__perf;
  const orig = game.loop.callback;
  let last = 0, lastRendered = 0;
  game.loop.callback = (time, delta) => {
    const a = performance.now();
    orig(time, delta);
    const b = performance.now();
    if (P.on) {
      const stats = editRenderGateStats(game);
      const rendered = stats ? stats.renderedFrames : 0;
      P.step.push([last ? +(a - last).toFixed(1) : 0, +(b - a).toFixed(2), rendered > lastRendered ? 1 : 0, P.phase ?? ""]);
    }
    lastRendered = editRenderGateStats(game)?.renderedFrames ?? lastRendered;
    last = a;
  };
  window.__game = game;
});

// 각 시나리오가 같은 시작 상태에서 출발하도록 마을 직후의 프로젝트를 저장해 두고 되돌린다.
await page.evaluate(async () => { const { store } = await import("/src/project/store.ts"); window.__baseline = store.getCurrent(); });
async function restoreBaseline() {
  await page.evaluate(async () => { const { store } = await import("/src/project/store.ts"); store.replace(window.__baseline, { change: { label: "QA baseline", source: "qa" } }); });
  await page.waitForTimeout(800);
}

// ── 입력 구간 ────────────────────────────────────────────────────────────
async function canvasBox() { const box = await page.getByTestId("edit-canvas").locator("canvas").boundingBox(); if (!box) throw new Error("no canvas"); return box; }
async function inputPhase(name) {
  const box = await canvasBox();
  const cx = box.x + box.width * 0.35, cy = box.y + box.height * 0.5;
  const setPhase = (ph) => page.evaluate((ph) => { const P = window.__perf; P.phase = ph; P.measureInput = ph !== ""; (P.marks ??= []).push([performance.now(), ph]); }, ph);
  const phase = async (key, fn) => { await setPhase(key); await fn(); await setPhase(""); };
  // 칠하기: 왼쪽 버튼 드래그 40 샘플(마을 위 가로줄).
  await phase("paint", async () => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 40; i += 1) { await page.mouse.move(cx + i * 8, cy + (i % 2) * 6); await page.waitForTimeout(12); }
    await page.mouse.up();
    await page.waitForTimeout(400); // 뗀 뒤 따라오는 후속 작업(구독자·규칙 감사)까지
  });
  // 팬: 가운데 버튼 드래그 40 샘플.
  await phase("pan", async () => {
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: "middle" });
    for (let i = 1; i <= 40; i += 1) { await page.mouse.move(cx - i * 9, cy - i * 4); await page.waitForTimeout(12); }
    await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(200);
  });
  // 줌: Ctrl+휠 6단(확대 3 · 축소 3).
  await phase("zoom", async () => {
    await page.mouse.move(cx, cy);
    await page.keyboard.down("Control");
    for (const dy of [-120, -120, -120, 120, 120, 120]) { await page.mouse.wheel(0, dy); await page.waitForTimeout(160); }
    await page.keyboard.up("Control");
    await page.waitForTimeout(200);
  });
  await page.waitForTimeout(500); // Long Task / Event Timing 항목은 비동기로 전달된다
  const raw = await page.evaluate(() => {
    const P = window.__perf; const marks = P.marks; P.marks = [];
    const phaseAt = (t) => { let cur = ""; for (const [mt, ph] of marks) { if (mt <= t) cur = ph; else break; } return cur; };
    return { input: P.input.slice(), step: P.step.filter((x) => x[3]),
      evt: P.evt.map((e) => ({ ...e, phase: phaseAt(e.st) })).filter((e) => e.phase),
      long: P.long.map((l) => [l[0], l[1], phaseAt(l[2])]).filter((l) => l[2]) };
  });
  await page.evaluate(() => { window.__perf.input.length = 0; });
  await restoreBaseline();
  const per = {};
  for (const ph of ["paint", "pan", "zoom"]) {
    const inp = raw.input.filter((x) => x[0] === ph).map((x) => x[1]);
    const ev = raw.evt.filter((e) => e.phase === ph);
    const st = raw.step.filter((x) => x[3] === ph);
    const lg = raw.long.filter((x) => x[2] === ph).map((x) => x[1]);
    const gaps = st.map((x) => x[0]).filter((g) => g > 0);
    per[ph] = { inputN: inp.length, inputP50: q(inp, 0.5), inputP95: q(inp, 0.95), inputMax: q(inp, 1), evtN: ev.length, evtMaxMs: ev.length ? Math.max(...ev.map((e) => e.dur)) : 0, evtOver100: ev.filter((e) => e.dur > 100).length,
      longN: lg.length, longSumMs: sum(lg), longMaxMs: q(lg, 1), gapP50: q(gaps, 0.5), gapP95: q(gaps, 0.95), gapMax: q(gaps, 1) };
  }
  return { name, per, raw: { input: raw.input.map((x) => x[1]), evt: raw.evt, step: raw.step, long: raw.long.map((x) => [x[0], x[1]]) } };
}

// ── 통계 ────────────────────────────────────────────────────────────────
const q = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1); };
const sum = (arr) => +arr.reduce((a, b) => a + b, 0).toFixed(1);
function summarize(win) {
  // win: { steps:[[gap,cost,rendered]], long:[[at,dur]], loaf:[...], input:[ms] }
  const gaps = win.steps.map((s) => s[0]).filter((g) => g > 0);
  const cost = win.steps.map((s) => s[1]);
  const renderedCost = win.steps.filter((s) => s[2]).map((s) => s[1]);
  const byScript = new Map();
  for (const f of win.loaf) for (const s of f.scripts) { const k = `${s.url}:${s.fn || "(anon)"} [${s.type}]`; byScript.set(k, (byScript.get(k) ?? 0) + s.d); }
  return {
    frames: { n: win.steps.length, gapP50: q(gaps, 0.5), gapP95: q(gaps, 0.95), gapMax: q(gaps, 1), over50: gaps.filter((g) => g > 50).length, over100: gaps.filter((g) => g > 100).length,
      stepCostP50: q(cost, 0.5), stepCostP95: q(cost, 0.95), stepCostMax: q(cost, 1), renderedFrac: win.steps.length ? +(win.steps.filter((s) => s[2]).length / win.steps.length).toFixed(2) : 0, renderCostP50: q(renderedCost, 0.5), renderCostP95: q(renderedCost, 0.95) },
    longTask: { n: win.long.length, totalMs: sum(win.long.map((l) => l[1])), maxMs: q(win.long.map((l) => l[1]), 1) },
    loaf: { n: win.loaf.length, totalMs: sum(win.loaf.map((f) => f.dur)), maxMs: q(win.loaf.map((f) => f.dur), 1), scriptTop: [...byScript].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v.toFixed(0)}ms ${k}`) },
    input: win.input ? { n: win.input.length, p50: q(win.input, 0.5), p95: q(win.input, 0.95), max: q(win.input, 1) } : undefined,
  };
}

// 렌더링 엔진 시간(스크립트 / 스타일 계산 / 레이아웃) — CDP Performance.getMetrics 의 증가분.
let metricsCdp = null;
async function metricsNow() {
  metricsCdp ??= await page.context().newCDPSession(page);
  await metricsCdp.send("Performance.enable");
  const { metrics } = await metricsCdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}
function metricsDelta(a, b) {
  const d = (k) => +(((b[k] ?? 0) - (a[k] ?? 0)) * 1000).toFixed(0);
  return { scriptMs: d("ScriptDuration"), layoutMs: d("LayoutDuration"), styleMs: d("RecalcStyleDuration"), taskMs: d("TaskDuration"), layouts: +((b.LayoutCount ?? 0) - (a.LayoutCount ?? 0)), styleRecalcs: +((b.RecalcStyleCount ?? 0) - (a.RecalcStyleCount ?? 0)), nodes: Math.round(b.Nodes ?? 0), heapMB: Math.round((b.JSHeapUsedSize ?? 0) / 1e6) };
}

async function startProfile() { const cdp = await page.context().newCDPSession(page); await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start"); return cdp; }
async function stopProfile(cdp, name) {
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const keyOf = (n) => (n.callFrame.functionName || "(anon)") + " " + n.callFrame.url.replace(/^.*\/src\//, "src/").replace(/^.*\/node_modules\//, "nm/").replace(/\?.*$/, "") + ":" + (n.callFrame.lineNumber + 1);
  const self = new Map(), total = new Map();
  profile.samples.forEach((id, i) => {
    const dt = (profile.timeDeltas[i] ?? 0) / 1000;
    const n = byId.get(id);
    self.set(keyOf(n), (self.get(keyOf(n)) ?? 0) + dt);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) { const k = keyOf(byId.get(cur)); if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) ?? 0) + dt); } }
  });
  const top = (m, n) => [...m].filter(([k]) => !/^\((idle|program|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => v.toFixed(0).padStart(7) + "ms " + k);
  const idle = [...self].filter(([k]) => /^\(idle\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  const all = [...self].reduce((a, [, v]) => a + v, 0);
  // 자기 시간 상위 12개가 어느 호출 경로(바로 위 4단계)에서 왔는지 — 「누가 불렀나」를 바로 읽는다.
  const chain = (id, depth) => { const names = []; for (let cur = parent.get(id), i = 0; cur !== undefined && i < depth; cur = parent.get(cur), i += 1) names.push(keyOf(byId.get(cur)).replace(/ src\//, " ")); return names.join(" <- "); };
  const selfTop = [...self].filter(([k]) => !/^\((idle|program|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
  const paths = new Map();
  profile.samples.forEach((id, i) => { const k = keyOf(byId.get(id)); if (!selfTop.includes(k)) return; const key = k + "  <=  " + chain(id, 4); paths.set(key, (paths.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); });
  const callers = [...paths].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => v.toFixed(0).padStart(7) + "ms " + k);
  writeFileSync(`${out}/${label}-${name}-profile.txt`, `busy ${(all - idle).toFixed(0)}ms of ${all.toFixed(0)}ms (idle ${idle.toFixed(0)}ms)\nSELF\n${top(self, 40).join("\n")}\n\nCALLERS (self 상위 함수 <- 호출 경로)\n${callers.join("\n")}\n\nTOTAL\n${top(total, 70).join("\n")}\n`);
  return { busyMs: +(all - idle).toFixed(0), wallMs: +all.toFixed(0), selfTop: top(self, 6) };
}

async function openPanel() {
  const input = page.getByTestId("ai-input");
  if (!(await input.isVisible().catch(() => false))) {
    await page.evaluate(() => document.querySelector("[data-testid=ai-collapsed-restore]")?.click());
    await input.waitFor({ state: "visible", timeout: 30000 });
  }
}
async function closePanel() {
  if (await page.getByTestId("ai-input").isVisible().catch(() => false)) await page.evaluate(() => document.querySelector("[data-testid=ai-collapse]")?.click());
  await page.waitForTimeout(600);
}
async function setAiConfig(team) {
  await page.evaluate(async (team) => {
    const config = await import("/src/ai/llmClient.ts");
    config.saveAiConfig({ ...config.defaultAiConfig(), piApply: "auto", piTeam: team });
  }, team);
}

// ── 대본 스트림 ──────────────────────────────────────────────────────────
// 실제 워커 모양: 델타는 1초 간격으로 합쳐 오고(PI_AGENT_DELTA_FLUSH_MS), heartbeat 5초, 도구 한 번에 map_delta 하나, 체크포인트는 ACK 를 기다린다.
async function installScript({ team, seconds, mapId }) {
  await page.evaluate(async ({ team, seconds, mapId }) => {
    const [{ store }, spatial, prot] = await Promise.all([import("/src/project/store.ts"), import("/src/editor/tools/spatialToolState.ts"), import("/src/editor/tools/houseProtection.ts")]);
    const encoder = new TextEncoder();
    const realFetch = window.__realFetch ?? (window.__realFetch = window.fetch);
    const P = window.__perf;
    P.script = { acks: [], done: false, checkpoints: 0, events: 0 };
    let acknowledge;
    const readText = async (init) => {
      if (typeof init.body === "string") return init.body;
      const headers = new Headers(init.headers ?? {});
      const bytes = init.body instanceof ArrayBuffer ? init.body : await new Response(init.body).arrayBuffer();
      if (headers.get("Content-Encoding") === "gzip") return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      return new TextDecoder().decode(bytes);
    };
    const tailField = (text, key) => { const m = text.slice(-4000).match(new RegExp('"' + key + '":("[^"]*"|true|false)')); return m ? JSON.parse(m[1]) : undefined; };
    const readBody = async (init) => { const text = await readText(init); return text.length < 2_000_000 ? JSON.parse(text) : { runId: tailField(text, "runId"), readOnly: text.includes('"readOnly":true') }; };
    const MD = "### 진행 상황\n\n- **강가 둔덕**을 돌길로 정리했어요\n- 집 앞 길을 `2칸` 폭으로 맞췄어요\n- 다리 머리 광장에 소품을 놓는 중이에요\n\n> 다음은 밭과 울타리입니다.\n";
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/v1/agent/checkpoint")) {
        let ack = {}; try { ack = await readBody(init); } catch { ack = { ok: true }; }
        acknowledge?.(ack);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (!url.includes("/v1/agent/run")) return realFetch(input, init);
      const body = await readBody(init);
      const runHeaders = { "Content-Type": "application/x-ndjson", ...(body.runId ? { "X-Oprn-Run-Id": body.runId } : {}) };
      const reqProject = store.getCurrent();
      if (body.readOnly) return new Response([
        { type: "assistant", text: "1. 바닥을 수정한다." },
        { type: "done", project: { ...reqProject, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } }, unchangedKeys: ["tilesets", "database", "assets"], changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } },
      ].map((e) => JSON.stringify(e)).join("\n") + "\n", { headers: runHeaders });
      return new Response(new ReadableStream({ async start(controller) {
        const write = (event) => { P.script.events += 1; controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const stop = performance.now() + seconds * 1000;
        const map = reqProject.maps[mapId];
        const W = map.width, N = map.lowerTiles.length;
        const startIdx = reqProject.startMapId === mapId ? reqProject.startPos.y * W + reqProject.startPos.x : -1;
        // 집 보호 영역 밖의 칸만 쓴다(안쪽은 적용 게이트가 거절한다). 위쪽 줄부터.
        const blocked = new Set(prot.protectedHouseCells(map).map((c) => c.y * W + c.x));
        const free = []; for (let i = 0; i < N && free.length < 4000; i += 1) if (i !== startIdx && !blocked.has(i)) free.push(i);
        let accepted = { ...reqProject, maps: { ...reqProject.maps, [mapId]: { ...map, lowerTiles: map.lowerTiles.slice() } } };
        const tools = ["paint_tiles", "fill_region", "place_props", "paint_road"];
        let step = 0;
        // 한 도구 호출: tool_start → map_delta → (가끔) 체크포인트 → tool_end. 팀이면 agent_event 로 감싼다.
        const wrapEv = (agentId, ev) => (team ? { type: "agent_event", agentId, event: ev } : ev);
        const toolCycle = async (agentId, k) => {
          const name = tools[k % tools.length], id = `${agentId}-t${k}`;
          write(wrapEv(agentId, { type: "tool_start", id, name, args: { mapId, x: 10 + (k % 40), y: 8 + (k % 30), w: 6, h: 4, tile: 7 + (k % 5) } }));
          const proposed = { ...accepted, maps: { ...accepted.maps, [mapId]: { ...accepted.maps[mapId], lowerTiles: accepted.maps[mapId].lowerTiles.slice() } } };
          const target = proposed.maps[mapId].lowerTiles; const cells = [];
          for (let c = 0; c < 40; c += 1) { const i = free[(k * 40 + c) % free.length]; const t = 6 + ((k + c) % 6); if (target[i] !== t) { target[i] = t; cells.push({ i, t }); } }
          write(wrapEv(agentId, { type: "map_delta", maps: [{ mapId, layers: [{ layer: "lower", cells }] }] }));
          await sleep(400);
          if (k % 2 === 1) {
            spatial.authorMergedSpatialProposal(proposed, accepted);
            const proof = spatial.exportSpatialToolProof(proposed);
            const waiting = new Promise((r) => { acknowledge = r; });
            const sent = performance.now();
            write({ type: "checkpoint", checkpointId: `qa-${agentId}-${k}`, project: { ...proposed, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } }, unchangedKeys: ["tilesets", "database", "assets"], spatialProof: proof, label: `단계 ${k + 1}`, toolName: name });
            const ack = await waiting;
            P.script.acks.push({ ms: performance.now() - sent, ok: ack.ok, issue: ack.issue });
            P.script.checkpoints += 1;
            if (!ack.ok) { write({ type: "error", message: String(ack.issue) }); controller.close(); P.script.done = true; return false; }
            // 팀이면 다른 시공 팀원이 같은 맵 사본을 이어받는다 — 수용한 결과가 다음 기준.
            accepted = proposed;
          } else accepted = proposed;
          write(wrapEv(agentId, { type: "tool_end", id, name, ok: true, summary: `${cells.length}칸 ${name}`, durationMs: 380, result: { data: { changed: cells.length } } }));
          return true;
        };
        if (!team) {
          write({ type: "start", provider: body.provider, model: body.model, toolCount: 40 });
          let k = 0, turn = 0;
          let lastBeat = performance.now();
          while (performance.now() < stop) {
            write({ type: "turn", index: ++turn });
            for (let d = 0; d < 2; d += 1) { write({ type: "delta", kind: d ? "text" : "thinking", text: "길의 굽은 곳을 따라 집 앞을 정리해야 한다. ".repeat(14) + turn }); await sleep(1000); }
            write({ type: "assistant", text: MD + turn });
            for (let j = 0; j < 2; j += 1) { if (!(await toolCycle("agent-1", k++))) return; await sleep(500); }
            if (performance.now() - lastBeat > 5000) { write({ type: "heartbeat", at: Date.now() }); lastBeat = performance.now(); }
          }
          write({ type: "assistant", text: "마을 바닥을 정리했습니다." });
          write({ type: "done", project: { ...accepted, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } }, unchangedKeys: ["tilesets", "database", "assets"], spatialProof: spatial.exportSpatialToolProof(accepted), changedKeys: ["maps." + mapId], stats: { ms: seconds * 1000, turns: turn, toolCalls: k, toolErrors: 0 } });
        } else {
          write({ type: "team_start", task: "마을을 다듬어줘", roles: [{ id: "orchestrator", label: "팀장" }, { id: "builder", label: "시공" }, { id: "reviewer", label: "검수" }] });
          const agents = [["builder-1", "builder"], ["builder-2", "builder"], ["reviewer-1", "reviewer"]];
          for (const [agentId, role] of agents) write({ type: "agent_spawn", agentId, role, mapId, mapName: "perf village", task: `${agentId} 가 맡은 구역을 다듬는다`, label: role === "builder" ? "시공" : "검수" });
          let k = 0, lastBeat = performance.now();
          const loops = agents.slice(0, 2).map(async ([agentId], ai) => {
            let turn = 0;
            await sleep(ai * 700);
            while (performance.now() < stop) {
              write({ type: "agent_event", agentId, event: { type: "turn", index: ++turn } });
              write({ type: "agent_event", agentId, event: { type: "delta", kind: "thinking", text: "생각 ".repeat(60) + turn } });
              await sleep(1000);
              write({ type: "agent_event", agentId, event: { type: "assistant", text: MD + turn } });
              for (let j = 0; j < 2; j += 1) { if (!(await toolCycle(agentId, k++))) return; await sleep(400); }
            }
          });
          const reviewer = (async () => { while (performance.now() < stop) { await sleep(1500); write({ type: "agent_event", agentId: "reviewer-1", event: { type: "delta", kind: "text", text: "검수 중 ".repeat(30) } }); if (performance.now() - lastBeat > 5000) { write({ type: "heartbeat", at: Date.now() }); lastBeat = performance.now(); } } })();
          await Promise.all([...loops, reviewer]);
          for (const [agentId] of agents.slice(0, 2)) write({ type: "agent_done", agentId, ok: true, summary: "구역 정리 완료", stats: { ms: seconds * 1000, turns: 4, toolCalls: 6, toolErrors: 0 }, changedKeys: ["maps." + mapId], spills: [], conflicts: [] });
          write({ type: "review", agentId: "reviewer-1", mapId, ok: true, findings: [] });
          write({ type: "team_report", text: "팀이 마을 바닥을 정리했습니다." });
          write({ type: "done", project: { ...accepted, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } }, unchangedKeys: ["tilesets", "database", "assets"], spatialProof: spatial.exportSpatialToolProof(accepted), changedKeys: ["maps." + mapId], stats: { ms: seconds * 1000, turns: 8, toolCalls: k, toolErrors: 0 } });
        }
        P.script.done = true;
        controller.close();
      } }), { headers: runHeaders });
    };
  }, { team, seconds, mapId });
}

const results = { label, base, bootMs, village, streamSec: STREAM_SEC, scenarios: {}, errors };

async function windowSlice(from) {
  return page.evaluate((from) => { const P = window.__perf; return { steps: P.step.slice(from.step), long: P.long.slice(from.long), loaf: P.loaf.slice(from.loaf) }; }, from);
}
async function cursor() { return page.evaluate(() => ({ step: window.__perf.step.length, long: window.__perf.long.length, loaf: window.__perf.loaf.length })); }

async function runScenario(name) {
  console.log("[perf] scenario", name);
  const team = name === "team";
  const streaming = name === "stream" || name === "team";
  await closePanel();
  await setAiConfig(team);
  if (name !== "idle") await openPanel();
  await page.evaluate(() => { window.__perf.on = true; window.__perf.t0 = performance.now(); });
  const cdp = PROFILE ? await startProfile() : null;
  const scen = { name };
  const m0 = await metricsNow();
  const w0 = Date.now();
  if (streaming) {
    await installScript({ team, seconds: STREAM_SEC, mapId: village.mapId });
    await page.getByTestId("ai-input").fill(team ? "마을을 팀으로 다듬어줘" : "왼쪽 위 바닥을 여러 번 나눠 바꿔줘");
    const before = await cursor();
    await page.evaluate(() => { window.__perf.sendAt = performance.now(); document.querySelector('[data-testid="ai-send"]').click(); });
    // 스트림이 돌고 있는 한가운데(첫 체크포인트가 적용된 뒤)에서 입력 구간.
    await page.waitForFunction(() => (window.__perf.script?.checkpoints ?? 0) >= 1, undefined, { timeout: 120000 });
    const mid = await cursor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${label}-${name}-mid.png` }); // 스트림 한가운데 — 지도 위 이름표·상태 줄이 그려진 모습
    scen.streamBeforeInput = summarize({ ...(await windowSlice(before)), steps: (await windowSlice(before)).steps.slice(0, mid.step - before.step), long: [], loaf: [] });
    const ip = NOINPUT ? { raw: { step: [], long: [], input: [], evt: [] }, per: {} } : await inputPhase(name);
    const afterInput = await cursor();
    const win = await windowSlice(mid);
    // 입력 구간 안의 프레임·롱태스크만 따로.
    scen.input = { ...summarize({ steps: ip.raw.step, long: ip.raw.long, loaf: [], input: ip.raw.input }), eventTimingMax: ip.raw.evt.length ? Math.max(...ip.raw.evt.map((e) => e.dur)) : 0, eventTimingN: ip.raw.evt.length };
    scen.phases = ip.per;
    // 스트림이 끝날 때까지.
    await page.waitForFunction(() => window.__perf.script?.done, undefined, { timeout: 240000 });
    await page.waitForFunction(() => !window.__oprnAiBridge?.status?.().turnBusy, undefined, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const whole = await windowSlice(before);
    scen.whole = summarize(whole);
    scen.runMs = Math.round(await page.evaluate(() => performance.now() - window.__perf.sendAt));
    scen.acks = await page.evaluate(() => { const a = window.__perf.script.acks; return { n: a.length, ok: a.every((x) => x.ok), ms: a.map((x) => Math.round(x.ms)) }; });
    void afterInput; void win;
  } else {
    const before = await cursor();
    await page.waitForTimeout(6000);
    scen.idle = summarize({ ...(await windowSlice(before)), loaf: (await windowSlice(before)).loaf });
    const mid = await cursor();
    const ip = NOINPUT ? { raw: { step: [], long: [], input: [], evt: [] }, per: {} } : await inputPhase(name);
    scen.input = { ...summarize({ steps: ip.raw.step, long: ip.raw.long, loaf: [], input: ip.raw.input }), eventTimingMax: ip.raw.evt.length ? Math.max(...ip.raw.evt.map((e) => e.dur)) : 0, eventTimingN: ip.raw.evt.length };
    scen.phases = ip.per;
    void mid;
  }
  scen.engine = { wallMs: Date.now() - w0, ...metricsDelta(m0, await metricsNow()) };
  if (cdp) scen.profile = await stopProfile(cdp, name);
  scen.forced = await page.evaluate(() => { const f = window.__perf.forced; if (!f) return undefined; const o = Object.entries(f).sort((a, b) => b[1].ms - a[1].ms).slice(0, 14).map(([k, v]) => `${v.ms.toFixed(0)}ms n=${v.n} max=${v.max.toFixed(0)} ${k}`); for (const k of Object.keys(f)) delete f[k]; return o; });
  scen.muts = await page.evaluate(() => { const m = window.__perf.muts; if (!m) return undefined; const o = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v} ${k}`); for (const k of Object.keys(m)) delete m[k]; return o; });
  scen.regs = await page.evaluate(() => { const r = window.__perf.regs; const o = Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, 12); window.__perf.regs = {}; return o; });
  await page.evaluate(() => { window.__perf.on = false; });
  await page.screenshot({ path: `${out}/${label}-${name}.png` });
  await restoreBaseline();
  results.scenarios[name] = scen;
  console.log(JSON.stringify({ [name]: { engine: scen.engine, phases: scen.phases, whole: scen.whole?.frames, longTask: (scen.whole ?? scen.idle)?.longTask } }));
}

for (const name of SCEN) {
  try { await runScenario(name); } catch (e) { results.scenarios[name] = { error: String(e?.message ?? e).slice(0, 400) }; console.log("[perf] scenario failed", name, e?.message); await page.screenshot({ path: `${out}/${label}-${name}-fail.png` }).catch(() => {}); }
}
writeFileSync(`${out}/${label}.json`, JSON.stringify(results, null, 2));
console.log("[perf] wrote", `${out}/${label}.json`);
await browser.close();
