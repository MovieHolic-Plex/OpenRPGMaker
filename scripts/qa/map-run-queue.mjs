// 맵별 조수 실행 대기열 — 「맵당 AI 하나, 맵마다 대기열, 여러 맵은 동시에, 겹치면 merge」(사용자 2026-10-03).
// 실제 편집기·실제 전송 버튼·실제 체크포인트 적용(3-way 병합 포함). 모델만 대본이다:
// 의도 선언(/chat/completions)은 고정 JSON, Pi 실행(/v1/agent/run)은 맵마다 칸 몇 개를 칠하는 NDJSON 대본.
//
//   A: 맵1 에서 보냄 → 앞 턴으로 돈다(약 7초).
//   B: A 가 도는 중 맵2 로 옮겨 보냄 → 바로 같이 돈다(맵별 카드).
//   C: 맵1 로 돌아와 보냄 → 「이 맵 앞에 1개」로 기다렸다가 A 가 끝난 뒤 돈다.
// 끝에 세 실행의 칸이 모두 남았는지(서로 덮지 않았는지) 본다.
//
//   BASE=http://127.0.0.1:<dev port> node scripts/qa/map-run-queue.mjs
// 증거 → verify-shots/map-run-queue/ (report.json, frames/*.png, video/*.webm)
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const base = process.env.BASE ?? "http://127.0.0.1:9880";
const out = process.env.OUT ?? "verify-shots/map-run-queue";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/frames`, { recursive: true });
mkdirSync(`${out}/video`, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--js-flags=--max-old-space-size=6144", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${out}/video`, size: { width: 1440, height: 900 } } });
const page = await context.newPage();
const report = { transport: "scripted model; real checkpoint apply", errors: [], checks: [] };
page.on("pageerror", (e) => report.errors.push(String(e.message).slice(0, 300)));
page.on("console", (m) => { if (m.text().startsWith("QA") || m.type() === "error") console.log(m.type(), m.text().slice(0, 300)); });
page.on("crash", () => { report.errors.push("renderer crashed"); console.log("CRASH"); });
page.on("close", () => console.log("PAGE CLOSED"));
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("NAV", f.url()); });
const watchdog = setTimeout(() => { console.error("QA wall timeout"); void browser.close(); }, 720000);
const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log(JSON.stringify({ name, passed, detail })); };
let frame = 0;
const shot = async (label) => { await page.screenshot({ path: `${out}/frames/${String(++frame).padStart(2, "0")}-${label}.png`, timeout: 120000 }); };

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  for (const key of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(key, "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "google-antigravity", model: "gemini-3.8-flash", piApply: "auto", piTeam: false }));
  const original = window.fetch.bind(window);
  const qa = window.__mapRunQa = { t0: performance.now(), runs: [], acks: [] };
  const now = () => Math.round(performance.now() - qa.t0);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = async (init) => {
    const stream = new Response(init.body).body;
    return JSON.parse(await new Response(new Headers(init.headers).get("content-encoding") === "gzip" ? stream.pipeThrough(new DecompressionStream("gzip")) : stream).text());
  };
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/chat/completions")) {
      await sleep(500);
      const content = JSON.stringify({ mode: "modify", space: "outdoor", tools: [], needsPlan: false, targetMapId: null, summary: "칸 칠하기" });
      return new Response(JSON.stringify({ id: "qa", object: "chat.completion", model: "scripted", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/v1/agent/checkpoint")) {
      const ack = await read(init);
      qa.acks.push({ id: ack.checkpointId, ok: ack.ok, issue: ack.issue ?? null, at: now() });
      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    }
    if (!url.includes("/v1/agent/run")) return original(input, init);
    const request = await read(init);
    // 클라이언트는 이미 보낸 무거운 키를 해시만 보낸다 — 실제 워커처럼 받아 둔 사본을 쓴다.
    Object.assign(qa.blobs ??= {}, request.heavyBlobs ?? {});
    for (const [key, hash] of Object.entries(request.heavy ?? {})) request.project[key] = JSON.parse(qa.blobs[hash]);
    const mapId = request.currentMapId ?? request.mapIds?.[0] ?? request.project.startMapId;
    // 실행마다 다른 칸 줄·다른 타일 — 끝에 셋 다 남았는지 본다.
    const index = qa.runs.length;
    const run = { index, mapId, startedAt: now(), endedAt: null, row: 2 + index * 2, tile: 7 + index };
    qa.runs.push(run);
    return new Response(new ReadableStream({ async start(controller) {
      const write = (event) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
      const project = request.project;
      const wireBase = { ...project };
      // 실제 워커처럼 무거운 키(타일셋·DB·자산)는 그대로면 빼고 보낸다 — 세 실행이 프로젝트 통째를 주고받으면 렌더러가 죽는다.
      const { slimProjectForWire, slimDoneEvent } = await import("/src/ai/piAgent/protocol.ts");
      write({ type: "start", provider: "scripted", model: "scripted", toolCount: 1 });
      write({ type: "turn", index: 1 });
      await sleep(600);
      write({ type: "assistant", text: `${project.maps[mapId]?.name ?? mapId} 의 ${run.row}번째 줄을 칠할게요.` });
      await sleep(400);
      write({ type: "tool_start", id: `paint-${index}`, name: "paint_rect", args: { mapId } });
      // A 는 길게 — 느린 상자에서도 B·C 를 보낼 때까지 돌고 있게.
      await sleep(index === 0 ? 12000 : 2600);
      const map = project.maps[mapId];
      const lowerTiles = map.lowerTiles.slice();
      for (let x = 1; x < Math.min(map.width - 1, 9); x++) lowerTiles[run.row * map.width + x] = run.tile;
      project.maps = { ...project.maps, [mapId]: { ...map, lowerTiles } };
      const id = `paint-${index}`;
      const slim = slimProjectForWire(wireBase, project);
      write({ type: "checkpoint", checkpointId: id, label: "칸 칠하기", toolName: "paint_rect", project: slim.project, unchangedKeys: slim.unchangedKeys, unchangedTilesetIds: slim.unchangedTilesetIds });
      while (!qa.acks.some((a) => a.id === id)) await sleep(50);
      write({ type: "tool_end", id, name: "paint_rect", ok: true, summary: `${run.row}번째 줄 칠함`, durationMs: 2600 });
      await sleep(1800);
      write({ type: "assistant", text: `${run.row}번째 줄을 칠했어요.` });
      write(slimDoneEvent({ type: "done", project, stats: { ms: 5400, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps"] }, wireBase));
      run.endedAt = now();
      controller.close();
    } }), { headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": request.runId } });
  };
});

const goMap = (mapId) => page.evaluate(async (id) => {
  const { editorState } = await import("/src/editor/editorState.ts");
  editorState.set({ currentMapId: id });
}, mapId);
const send = async (text) => {
  await page.getByTestId("ai-input").fill(text);
  await page.getByTestId("ai-send").click();
};
const runs = () => page.evaluate(() => window.__mapRunQa.runs);

try {
  await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.getByTestId("ai-input").waitFor({ timeout: 300000 });
  // 두 번째 맵을 만들고 참고문서를 빼 둔다(대본 전송은 프로젝트를 통째로 싣는다).
  const maps = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const current = store.getCurrent();
    const first = current.startMapId;
    const second = `${first}_qa2`;
    const tilesets = Object.fromEntries(Object.entries(current.tilesets).map(([id, t]) => [id, { ...t, referenceDocuments: [] }]));
    const map = current.maps[first];
    store.replace({ ...current, tilesets, maps: { ...current.maps, [first]: { ...map, name: "첫째 맵" }, [second]: { ...map, id: second, name: "둘째 맵" } } },
      { change: { label: "QA maps", source: "qa" } });
    return { first, second };
  });
  await goMap(maps.first);
  await page.waitForTimeout(2500);

  await send("2번째 줄을 칠해 줘");
  await page.waitForFunction(() => window.__mapRunQa.runs.length >= 1, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  await shot("a-running");

  await goMap(maps.second);
  await page.waitForTimeout(600);
  await send("4번째 줄을 칠해 줘");
  await page.waitForFunction(() => window.__mapRunQa.runs.length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await shot("b-running-alongside");

  await goMap(maps.first);
  await page.waitForTimeout(500);
  await send("6번째 줄을 칠해 줘");
  await page.waitForTimeout(500);
  const waitingCard = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ai-map-run-card"]')].map((c) => ({ state: c.dataset.state, status: c.querySelector(".ai-map-run-status")?.textContent, map: c.querySelector(".ai-map-run-map")?.textContent })));
  await shot("c-waiting");
  const bVisibleWhileC = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ai-map-run-card"]')].filter((c) => c.offsetParent !== null).map((c) => c.querySelector(".ai-map-run-map")?.textContent));

  await page.waitForFunction(() => window.__mapRunQa.runs.length >= 3 && window.__mapRunQa.runs.every((r) => r.endedAt !== null), null, { timeout: 120000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="ai-map-run-card"]')].every((c) => c.dataset.state !== "running" && c.dataset.state !== "waiting"), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot("all-done");

  const r = await runs();
  const acks = await page.evaluate(() => window.__mapRunQa.acks);
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ai-map-run-card"]')].map((c) => ({ state: c.dataset.state, status: c.querySelector(".ai-map-run-status")?.textContent, map: c.querySelector(".ai-map-run-map")?.textContent, steps: [...c.querySelectorAll(".ai-map-run-steps li")].map((li) => li.textContent) })));
  const tiles = await page.evaluate(async ({ runs }) => {
    const { store } = await import("/src/project/store.ts");
    const live = store.getCurrent();
    return runs.map((run) => { const map = live.maps[run.mapId]; return { mapId: run.mapId, row: run.row, want: run.tile, got: map.lowerTiles.slice(run.row * map.width + 1, run.row * map.width + 9) }; });
  }, { runs: r });
  const failedText = await page.evaluate(() => (document.body.textContent ?? "").includes("적용 실패") || (document.body.textContent ?? "").includes("진행 중인 응답이 끝난 뒤"));
  const strayLine = await page.evaluate(() => { const n = document.elementFromPoint(1200, 760); return n ? `${n.tagName}.${[...n.classList].join(".")} ${n.dataset.testid ?? ""} ← ${n.parentElement?.className ?? ""}` : null; });
  Object.assign(report, { maps, runs: r, acks, waitingCard, cards, tiles, bVisibleWhileC, strayLine });

  const [a, b, c] = r;
  check("B 는 다른 맵이라 A 가 도는 중에 바로 시작했다", a && b && b.mapId === maps.second && b.startedAt < a.endedAt, { a, b });
  check("C 는 A 와 같은 맵이라 「이 맵 앞에」 대기 카드로 섰다", waitingCard.some((w) => w.state === "waiting" && /이 맵 앞에/.test(w.status ?? "")), waitingCard);
  check("C 를 보낸 뒤에도 돌고 있는 B 카드가 접히지 않는다", bVisibleWhileC.includes("둘째 맵"), bVisibleWhileC);
  check("C 는 A 가 끝난 뒤에 시작했다", c && c.mapId === maps.first && c.startedAt >= a.endedAt, { a, c });
  check("체크포인트 셋 다 적용됐다", acks.length === 3 && acks.every((x) => x.ok), acks);
  check("세 실행의 칸이 모두 남았다(서로 덮지 않음)", tiles.every((t) => t.got.every((v) => v === t.want)), tiles);
  check("맵별 카드 둘이 끝남으로 닫혔다", cards.length === 2 && cards.every((x) => x.state === "done"), cards);
  check("거절·적용 실패 문구가 없다", !failedText);
  check("페이지 오류 없음", report.errors.length === 0, report.errors);
} catch (error) {
  report.failure = String(error?.message ?? error);
  report.runs = await runs().catch(() => null);
  report.cardText = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ai-map-run-card"]')].map((c) => c.textContent)).catch(() => null);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  clearTimeout(watchdog);
  await context.close();
  await browser.close();
  const video = readdirSync(`${out}/video`).find((f) => f.endsWith(".webm"));
  if (video) renameSync(`${out}/video/${video}`, `${out}/video/map-run-queue.webm`);
}
console.log(JSON.stringify(report.checks.map((c) => [c.name, c.passed]), null, 1));
