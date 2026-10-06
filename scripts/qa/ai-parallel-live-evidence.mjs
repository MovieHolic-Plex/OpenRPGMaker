// Actual runPiCommand -> companion -> model. Read-only, independent ephemeral fixture maps.
// No fake events, response delays, fetch mocks, or canonical project writes.
import { firefox } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const verifyOwnership = process.argv.includes("--map-ownership");
const threeMaps = process.argv.includes("--three-maps");
const mapCount = threeMaps ? 3 : 2;
const out = resolve(threeMaps ? "verify-shots/ai-map-ownership/three-maps" : verifyOwnership ? "verify-shots/ai-map-ownership/live" : "verify-shots/ai-parallel-live");
mkdirSync(out, { recursive: true });
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "network.notify.changed": false } });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: resolve(out, "video"), size: { width: 1600, height: 1000 } } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let result;
try {
  await page.addInitScript(() => {
    for (const [key, value] of Object.entries({ "oprn:ai-live-canvas": "on", "oprn:ai-activity-level": "brief", "oprn:standard-welcome-seen": "1", "oprn:editor-welcome-dismissed": "1", "oprn:coachmarks-basic-v1": "1" })) localStorage.setItem(key, value);
    const evidence = window.__parallelEvidence = { events: [], hud: [], requests: [], finished: false };
    const now = () => Math.round(performance.now());
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (url.pathname !== "/v1/agent/run" || init?.method !== "POST") return original(input, init);
      let body = init.body;
      if (new Headers(init.headers).get("Content-Encoding") === "gzip") body = await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      const request = JSON.parse(typeof body === "string" ? body : await new Response(body).text());
      const item = { id: request.runId, mapIds: request.mapIds, provider: request.provider, model: request.model, readOnly: request.readOnly, projectKey: request.projectKey, started: now() };
      evidence.requests.push(item);
      const response = await original(input, init);
      item.status = response.status;
      item.head = now();
      if (!response.ok) { const payload = await response.clone().json().catch(() => ({})); item.code = payload.code; return response; }
      if (!response.body) return response;
      const [observe, application] = response.body.tee();
      (async () => {
        const reader = observe.pipeThrough(new TextDecoderStream()).getReader();
        let pending = "";
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          pending += chunk.value;
          let newline;
          while ((newline = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            evidence.events.push({ t: now(), runId: item.id, type: event.type, seq: event.seq, toolId: event.id, name: event.name, ok: event.ok, ...(event.type === "done" ? { stats: event.stats, changedKeys: event.changedKeys } : {}), ...(event.type === "error" ? { message: event.message } : {}) });
            if (event.type === "start") item.agentStarted = now();
            if (event.type === "turn" && item.firstTurn === undefined) item.firstTurn = now();
            if (event.type === "done") item.done = now();
          }
        }
        item.streamEnded = now();
      })().catch(error => evidence.events.push({ t: now(), runId: item.id, type: "observer-error", message: error.message }));
      return new Response(application, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
    addEventListener("DOMContentLoaded", () => {
      let last = "";
      const observe = () => {
        const hud = document.querySelector('[data-testid="ai-canvas-activity"]');
        const rows = hud ? [...hud.querySelectorAll(".ai-canvas-activity-workers > li")].map(row => ({ agentId: row.dataset.agentId, toolId: row.dataset.toolCallId, phase: row.className, text: row.innerText })) : [];
        const state = { visible: Boolean(hud), phase: hud?.dataset.phase, rows };
        const signature = JSON.stringify(state);
        if (signature !== last) { last = signature; evidence.hud.push({ t: now(), ...state }); }
      };
      new MutationObserver(observe).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    });
  });
  await page.goto(`${process.env.QA_BASE_URL ?? "http://127.0.0.1:9866"}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 120000 });
  const auth = await page.evaluate(async () => {
    const { loadAiConfig } = await import("/src/ai/llmClient.ts");
    const { modelForRole } = await import("/src/ai/modelRoles.ts");
    const { fetchChatGptAuthStatus } = await import("/src/ai/chatgptOAuthClient.ts");
    const model = modelForRole(loadAiConfig(), "deep");
    const auth = await fetchChatGptAuthStatus(model.provider);
    return { provider: model.provider, model: model.model, connected: auth.connected, expired: auth.expired === true };
  });
  console.log(JSON.stringify({ auth }));
  if (!auth.connected || auth.expired) throw new Error("Live provider unavailable");
  await page.evaluate(async (mapCount) => {
    const { store } = await import("/src/project/store.ts");
    const { runPiCommand } = await import("/src/editor/panels/aiPiAgentCommand.ts");
    const { resolveCurrentMapId } = await import("/src/editor/mapSelection.ts");
    const displayMap = resolveCurrentMapId();
    const first = "parallel_evidence_a";
    const mapIds = Array.from({ length: mapCount }, (_, i) => `parallel_evidence_${String.fromCharCode(97 + i)}`);
    store.update(project => {
      for (const [i, mapId] of mapIds.entries()) project.maps[mapId] = { ...structuredClone(project.maps[displayMap]), id: mapId, name: `동시성 검증 ${String.fromCharCode(65 + i)}` };
      project.mapTree = { mapId: displayMap, children: mapIds.map(mapId => ({ mapId, children: [] })) };
    });
    const before = JSON.stringify(store.getCurrent());
    const evidence = window.__parallelEvidence;
    evidence.fixtureMapIds = mapIds;
    window.__checkParallelOwnership = async () => {
      evidence.ownership = [];
      for (const mapId of mapIds) {
      const rejected = [];
      const browserAt = Math.round(performance.now());
      const requestsBefore = evidence.requests.length;
      const duplicate = await runPiCommand({ mode: "single", mapIds: [mapId], currentMapId: mapId, scopedByUser: true, task: "같은 맵 중복 조회" }, { ...surface, appendBubble: (_role, text) => rejected.push(text) }, { readOnly: true, maxTurns: 1 });
      const browserNoHttp = requestsBefore === evidence.requests.length;
      const activeRequest = evidence.requests.find(request => request.status === 200 && request.mapIds.includes(mapId));
      const { companionTokenHeaders } = await import("/src/ai/companionToken.ts");
      const hostRunId = crypto.randomUUID();
      const hostAt = Math.round(performance.now());
      const response = await fetch(`/v1/agent/run?provider=${encodeURIComponent(activeRequest.provider)}`, { method: "POST", headers: { "Content-Type": "application/json", ...companionTokenHeaders() }, body: JSON.stringify({ mode: "single", provider: activeRequest.provider, model: activeRequest.model, projectKey: activeRequest.projectKey, runId: hostRunId, mapIds: [mapId], scopeStrict: true, readOnly: true, task: "같은 맵 서버 중복 조회", project: { maps: { [mapId]: store.getCurrent().maps[mapId] }, mapTree: store.getCurrent().mapTree } }) });
      const payload = await response.json();
      evidence.ownership.push({ mapId, browserAt, browserNoHttp, browserRejected: duplicate === false && rejected.some(text => text.includes("같은 맵")), hostAt, hostDone: Math.round(performance.now()), hostRunId, hostRejected: response.status === 409 && payload.code === "map-busy", hostStatus: response.status, hostCode: payload.code });
      }
      banner.textContent = `맵 ${mapCount}개 각각 추가 호출 차단됨 · 기존 실행 유지`;
    };
    evidence.startedAt = new Date().toISOString();
    evidence.t0 = Math.round(performance.now());
    const banner = document.createElement("div");
    banner.textContent = `실제 모델 병렬 호출 · 읽기 전용 · 맵 ${mapCount}개 개별 실행`;
    banner.style.cssText = "position:fixed;top:8px;left:420px;z-index:99999;background:#182539;color:white;padding:8px 16px;border-radius:8px;pointer-events:none";
    document.body.append(banner);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 180000);
    const surface = {
      appendBubble: (role, text) => evidence.events.push({ t: Math.round(performance.now()), type: "bubble", role, text }),
      appendProcess: () => {}, appendCard: () => {},
      setStatus: text => { banner.textContent = `실제 모델 병렬 호출 · 읽기 전용 · ${text}`; },
      getCurrentMapId: () => first, signal: controller.signal,
    };
    evidence.run = runPiCommand({ mode: "single", mapIds, currentMapId: first, scopedByUser: true,
      task: "읽기 전용 동시성 검증입니다. 자신에게 배정된 mapIds의 맵만 get_map_region으로 x=0,y=0,width=2,height=2 영역을 한 번 읽으세요. B 또는 C라는 이름의 맵이면 이어서 x=2,y=2,width=2,height=2 영역도 별도 호출로 읽으세요. C 맵이면 추가로 x=4,y=4,width=2,height=2 영역도 별도 호출로 읽으세요. 마지막에 맵 이름을 한 줄로 답하세요. 변경 도구는 사용하지 마세요." }, surface,
      { readOnly: true, maxTurns: 5, thinkingLevel: "low", initialToolNames: ["get_map_region"] })
      .then(ok => { evidence.ok = ok; })
      .catch(error => { evidence.error = error.message; })
      .finally(() => { clearTimeout(deadline); evidence.projectUnchangedAfterRun = before === JSON.stringify(store.getCurrent()); evidence.finished = true; evidence.finishedAt = Math.round(performance.now()); });
  }, mapCount);
  console.log("Live parallel invocation started");
  const captures = new Set();
  const limit = Date.now() + 210000;
  while (Date.now() < limit) {
    const state = await page.evaluate(() => {
      const evidence = window.__parallelEvidence;
      return { finished: evidence.finished, requests: evidence.requests, hud: evidence.hud.at(-1) };
    });
    const rows = state.hud?.rows ?? [];
    if ((verifyOwnership || threeMaps) && !captures.has("ownership-checked") && state.requests.filter(r => r.agentStarted !== undefined && r.done === undefined).length >= mapCount) {
      await page.evaluate(() => window.__checkParallelOwnership());
      await page.screenshot({ path: resolve(out, "03-duplicate-blocked.png") });
      captures.add("ownership-checked"); console.log("Checked actual browser and host duplicate rejection");
    }
    for (const [name, condition] of [
      ["01-both-live", state.requests.filter(r => r.agentStarted !== undefined && r.done === undefined).length >= mapCount && rows.length >= mapCount],
      ["02-one-done-other-live", rows.some(r => r.phase === "is-done") && rows.some(r => !["is-done", "is-failed"].includes(r.phase))],
    ]) if (condition && !captures.has(name)) { await page.screenshot({ path: resolve(out, `${name}.png`) }); captures.add(name); console.log(`Captured ${name}`); }
    if (state.finished) break;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  result = await page.evaluate(() => { const { run, ...record } = window.__parallelEvidence; return record; });
  result.errors = errors;
  result.captures = [...captures];
  const runs = result.requests.filter(r => r.status === 200 && r.done !== undefined);
  result.overlapMs = runs.length === mapCount ? Math.max(0, Math.min(...runs.map(r => r.done)) - Math.max(...runs.map(r => r.agentStarted))) : 0;
  const peak = intervals => { let active = 0, maximum = 0; for (const [, delta] of intervals.flatMap(r => [[r.agentStarted, 1], [r.done, -1]]).sort((a,b) => a[0]-b[0] || a[1]-b[1])) maximum = Math.max(maximum, active += delta); return maximum; };
  result.globalPeak = peak(runs);
  result.perMapPeak = Object.fromEntries(result.fixtureMapIds.map(mapId => [mapId, peak(runs.filter(r => r.mapIds.includes(mapId)))]));
  result.checks = { expectedRealCompletedRuns: runs.length === mapCount, overlappingAgentLifetimes: result.overlapMs > 0, allVisibleWorkers: result.hud.some(h => h.rows.length === mapCount), completedWorkerDoesNotClearOther: result.hud.some(h => h.rows.some(r => r.phase === "is-done") && h.rows.some(r => !["is-done", "is-failed"].includes(r.phase))), projectUnchanged: result.projectUnchangedAfterRun, noPageErrors: errors.length === 0, perMapMaximumOne: Object.values(result.perMapPeak).every(n => n === 1), globalPeakMatchesMaps: result.globalPeak === mapCount };
  if (verifyOwnership || threeMaps) Object.assign(result.checks, { duplicateBlockedBeforeModel: result.ownership?.length === mapCount && result.ownership.every(r => r.browserRejected && r.browserNoHttp), duplicateBlockedByCompanion: result.ownership?.length === mapCount && result.ownership.every(r => r.hostRejected), rejectedRunsNeverStarted: result.ownership?.every(r => !result.events.some(e => e.runId === r.hostRunId && e.type === "start")) });
  writeFileSync(resolve(out, "timeline.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks: result.checks, overlapMs: result.overlapMs, requests: result.requests, error: result.error }, null, 2));
} finally { await context.close(); await browser.close(); }
if (!result || Object.values(result.checks).some(value => value !== true)) process.exitCode = 1;
