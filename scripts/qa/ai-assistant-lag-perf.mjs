// AI 조수 렉 실측 하네스 — 실제 편집기·실제 스토어·실제 프로젝트(시드), 전송만 대본(NDJSON)이다.
//   QA_BASE_URL=http://127.0.0.1:9954 SEED=/tmp/perf-seed-hill.json LABEL=before node scripts/qa/ai-assistant-lag-perf.mjs
// 재는 것(verify-shots/ai-assistant-lag/<LABEL>.json):
//  ① 실행 중 Long Task 합·최대·개수, rAF 프레임 간격 p95/최대
//  ② 체크포인트 적용 왕복(체크포인트 줄 → ACK 도착) ms
//  ③ 턴이 끝난 뒤 사람 편집 한 번(타일 1칸)의 동기 비용 ms — 조수 구독자 포함
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9954";
const label = process.env.LABEL ?? "run";
const seedPath = process.env.SEED;
const CHECKPOINTS = Number(process.env.CHECKPOINTS ?? 8);
const out = "verify-shots/ai-assistant-lag";
mkdirSync(out, { recursive: true });
const seed = seedPath ? JSON.parse(readFileSync(seedPath, "utf8")) : null;

const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--js-flags=--max-old-space-size=4096"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
page.on("console", (m) => { if (m.text().startsWith("[ack]") || m.type() === "error") console.log("[page]", m.text().slice(0, 400)); });
await page.addInitScript((seed) => {
  if (seed) window.__OPRN_E2E_PROJECT__ = seed;
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  window.__perf = { longTasks: [], frames: [], measuring: false };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (window.__perf.measuring) window.__perf.longTasks.push(e.duration);
    }).observe({ type: "longtask", buffered: false });
  } catch {}
  let last = 0;
  const tick = (t) => { if (window.__perf.measuring && last) window.__perf.frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}, seed);
await page.route("**/*", async (route) => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.endsWith("/auth/status")) return route.fulfill({ json: { connected: true, authKind: "oauth" } });
  if (url.pathname.endsWith("/chat/completions") && req.method() === "POST") {
    const body = req.postDataJSON();
    const coverage = String(body.messages[0]?.content).startsWith("REQUEST_COVERAGE_AUDIT");
    const isReview = body.messages.some((m) => typeof m.content === "string" && (m.content.includes("You are Vision") || m.content.includes("map art-direction reviewer")));
    const content = isReview ? { harmonious: true, summary: "변경 확인", findings: [] }
      : coverage ? { requirements: [{ text: "바닥 여러 칸 수정", criteria: [{ kind: "functionalUnresolved", reason: "타일 확인" }] }], clarifies: [] }
      : { mode: "modify", space: "none", facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [], summary: "바닥 여러 칸 수정" };
    return route.fulfill({ json: { ...(isReview ? { image_delivery: [{ messageIndex: 1, partIndex: 1 }] } : {}), choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } }] } });
  }
  return url.origin === new URL(base).origin || ["image", "font"].includes(req.resourceType()) ? route.continue() : route.abort();
});
const bootStart = Date.now();
await page.goto(seed ? base + "/" : base + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 180000 });
const guest = page.getByTestId("login-guest");
await page.getByTestId("ai-input").waitFor({ state: "attached", timeout: 180000 });
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === "function", undefined, { timeout: 180000 });
const bootMs = Date.now() - bootStart;
await page.waitForTimeout(3000);
const info = await page.evaluate(async (CHECKPOINTS) => {
  const [{ store }, { editorState }, config, spatial] = await Promise.all([
    import("/src/project/store.ts"), import("/src/editor/editorState.ts"), import("/src/ai/llmClient.ts"), import("/src/editor/tools/spatialToolState.ts"),
  ]);
  config.saveAiConfig({ ...config.defaultAiConfig(), piApply: "auto", piTeam: false });
  const project = store.getCurrent();
  const map = Object.values(project.maps).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  editorState.set({ currentMapId: map.id });
  const encoder = new TextEncoder();
  const realFetch = window.fetch;
  window.__perf.acks = [];
  window.__perf.done = false;
  let acknowledge;
  // 대본 쪽 비용이 측정에 섞이지 않게 요청 몸통은 파싱하지 않는다 — 꼬리의 작은 필드만 읽는다.
  const readText = async (init) => {
    if (typeof init.body === "string") return init.body;
    const headers = new Headers(init.headers ?? {});
    const bytes = init.body instanceof ArrayBuffer ? init.body : await new Response(init.body).arrayBuffer();
    if (headers.get("Content-Encoding") === "gzip") return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    return new TextDecoder().decode(bytes);
  };
  const tailField = (text, key) => { const m = text.slice(-4000).match(new RegExp('"' + key + '":("[^"]*"|true|false)')); return m ? JSON.parse(m[1]) : undefined; };
  // 무거운 내용은 이스케이프된 JSON 문자열(heavyBlobs) 안에 있으므로 최상위 "readOnly":true 와 겹치지 않는다.
  const readBody = async (init) => { const text = await readText(init); return text.length < 2_000_000 ? JSON.parse(text) : { runId: tailField(text, "runId"), readOnly: text.includes('"readOnly":true') }; };
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/v1/agent/checkpoint")) {
      let ack = {};
      try { ack = await readBody(init); } catch { ack = { ok: true }; }
      acknowledge(ack);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (!url.includes("/v1/agent/run")) return realFetch(input, init);
    window.__perf.runs = (window.__perf.runs ?? 0) + 1;
    const body = await readBody(init);
    const runHeaders = { "Content-Type": "application/x-ndjson", ...(body.runId ? { "X-Oprn-Run-Id": body.runId } : {}) };
    const reqProject = store.getCurrent();
    if (body.readOnly) return new Response([
      { type: "assistant", text: "1. 바닥을 수정한다." },
      { type: "done", project: { ...reqProject, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } }, unchangedKeys: ["tilesets", "database", "assets"], changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } },
    ].map((e) => JSON.stringify(e)).join("\n") + "\n", { headers: runHeaders });
    return new Response(new ReadableStream({ async start(controller) {
      const write = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      write({ type: "start", provider: body.provider, model: body.model, toolCount: 1 });
      let accepted = { ...reqProject, maps: structuredClone(reqProject.maps) };
      for (let i = 0; i < CHECKPOINTS; i += 1) {
        write({ type: "turn", index: i + 1 });
        for (let d = 0; d < 4; d += 1) { write({ type: "delta", kind: d % 2 ? "text" : "thinking", text: "생각 조각 ".repeat(40) + i + ":" + d }); await sleep(120); }
        write({ type: "tool_start", id: "t" + i, name: "paint_tiles", args: { mapId: map.id, n: 20 } });
        const proposed = { ...accepted, maps: structuredClone(accepted.maps) };
        const target = proposed.maps[map.id];
        // 시작 칸은 건드리지 않는다 — 통행 불가가 되면 적용 게이트가 (옳게) 거부한다.
        const startIdx = reqProject.startMapId === map.id ? reqProject.startPos.y * target.width + reqProject.startPos.x : -1;
        for (let k = 0; k < 20; k += 1) { const idx = (i * 37 + k * 11) % target.lowerTiles.length; if (idx === startIdx) continue; target.lowerTiles[idx] = target.lowerTiles[idx] === 0 ? 1 : 0; }
        spatial.authorMergedSpatialProposal(proposed, accepted);
        const proof = spatial.exportSpatialToolProof(proposed);
        write({ type: "tool_end", id: "t" + i, name: "paint_tiles", ok: true, summary: "20칸 칠함", durationMs: 30 });
        const wire = { ...proposed, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } };
        const waiting = new Promise((r) => { acknowledge = r; });
        const sent = performance.now();
        write({ type: "checkpoint", checkpointId: "qa-" + i, project: wire, unchangedKeys: ["tilesets", "database", "assets"], spatialProof: proof, label: "단계 " + (i + 1), toolName: "paint_tiles" });
        const ack = await waiting;
        window.__perf.acks.push({ ms: performance.now() - sent, ok: ack.ok, issue: ack.issue });
        console.log("[ack]", i, ack.ok, String(ack.issue ?? "").slice(0, 300));
        if (!ack.ok) { write({ type: "error", message: ack.issue }); controller.close(); return; }
        accepted = proposed;
        await sleep(200);
      }
      write({ type: "assistant", text: "바닥을 수정했습니다." });
      write({ type: "done", project: { ...accepted, tilesets: {}, database: {}, assets: { sprites: {}, uploaded: {} } }, unchangedKeys: ["tilesets", "database", "assets"], spatialProof: spatial.exportSpatialToolProof(accepted), changedKeys: ["maps." + map.id], stats: { ms: 1, turns: CHECKPOINTS, toolCalls: CHECKPOINTS, toolErrors: 0 } });
      window.__perf.done = true;
      controller.close();
    } }), { headers: runHeaders });
  };
  return { mapId: map.id, size: map.width + "x" + map.height, maps: Object.keys(project.maps).length };
}, CHECKPOINTS);
await page.getByTestId("ai-composer-apply-mode").selectOption("auto").catch(() => {});
await page.getByTestId("ai-input").fill("왼쪽 위 바닥을 여러 번 나눠 바꿔줘");
await page.evaluate(() => { window.__perf.measuring = true; window.__perf.runStart = performance.now(); });
const cdp = process.env.PROFILE ? await page.context().newCDPSession(page) : null;
if (cdp) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start"); }
await page.getByTestId("ai-send").click();
{
  const started = Date.now();
  const limit = Number(process.env.RUN_TIMEOUT_MS ?? 300000);
  for (;;) {
    const s = await page.evaluate(() => ({ done: window.__perf.done, acks: window.__perf.acks?.length ?? 0, runs: window.__perf.runs ?? 0, status: window.__oprnAiBridge?.status?.() ?? null }));
    if (s.done) break;
    if ((Date.now() - started) % 10000 < 1100) console.log("[wait]", Math.round((Date.now() - started) / 1000) + "s", JSON.stringify(s).slice(0, 300));
    if (Date.now() - started > limit) { await page.screenshot({ path: out + "/" + label + "-stuck.png" }); console.log((await page.locator("body").innerText()).slice(-1500)); throw new Error("run did not finish"); }
    await page.waitForTimeout(1000);
  }
}
await page.waitForTimeout(3000);
const run = await page.evaluate(() => { window.__perf.measuring = false; return { ms: performance.now() - window.__perf.runStart, longTasks: window.__perf.longTasks.slice(), frames: window.__perf.frames.slice(), acks: window.__perf.acks }; });
if (cdp) {
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const keyOf = (n) => (n.callFrame.functionName || "(anon)") + " " + n.callFrame.url.replace(/^.*\/src\//, "src/").replace(/\?.*$/, "") + ":" + (n.callFrame.lineNumber + 1);
  const self = new Map(), total = new Map();
  profile.samples.forEach((id, i) => {
    const dt = (profile.timeDeltas[i] ?? 0) / 1000;
    const n = byId.get(id);
    self.set(keyOf(n), (self.get(keyOf(n)) ?? 0) + dt);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) { const k = keyOf(byId.get(cur)); if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) ?? 0) + dt); } }
  });
  const top = (m, n) => [...m].filter(([k]) => !k.startsWith("(idle)") && !k.startsWith("(program)") && !k.startsWith("(root)")).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => v.toFixed(0).padStart(7) + "ms " + k);
  writeFileSync(out + "/" + label + "-profile.txt", "SELF\n" + top(self, 40).join("\n") + "\n\nTOTAL\n" + top(total, 80).join("\n") + "\n");
}
// ③ 턴 이후 사람 편집 한 번 — 조수 구독자(체크리스트 갱신 등)까지 포함한 동기 비용.
const edits = await page.evaluate(async (mapId) => {
  const actions = await import("/src/editor/actions.ts");
  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    const t = performance.now();
    actions.paintTilesBulk(mapId, [{ layer: "lower", x: 1 + (i % 6), y: 1, tile: i % 2 }], { autoConnect: true });
    samples.push(performance.now() - t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return samples;
}, info.mapId);
await page.screenshot({ path: out + "/" + label + ".png" });
const q = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1); };
const sum = (arr) => +arr.reduce((a, b) => a + b, 0).toFixed(1);
const result = {
  label, base, seed: seedPath ?? "blank", project: info, bootMs, checkpoints: CHECKPOINTS,
  runMs: +run.ms.toFixed(0),
  longTask: { count: run.longTasks.length, totalMs: sum(run.longTasks), maxMs: q(run.longTasks, 1) },
  frameGapMs: { p50: q(run.frames, 0.5), p95: q(run.frames, 0.95), max: q(run.frames, 1), over100: run.frames.filter((f) => f > 100).length },
  checkpointAckMs: { median: q(run.acks.map((a) => a.ms), 0.5), max: q(run.acks.map((a) => a.ms), 1), ok: run.acks.every((a) => a.ok), n: run.acks.length },
  manualEditAfterTurnMs: { median: q(edits, 0.5), max: q(edits, 1) },
  errors,
};
writeFileSync(out + "/" + label + ".json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();

