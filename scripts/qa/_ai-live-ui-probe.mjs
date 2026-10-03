#!/usr/bin/env node
// 조수 실시간 표시 실측 프로브 — 실제 편집기 + 실제 모델로 한 턴을 돌리며
// ① 전송 스트림(NDJSON) 도착 시각 ② 밑그림(고스트) 상태 변화 ③ 화면 요소(작업 띠·로그) 변화를
// 같은 시계(performance.now)로 기록하고, 일정 간격으로 스크린샷을 찍는다.
//
// 목적: 「조수가 뭘 하는지 실시간으로 보이는가」를 감이 아니라 타임라인으로 판정한다.
//   - 도구가 끝난 뒤 화면에 뭔가 바뀌기까지 몇 ms 인가
//   - 턴 내내 화면이 «정지» 해 보이는 구간이 얼마나 긴가
//   - 밑그림이 캔버스에 실제로 칠해지는가(셀 수·맵 id 가 지금 보는 맵과 같은가)
//
//   QA_BASE_URL=http://127.0.0.1:9866 node scripts/qa/_ai-live-ui-probe.mjs --prompt "..." [--label x] [--shot-ms 1500]
// 증거: verify-shots/ai-live-ui/<label>/{timeline.json, shots/*.png}
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) args[token.slice(2)] = true;
  else { args[token.slice(2)] = next; i += 1; }
}
const base = String(args.base ?? process.env.QA_BASE_URL ?? "http://127.0.0.1:9866");
const prompt = String(args.prompt ?? "이 맵에 작은 마을을 만들어줘. 흙길이 가운데를 지나고, 집 세 채와 나무 몇 그루를 둬.");
const label = String(args.label ?? "run").replace(/[^a-z0-9_-]/gi, "");
const shotMs = Number(args["shot-ms"] ?? 1500);
const timeoutMs = Number(args["timeout-ms"] ?? 900_000);
const query = String(args.query ?? "blankProject=1");
const OUT = join(resolve(process.cwd()), "verify-shots", "ai-live-ui", label);
mkdirSync(join(OUT, "shots"), { recursive: true });
const log = (line) => process.stdout.write(`${line}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: !args.headed,
  args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--disable-dev-shm-usage", "--js-flags=--max-old-space-size=" + (args.heap ?? 4096) + "", "--enable-precise-memory-info"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ...(args.video ? { recordVideo: { dir: join(OUT, "video"), size: { width: 1600, height: 1000 } } } : {}) });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => { pageErrors.push(String(e.message).slice(0, 300)); log(`[pageerror] ${String(e.message).slice(0, 200)}`); });
page.on("crash", () => { pageErrors.push("CRASH"); log("[CRASH] renderer died"); });
const consoleLines = [];
page.on("console", (m) => { consoleLines.push(`${Date.now()} [${m.type()}] ${m.text().slice(0, 400)}`); });

// 전송 스트림을 페이지 안에서 갈라 읽는다(앱이 읽는 본문은 그대로 둔다).
await page.addInitScript(() => {
  const events = [];
  window.__probe = { events, t0: performance.now() };
  const push = (kind, data) => events.push({ t: Math.round(performance.now()), kind, ...data });
  const summarize = (ev) => {
    const out = { type: ev.type };
    if (ev.toolName) out.toolName = ev.toolName;
    if (ev.name) out.name = ev.name;
    if (ev.type === "agent_event" && ev.event) { out.agent = ev.agentId ?? ev.actor ?? null; Object.assign(out, { inner: summarize(ev.event) }); }
    if (ev.type === "map_delta") {
      const deltas = ev.deltas ?? ev.maps ?? ev.delta ?? null;
      try { out.bytes = JSON.stringify(ev).length; } catch { /* */ }
      if (Array.isArray(deltas)) out.maps = deltas.map((d) => d.mapId ?? d.id).slice(0, 5);
      else if (deltas && typeof deltas === "object") out.maps = Object.keys(deltas).slice(0, 5);
    }
    if (ev.type === "assistant" || ev.type === "text") out.text = String(ev.text ?? "").slice(0, 120);
    if (ev.type === "tool_end") { out.ok = ev.ok ?? ev.result?.ok ?? null; out.ms = ev.durationMs ?? null; out.visuals = Array.isArray(ev.visuals) ? ev.visuals.length : 0; }
    if (ev.type === "tool_start" && ev.args) { try { out.args = JSON.stringify(ev.args).slice(0, 160); } catch { /* */ } }
    if (ev.type === "checkpoint") out.label = ev.label;
    if (ev.type === "done") out.stats = ev.stats ?? null;
    if (ev.type === "error") out.error = String(ev.error ?? ev.message ?? "").slice(0, 200);
    return out;
  };
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    const watched = /\/v1\/agent\/run|\/v1\/chat\/completions|\/v1\/agent\//.test(url);
    if (!watched) return origFetch(input, init);
    const path = url.replace(/^https?:\/\/[^/]+/, "").slice(0, 80);
    push("fetch-start", { path });
    const response = await origFetch(input, init);
    push("fetch-head", { path, status: response.status });
    if (!/agent\/run/.test(url) || !response.body) return response;
    const [mine, theirs] = response.body.tee();
    (async () => {
      const reader = mine.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ done: true }));
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try { push("ndjson", summarize(JSON.parse(line))); } catch { push("ndjson-bad", { len: line.length }); }
        }
      }
      push("stream-end", { path });
    })();
    return new Response(theirs, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
});

var t0 = 0;
const record = { base, prompt, label, startedAt: new Date().toISOString(), shots: [], samples: [], ghost: [], events: [], pageErrors, error: null };

try {
  if (args["live-canvas"]) await page.addInitScript(() => { try { localStorage.setItem("oprn:ai-live-canvas", "on"); } catch { /* */ } });
  await page.goto(`${base}/?${query}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => typeof window.__oprnAiBridge?.status === "function" && window.__oprnAiBridge.status().panelMounted === true, null, { timeout: 180_000 });
  log("editor ready");
  // 부팅 직후 한가한 틈에 무거운 키 해시 예열(heavyWire.warmHeavyWire)이 돈다. 그 사이에 보내면 예열 글과 전송 준비가
  // 겹쳐 4GB 힙을 넘길 수 있다(2026-10-03 실측) — 화면 연출을 재는 프로브는 예열이 끝난 뒤 보낸다.
  await sleep(Number(args["settle-ms"] ?? 25000));
  // 밑그림 모듈은 vite dev 에서 같은 인스턴스를 import 로 얻는다.
  await page.evaluate(async () => {
    const ghost = await import("/src/editor/agentGhostPreview.ts");
    const es = await import("/src/editor/editorState.ts");
    const store = window.__probe;
    store.ghost = [];
    ghost.subscribeAgentGhostPreview((s) => {
      store.ghost.push({
        t: Math.round(performance.now()),
        rev: s.revision,
        previews: s.previews.length,
        cells: s.previews.reduce((n, p) => n + p.cells.length, 0),
        maps: [...new Set(s.previews.map((p) => p.mapId))],
        running: s.runningToolName,
        runningMap: s.runningToolMapId,
      });
    });
    store.samples = [];
    const strip = () => document.querySelector("[data-testid='ai-work-strip'], .ai-work-strip");
    store.sampler = setInterval(() => {
      const st = window.__oprnAiBridge?.status?.() ?? {};
      const s = strip();
      const cards = s ? s.querySelectorAll("[data-testid='ai-work-card']") : [];
      const lastCard = cards.length ? cards[cards.length - 1] : null;
      const ghostState = ghost.getAgentGhostPreviewState();
      const canvas = document.querySelector("canvas");
      store.samples.push({
        t: Math.round(performance.now()),
        busy: st.turnBusy ?? null,
        lastStatus: st.lastStatus ?? null,
        stripVisible: Boolean(s && s.getBoundingClientRect().height > 0 && getComputedStyle(s).display !== "none"),
        cards: cards.length,
        lastCardText: lastCard ? lastCard.innerText.replace(/\s+/g, " ").slice(0, 160) : null,
        ghostCells: ghostState.previews.reduce((n, p) => n + p.cells.length, 0),
        ghostMaps: [...new Set(ghostState.previews.map((p) => p.mapId))],
        running: ghostState.runningToolName,
        currentMap: (es.editorState.get?.() ?? es.editorState.state ?? es.editorState.snapshot?.())?.currentMapId ?? null,
        canvasW: canvas ? canvas.width : 0,
        buildChip: document.querySelector("[data-testid='ai-construction-chip']")?.textContent ?? null,
        wideOpen: Boolean(document.querySelector(".ai-assistant-wide-backdrop")),
        imgs: document.querySelectorAll("[data-testid='ai-panel'] img, .ai-work-strip img").length,
      });
    }, 250);
  });

  t0 = await page.evaluate(() => Math.round(performance.now()));
  await page.screenshot({ path: join(OUT, "shots", "0000-before.png") });
  // 사용자가 쓰는 길 그대로: 입력창에 치고 보내기 단추를 누른다(브리지 send 는 옛 세션 경로 sendText 로 간다).
  await page.fill("[data-testid='ai-input']", prompt);
  await page.evaluate(() => window.__probe.events.push({ t: Math.round(performance.now()), kind: "click-send" }));
  void page.click("[data-testid='ai-send']", { timeout: 120_000 }).catch((e) => log(`click failed ${e.message}`));
  const started = Date.now();
  let sawBusy = false;
  let endAt = null;
  let n = 1;
  while (Date.now() - started < timeoutMs) {
    const now = await page.evaluate(() => {
      const p = window.__probe;
      const take = (k) => { const a = p[k] ?? []; const out = a.splice(0, a.length); return out; };
      return { t: Math.round(performance.now()), busy: window.__oprnAiBridge?.status?.()?.turnBusy ?? null, heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), events: take("events"), ghost: take("ghost"), samples: take("samples") };
    }).catch(() => null);
    if (now) { record.events.push(...now.events); record.ghost.push(...now.ghost); record.samples.push(...now.samples); record.heap = record.heap ?? []; record.heap.push({ t: now.t, mb: now.heapMB }); writeFileSync(join(OUT, "timeline.json"), JSON.stringify({ ...record, t0 }, null, 1)); }
    if (!now) { log("evaluate failed (renderer?)"); break; }
    const name = `${String(n).padStart(4, "0")}-t${now.t - t0}.png`;
    await page.screenshot({ path: join(OUT, "shots", name) }).catch(() => undefined);
    record.shots.push({ file: name, t: now.t, busy: now.busy });
    n += 1;
    // 「그래픽 선택」 관문: 추천 조합을 고르고 시작한다(사람 대신 한 번만).
    if (!record.choiceClickedAt) {
      const rec = page.locator("[data-testid='ai-creation-recommend']");
      if (await rec.count().catch(() => 0)) {
        await rec.first().click({ timeout: 5000 }).catch(() => undefined);
        await sleep(600);
        const start = page.getByRole("button", { name: /이 조합으로 .* 만들기/ });
        if (await start.count().catch(() => 0)) {
          await start.first().click({ timeout: 5000 }).catch((e) => log(`start click failed ${e.message}`));
          record.choiceClickedAt = now.t;
          record.events.push({ t: now.t, kind: "choice-start-clicked" });
          log(`clicked recommended combo at +${now.t - t0}ms`);
        }
      }
    }
    if (now.busy) sawBusy = true;
    if (sawBusy && now.busy === false && endAt === null) { endAt = Date.now(); log(`turn ended at +${Math.round((endAt - started) / 1000)}s`); }
    if (endAt && Date.now() - endAt > 6000) break;
    if (!sawBusy && Date.now() - started > 45_000) { record.error = "turn never became busy"; break; }
    if ((n % 5) === 0) log(`  … +${Math.round((Date.now() - started) / 1000)}s busy=${now.busy} heap=${now.heapMB}MB ev=${record.events.length} last=${JSON.stringify(record.events.at(-1) ?? null).slice(0, 140)}`);
    await sleep(shotMs);
  }
  record.t0 = t0;
  const panelText = await page.evaluate(() => document.querySelector("[data-testid='ai-panel']")?.innerText?.slice(-3000) ?? null);
  record.panelTail = panelText;
} catch (error) {
  record.error = String(error?.message ?? error);
  log(`FAILED ${record.error}`);
} finally {
  record.finishedAt = new Date().toISOString();
  writeFileSync(join(OUT, "console.log"), consoleLines.join("\n"));
  writeFileSync(join(OUT, "timeline.json"), `${JSON.stringify(record, null, 1)}\n`);
  log(`evidence: ${OUT}`);
  await context.close();
  await browser.close();
}
