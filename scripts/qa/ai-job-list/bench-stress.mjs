// AI 작업 N 개가 동시에 스트리밍될 때 메인 스레드·DOM 비용을 잰다 (모델 호출 없음 — 앱 안의 presence 원천에 합성 이벤트를 직접 넣는다).
//
// 사용: AIUI_BASE=http://127.0.0.1:9909 AIUI_OUT=/tmp/x node bench-stress.mjs <N> <dock: open|folded|studio> <w> <h> <list: closed|open> [trials=3] [durMs=6000]
//
// 합성 구성(N 개): 영역 작업 R=floor(N/5)(지도 위 상자, 한 번 올리고 그대로) · 앞 턴 팀 에이전트 T=ceil((N-R)/2) · 다른 맵 배경 실행 B=N-R-T.
// 팀·배경 일은 틱마다(AIUI_TICK ms, 기본 250 — 실제 조수 스트림이 초당 3~4건) 이벤트 1건씩(5건 중 1건만 반영 토큰을 단 execution_status, 나머지는 delta 조각) — 이벤트는 실제 보드 리듀서(reduceTeamBoard)를 거쳐 publishTeamActivity / reportBackgroundBoard 로 들어간다
// (실제 스트림과 같은 경로: 이벤트마다 보드 → presence 도출 → 구독자 전부).
// 반영 지연: 이벤트가 화면 글(action)에 박은 토큰(J<번호>-<순번>)이 DOM 에 나타나는 시각을 MutationObserver 로 잡는다.
// 첫 팀 일(J1)은 매 틱 토큰을 달아 「대표 프로브」(probe*)로 따로 적는다(상태 줄 칩에 늘 보이는 일 — 닫힘·열림 모두 같은 일을 잰다). 한 프레임에 이벤트가 겹쳐 덮인 토큰은 보이지 않으므로 「관측률」을 함께 적는다.
import { writeFileSync, mkdirSync } from "node:fs";
import { boot } from "./lib.mjs";
import { routeMock, startMock } from "./mock.mjs";

const [N = "10", dock = "open", W = "1440", H = "900", list = "closed", TR = "3", DUR = "6000"] = process.argv.slice(2);
const w = +W, h = +H, n = +N, trials = +TR, durMs = +DUR;
const out = process.env.AIUI_OUT ?? "/tmp/aiui-b2/run";
mkdirSync(out, { recursive: true });

const STAMP = process.env.AIUI_MODE === "stamp";
const init = () => {
  if (location.search.includes("stamp3")) localStorage.setItem("oprn:ai-stamp-place", "1");
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1", "oprn:hint-selection-chips-v1"]) localStorage.setItem(k, "1");
};
const server = await startMock(STAMP ? { stampDelay: 3000 } : {});
const { browser, page } = await boot({ w, h, q: (dock === "studio" ? "devProject=1&scarloxyDemo=1" : "blankProject=1") + (STAMP ? "&stamp3=1" : ""), extraInit: init });
await routeMock(page);
await page.waitForFunction(() => !!window.__oprnEditCamera?.(), null, { timeout: 45000 }).catch(() => console.log("no camera"));
await page.waitForTimeout(1500);

const setDock = async (mode) => {
  const restore = page.getByTestId("ai-collapsed-restore");
  if (mode === "folded") { if (!(await restore.isVisible().catch(() => false))) await page.getByTestId("ai-collapse").click(); }
  else if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(900);
};
if (dock === "studio") { await page.getByTestId("topbar-ai-studio").click(); await page.waitForTimeout(1500); }
else await setDock(dock);

// 합성 구동기 설치 — 모든 상태는 window.__B 에 둔다.
await page.evaluate(async ({ n, TICK }) => {
  const P = await import("/src/editor/panels/aiPresence.ts");
  const Q = await import("/src/editor/aiMapRunQueue.ts");
  const TA = await import("/src/ai/piAgent/teamActivity.ts");
  const TB = await import("/src/ai/piAgent/teamBoardState.ts");
  const RS = await import("/src/editor/regionTask/regionTaskStatus.ts");
  const ES = await import("/src/editor/editorState.ts");
  const mapId = ES.editorState.get().currentMapId;
  const R = Math.floor(n / 5), T = Math.ceil((n - R) / 2), Bn = n - R - T;
  const B = { P, Q, TA, TB, RS, mapId, R, T, Bn, n, seq: 0, sent: new Map(), seen: new Map(), emitCost: [], tickers: [], tickets: [], regionIds: [], board: null, bg: new Map() };
  window.__B = B;
  const tok = (k) => { const s = ++B.seq; return { s, text: `J${k}-${s}` }; };
  B.start = () => {
    const ids = Array.from({ length: T }, (_, i) => `bench-t${i}`);
    let board = TB.createTeamBoardState("team", "벤치 작업");
    board = TB.reduceTeamBoard(board, { type: "team_start", task: "벤치 작업", roles: [] });
    ids.forEach((id, i) => { board = TB.reduceTeamBoard(board, { type: "agent_spawn", agentId: id, role: "builder", mapId, mapName: "빈 맵", task: `팀 작업 ${i + 1}`, label: `팀${i + 1}` }); });
    B.board = board; TA.publishTeamActivity(board);
    for (let i = 0; i < Bn; i++) {
      const ticket = Q.mapRunQueue().enqueue({ mapKey: `bench-map-${i}`, label: `다른 맵 ${i + 1}`, start: (t, signal) => new Promise((res) => signal.addEventListener("abort", () => res())) });
      B.tickets.push(ticket);
      let b = TB.createTeamBoardState("single", `다른 맵 ${i + 1}`);
      b = TB.reduceTeamBoard(b, { type: "agent_spawn", agentId: `bench-b${i}`, role: "builder", mapId: null, mapName: `다른 맵 ${i + 1}`, task: `다른 맵 ${i + 1}`, label: `맵${i + 1}` });
      B.bg.set(i, b); P.reportBackgroundBoard(ticket.id, b);
    }
    for (let i = 0; i < R; i++) { RS.dispatchRegionTaskStatus({ mapId, region: { x: 2 + i * 6, y: 2 + (i % 2) * 5, width: 5, height: 4 }, running: true, runId: 9000 + i }); B.regionIds.push(9000 + i); }
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      for (let i = 0; i < T; i++) {
        const k = i + 1; const token = i === 0 || tick % 5 === (i % 5); const t = token ? tok(k) : null;
        B.board = TB.reduceTeamBoard(B.board, { type: "agent_event", agentId: `bench-t${i}`, event: token ? { type: "execution_status", name: "bench.tick", ok: true, summary: t.text } : { type: "delta", kind: "thinking", text: `조각 ${tick}` } });
        const s0 = performance.now(); if (t) B.sent.set(t.text, s0); TA.publishTeamActivity(B.board); B.emitCost.push(performance.now() - s0);
      }
      for (let i = 0; i < Bn; i++) {
        const k = T + i + 1; const token = tick % 5 === ((T + i) % 5); const t = token ? tok(k) : null;
        const b = TB.reduceTeamBoard(B.bg.get(i), { type: "agent_event", agentId: `bench-b${i}`, event: token ? { type: "execution_status", name: "bench.tick", ok: true, summary: t.text } : { type: "delta", kind: "thinking", text: `조각 ${tick}` } });
        B.bg.set(i, b);
        const s0 = performance.now(); if (t) B.sent.set(t.text, s0); P.reportBackgroundBoard(B.tickets[i].id, b); B.emitCost.push(performance.now() - s0);
      }
    }, TICK);
    B.tickers.push(timer);
  };
  B.stop = () => {
    B.tickers.forEach(clearInterval); B.tickers = [];
    TA.publishTeamActivity(null);
    for (const t of B.tickets) { Q.mapRunQueue().cancel(t.id); P.reportBackgroundBoard(t.id, null); }
    B.tickets = []; B.bg.clear();
    for (const id of B.regionIds) RS.dispatchRegionTaskStatus({ mapId, region: { x: 0, y: 0, width: 1, height: 1 }, running: false, runId: id });
    B.regionIds = [];
  };
  // 관측기: longtask, 프레임 간격, 토큰 반영.
  B.longtasks = []; B.frames = []; B.dragMoves = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) B.longtasks.push(e.duration); }).observe({ type: "longtask", buffered: false }); } catch { B.noLongtask = true; }
  const re = /J(\d+)-(\d+)/g;
  const scan = (text, now) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { const key = m[0]; if (B.sent.has(key) && !B.seen.has(key)) B.seen.set(key, now); } };
  new MutationObserver((records) => {
    const now = performance.now();
    for (const r of records) {
      if (r.type === "characterData") scan(r.target.data ?? "", now);
      else for (const node of r.addedNodes) scan(node.textContent ?? "", now);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  let last = performance.now();
  const raf = (t) => { B.frames.push(t - last); last = t; requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  // 입력→다음 프레임: pointermove 의 timeStamp 에서 그 뒤 첫 rAF 콜백까지.
  window.addEventListener("pointermove", (e) => { if (!B.drag) return; const t0 = e.timeStamp; requestAnimationFrame(() => requestAnimationFrame(() => B.dragMoves.push(performance.now() - t0))); }, true);
}, { n, TICK: +(process.env.AIUI_TICK ?? 250) });

if (list === "open") { await page.getByTestId("ai-status-summary").click().catch(() => console.log("summary missing (before start)")); }

const results = []; let r_stamp = null;
for (let trial = 0; trial < trials; trial++) {
  await page.evaluate(() => { const B = window.__B; B.longtasks = []; B.frames = []; B.dragMoves = []; B.sent.clear(); B.seen.clear(); B.emitCost = []; B.seq = 0; B.drag = false; });
  await page.evaluate(() => window.__B.start());
  await page.waitForTimeout(1200);
  if (list === "open") {
    const open = await page.evaluate(() => !!document.querySelector(".ai-status-pop:not([hidden]), .ai-job-list:not([hidden])"));
    if (!open) await page.getByTestId("ai-status-summary").click().catch(() => {});
    await page.waitForTimeout(400);
  }
  // 측정 창 시작: 합성 상태가 자리 잡은 뒤의 durMs.
  await page.evaluate(() => { const B = window.__B; B.longtasks = []; B.frames = []; B.dragMoves = []; B.sent.clear(); B.seen.clear(); B.emitCost = []; });
  // 드래그(타일 칠하기): 측정 창 한가운데에서 캔버스를 가로지르며 40걸음.
  const stampP = STAMP ? (async () => {
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.__B.drag = true; });
    for (let k = 0; k < 3; k++) {
      const [a, b] = await page.evaluate(([x0, y0, x1, y1]) => [window.__oprnEditWorldToClient(x0 * 16 + 8, y0 * 16 + 8), window.__oprnEditWorldToClient(x1 * 16 + 8, y1 * 16 + 8)], [1 + k * 5, 1 + k * 3, 4 + k * 5, 4 + k * 3]);
      await page.mouse.move(a.x, a.y); await page.mouse.down({ button: "right" });
      for (let i = 1; i <= 20; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 20, a.y + (b.y - a.y) * i / 20);
      await page.mouse.up({ button: "right" }); await page.waitForTimeout(400);
      await page.getByTestId("selection-chip-prompt").fill(["연못", "숲", "길"][k]); await page.keyboard.press("Enter"); await page.waitForTimeout(900);
    }
    await page.evaluate(() => { window.__B.drag = false; });
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const left = await page.evaluate(async () => { const Q = await import("/src/editor/stampOrderQueue.ts"); return Q.peekStampOrderQueue()?.summary().total ?? 0; });
      if (left === 0) break; await page.waitForTimeout(500);
    }
    return Date.now() - t0;
  })() : null;
  const dragP = STAMP ? Promise.resolve() : (async () => {
    await page.waitForTimeout(1000);
    const pts = await page.evaluate(() => [window.__oprnEditWorldToClient(3 * 16 + 8, 12 * 16 + 8), window.__oprnEditWorldToClient(17 * 16 + 8, 12 * 16 + 8)]);
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.evaluate(() => { window.__B.drag = true; });
    await page.mouse.down();
    for (let i = 1; i <= 40; i++) { await page.mouse.move(pts[0].x + (pts[1].x - pts[0].x) * i / 40, pts[0].y); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.evaluate(() => { window.__B.drag = false; });
  })();
  if (STAMP) { r_stamp = await stampP.catch((e) => { console.log("stamp err", String(e).slice(0, 120)); return -1; }); await page.waitForTimeout(300); } else await page.waitForTimeout(durMs);
  await dragP.catch((e) => console.log("drag err", String(e).slice(0, 80)));
  const r = await page.evaluate(() => {
    const B = window.__B;
    const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    const lat = []; const lat1 = []; for (const [k, t1] of B.seen) { lat.push(t1 - B.sent.get(k)); if (k.startsWith("J1-")) lat1.push(t1 - B.sent.get(k)); }
    const count = (sel) => { let c = 0; for (const root of document.querySelectorAll(sel)) c += 1 + root.querySelectorAll("*").length; return c; };
    return {
      longtaskTotalMs: +B.longtasks.reduce((a, b) => a + b, 0).toFixed(1), longtaskMaxMs: +Math.max(0, ...B.longtasks).toFixed(1), longtaskCount: B.longtasks.length, noLongtask: !!B.noLongtask,
      latencyP50: q(lat, 0.5) === null ? null : +q(lat, 0.5).toFixed(1), latencyP95: q(lat, 0.95) === null ? null : +q(lat, 0.95).toFixed(1), latencyN: lat.length, probeP50: q(lat1, 0.5) === null ? null : +q(lat1, 0.5).toFixed(1), probeP95: q(lat1, 0.95) === null ? null : +q(lat1, 0.95).toFixed(1), probeN: lat1.length, probeSent: [...B.sent.keys()].filter((k) => k.startsWith("J1-")).length, sentN: B.sent.size, observedRatio: B.sent.size ? +(lat.length / B.sent.size).toFixed(3) : null,
      emitCostP95: q(B.emitCost, 0.95) === null ? null : +q(B.emitCost, 0.95).toFixed(2), emitCostTotalMs: +B.emitCost.reduce((a, b) => a + b, 0).toFixed(1), emitN: B.emitCost.length,
      framesN: B.frames.length, frameP95: q(B.frames, 0.95) === null ? null : +q(B.frames, 0.95).toFixed(1), jank50: B.frames.filter((f) => f > 50).length,
      dragMoveP50: q(B.dragMoves, 0.5) === null ? null : +q(B.dragMoves, 0.5).toFixed(1), dragMoveP95: q(B.dragMoves, 0.95) === null ? null : +q(B.dragMoves, 0.95).toFixed(1), dragN: B.dragMoves.length,
      stampDrainMs: null,
      domTotal: document.querySelectorAll("*").length,
      domAi: count(".ai-status-bar, .ai-status-pop, .ai-job-list, .ai-map-presence"),
      popOpen: !!document.querySelector(".ai-status-pop:not([hidden]), .ai-job-list:not([hidden])"),
      status: document.querySelector(".ai-status-bar")?.innerText.replace(/\s+/g, " ").slice(0, 80) ?? null,
    };
  });
  r.stampDrainMs = r_stamp;
  await page.evaluate(() => window.__B.stop());
  await page.waitForTimeout(800);
  results.push(r);
  console.log(`N=${n} ${dock} ${w}x${h} list=${list} trial${trial + 1}`, JSON.stringify(r));
}
if (process.argv.includes("--shot")) await page.screenshot({ path: `${out}/${STAMP ? "stamp" : "stress"}-${n}-${dock}-${w}x${h}-${list}.png` });
const file = `${out}/${STAMP ? "stamp" : "stress"}-${n}-${dock}-${w}x${h}-${list}.json`;
writeFileSync(file, JSON.stringify({ n, dock, w, h, list, trials, durMs, base: process.env.AIUI_BASE, results }, null, 1));
await browser.close(); server.close();
