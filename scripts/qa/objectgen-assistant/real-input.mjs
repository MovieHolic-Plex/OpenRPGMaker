// 없는 기물 그리기 — 실제 입력창 경로 시험(2026-10-22, 크기 결정·큰 물건).
//
//   BASE=http://127.0.0.1:<dev 포트> PROJECT=<프로젝트 JSON> MAP=<맵 id> CASES=<cases.json> OUT=<증거 폴더> \
//   OBJECTGEN_REF_URL=<b64json 그림 경로> node scripts/qa/objectgen-assistant/real-input.mjs
//
// - 조수: 실제 입력창(ai-input → ai-send) → 동반 서비스 /v1/agent/run → Pi 워커의 local-cli:claude(조수 엔진 설정,
//   ASSISTANT_MODEL 기본 sonnet = Sonnet 5.5 high — Argon 대역). 도구 카드·알아서 고르기·후속 요청·놓기까지 제품 경로 그대로.
// - 공방 그리기·검수(사용자 계정 대역): dev 빌드의 window.__oprnWorkshopChat → `claude -p --model $RELAY_MODEL`(기본 Opus 5.5 medium).
// - 참고 그림: window.__oprnWorkshopImage(prompt, 견본) → OBJECTGEN_REF_URL(fallback:false, 모델 칸 없음, 견본은 reference_b64).
// cases.json: [{ id, prompt }] — 칸 수는 말하지 않는다(조수·도구가 정한다).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9866";
const out = resolve(process.env.OUT ?? "/tmp/ogf/run/evidence");
mkdirSync(out, { recursive: true });
const cases = JSON.parse(readFileSync(process.env.CASES, "utf8"));
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const relayLog = resolve(out, "relay-log.jsonl");
const relayModel = process.env.RELAY_MODEL ?? "claude-opus-5-5";
const effort = process.env.RELAY_EFFORT ?? "medium";
// netns 안에서는 바깥 그림 경로를 루프백 다리(127.0.0.1:8091)로 잇는다 — 주소의 호스트만 바꾼다.
const refUrl = (process.env.OBJECTGEN_REF_URL ?? "").replace(/^(https?:\/\/)[^/:]+(:8091)/u, process.env.REF_LOOPBACK ? "$1127.0.0.1$2" : "$&");
const log = (...args) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${args.join(" ")}`; console.log(line); appendFileSync(resolve(out, "run.log"), line + "\n"); };

async function referenceImage(prompt, image) {
  if (!refUrl) return null;
  if (/duckcoding|api\.openai\.com|openai\.azure\.com|replicate\.com|fal\.run|generativelanguage\.googleapis\.com/i.test(refUrl)) throw new Error("유료 그림 경로는 쓰지 않는다");
  const started = Date.now();
  const anchor = typeof image === "string" ? image.split(",")[1] : undefined;
  const response = await fetch(refUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, size: "1024x1024", return_base64: true, fallback: false, ...(anchor ? { reference_b64: anchor } : {}) }), signal: AbortSignal.timeout(600_000) });
  if (!response.ok) throw new Error(`그림 경로 HTTP ${response.status}`);
  const answer = await response.json();
  if ((answer.fallback_used && answer.fallback_used !== "false") || /duck/i.test(String(answer.engine ?? ""))) throw new Error("유료 대체 엔진의 그림 — 버렸다");
  appendFileSync(relayLog, JSON.stringify({ at: new Date().toISOString(), surface: "reference-image", ms: Date.now() - started, engine: answer.engine ?? null, anchor: Boolean(anchor), promptChars: prompt.length }) + "\n");
  return answer.image_b64 ? `data:${answer.mime ?? "image/png"};base64,${answer.image_b64}` : null;
}

function relay(surface, raw) {
  const request = JSON.parse(raw);
  const system = request.messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("\n"))).join("\n\n");
  const blocks = [];
  for (const message of request.messages.filter((m) => m.role !== "system")) {
    const prefix = message.role === "assistant" ? "[너의 지난 답]\n" : blocks.length ? "[사용자]\n" : "";
    const parts = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    let first = true;
    for (const part of parts) {
      if (part.type === "text") blocks.push({ type: "text", text: (first ? prefix : "") + part.text });
      else if (part.type === "image_url") {
        const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(part.image_url.url);
        if (match) blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
      }
      first = false;
    }
  }
  blocks.push({ type: "text", text: "JSON 객체 하나만 답하라. 코드 울타리·설명 글 없이." });
  const started = Date.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn("claude", ["-p", "--bare", "--model", relayModel, "--effort", effort, "--system-prompt", system || "JSON 하나만 답한다.",
      "--tools", "", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--no-session-persistence"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      const result = stdout.trim().split("\n").map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean).find((e) => e.type === "result");
      const text = String(result?.result ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      appendFileSync(relayLog, JSON.stringify({ at: new Date().toISOString(), surface, ms: Date.now() - started, code, model: Object.keys(result?.modelUsage ?? {})[0] ?? null, images: blocks.filter((b) => b.type === "image").length, answerChars: text.length, error: result?.is_error ? result.result : (code ? stderr.slice(0, 300) : null) }) + "\n");
      if (code !== 0 || !result || result.is_error) reject(Object.assign(new Error(`relay 실패: ${String(result?.result ?? stderr).slice(0, 200)}`), { status: 500 }));
      else resolvePromise(text);
    });
    child.stdin.end(JSON.stringify({ type: "user", message: { role: "user", content: blocks } }) + "\n");
  });
}

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--use-gl=swiftshader", "--js-flags=--max-old-space-size=8192"] });
browser.on("disconnected", () => log("browser disconnected"));
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(180_000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("crash", () => log("PAGE CRASH"));
page.on("close", () => log("page closed"));
page.on("console", (m) => { if (m.type() === "error") appendFileSync(resolve(out, "console.log"), m.text().slice(0, 400) + "\n"); });
await page.exposeFunction("__ogRelay", relay);
await page.exposeFunction("__ogImage", referenceImage);
await page.addInitScript(({ engine }) => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, piTeam: false, piApply: "default", piApplyPolicyVersion: 1 }));
  localStorage.setItem("oprn:assistant-engine", JSON.stringify(engine));
  localStorage.setItem("oprn:assistant-objectgen-autopick", "1");
  window.__oprnWorkshopChat = (surface, request) => window.__ogRelay(surface, JSON.stringify({ messages: request.messages, temperature: request.temperature }));
  window.__oprnWorkshopImage = (prompt, image) => window.__ogImage(prompt, image);
  window.__capEvents = [];
  const original = window.fetch;
  window.fetch = async function (...args) {
    const response = await original.apply(this, args);
    if (String(args[0]).includes("/v1/agent/run") && response.body) {
      window.__capEvents.push({ type: "stream_open", at: Date.now() });
      const reader = response.clone().body.getReader(), decoder = new TextDecoder(); let pending = "";
      const consume = (line) => { try {
        const outer = JSON.parse(line.replace(/^data:\s*/, "")), event = outer.type === "agent_event" ? outer.event : outer;
        if (["assistant", "tool_start", "tool_end", "error", "done", "cancelled"].includes(event?.type)) {
          window.__capEvents.push({ type: event.type, name: event.name ?? event.toolName, ok: event.ok, text: event.type === "assistant" ? event.text : undefined, summary: event.summary, message: event.message, args: event.args, at: Date.now() });
        }
        if (outer.type === "done" && event.type !== "done") window.__capEvents.push({ type: "done", at: Date.now() });
      } catch { /* not json */ } };
      void (async () => { try { for (;;) { const { done, value } = await reader.read(); if (done) break;
        pending += decoder.decode(value, { stream: true }); const lines = pending.split("\n"); pending = lines.pop(); for (const line of lines) consume(line); }
        if (pending.trim()) consume(pending); window.__capEvents.push({ type: "stream_closed", at: Date.now() });
      } catch (error) { window.__capEvents.push({ type: "stream_error", message: error.message, at: Date.now() }); } })();
    }
    return response;
  };
}, { engine: { kind: "local-cli", cli: "claude", routineModel: process.env.ASSISTANT_MODEL ?? "sonnet", deepModel: process.env.ASSISTANT_MODEL ?? "sonnet", effort: "high" } });
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__oprnEditorStore), null, { timeout: 900_000 });
log("store up");
const mapId = process.env.MAP ?? "map_blank_start";
await page.waitForTimeout(15000);
// 72MB 프로젝트 JSON 을 넘기면 렌더러가 죽는다(2026-10-22 실측) — 빈 프로젝트의 시작 맵을 그 자리에서 넓힌다(MAP_W×MAP_H, 같은 바닥 칸).
await page.evaluate(async ({ mapId, w, h, name }) => {
  window.__oprnEditorStore.update((draft) => {
    const map = draft.maps[mapId];
    const ground = map.lowerTiles[0];
    map.width = w; map.height = h; map.name = name;
    map.lowerTiles = new Array(w * h).fill(ground);
    map.upperTiles = new Array(w * h).fill(-1);
    delete map.extraLayers;
  });
  const { editorState } = await import("/src/editor/editorState.ts");
  editorState.set({ currentMapId: mapId });
}, { mapId, w: Number(process.env.MAP_W ?? 36), h: Number(process.env.MAP_H ?? 26), name: process.env.MAP_NAME ?? "시장 광장" });
log("project loaded");
await page.waitForTimeout(3000);
for (let i = 0; ; i++) {
  if (await page.getByTestId("ai-input").isVisible().catch(() => false)) break;
  for (const id of ["editor-welcome-skip", "ai-collapsed-restore"]) {
    const node = page.getByTestId(id);
    if (await node.isVisible().catch(() => false)) await node.click().catch(() => {});
  }
  if (i === 100) { await page.screenshot({ path: resolve(out, "boot-fail.png") }); throw new Error("ai-input not visible"); }
  await page.waitForTimeout(3000);
}
log("editor ready");

const writeDataUrl = (path, dataUrl) => writeFileSync(path, Buffer.from(dataUrl.split(",")[1], "base64"));
const workshopKits = () => page.evaluate((mapId) => {
  const project = window.__oprnEditorStore.getCurrent();
  const tileset = project.tilesets[project.maps[mapId].tilesetId];
  return (tileset.structureKits ?? []).filter((kit) => kit.id.startsWith("workshop:")).map((kit) => kit.id);
}, mapId);

async function dumpRound(harnessId, file) {
  const dump = await page.evaluate(async ({ harnessId }) => {
    const { getWorkshopSession } = await import("/src/editor/workshop/workshopSession.ts");
    const { gridDataUrl } = await import("/src/editor/workshop/pixels.ts");
    const session = await getWorkshopSession(harnessId);
    await session.reload();
    const round = [...session.rounds].sort((a, b) => b.created - a.created)[0];
    if (!round) return null;
    const item = session.items().find((candidate) => candidate.key === round.itemKey);
    const palette = item ? session.runner.palette(item) : null;
    return {
      id: round.id, itemKey: round.itemKey, picked: round.picked ?? null,
      item: item ? { title: item.title, description: item.description, width: item.width, height: item.height, padTop: item.padTop, footRows: item.footRows, risePx: item.risePx, kind: item.kind, passage: item.passage ?? null, footprintNote: item.footprintNote ?? null, refTop: item.refTop ?? null } : null,
      reference: round.reference ?? null,
      runs: round.runs.map((run) => ({
        letter: run.letter, status: run.status, verdict: run.verdict, error: run.error,
        png8: run.grid && palette ? gridDataUrl(run.grid, palette, 8, [150, 120, 90, 255]) : null,
        png1: run.grid && palette ? gridDataUrl(run.grid, palette, 1) : null,
      })),
    };
  }, { harnessId });
  writeFileSync(file, JSON.stringify(dump));
  return dump;
}

const doneCount = () => page.evaluate(() => window.__capEvents.filter((e) => e.type === "done" || e.type === "stream_closed").length);
const sendIdle = () => page.evaluate(() => { const b = document.querySelector('[data-testid="ai-send"]'); return Boolean(b) && !b.disabled; });

for (const job of cases) {
  if (only && !only.has(job.id)) continue;
  const started = Date.now();
  const before = new Set(await workshopKits());
  const eventStart = await page.evaluate(() => window.__capEvents.length);
  log(`== ${job.id}: ${job.prompt}`);
  const cardsBefore = await page.locator('[data-testid="ai-objectgen-card"]').count();
  await page.getByTestId("ai-input").fill(job.prompt);
  await page.getByTestId("ai-send").click();
  let kit = null, placedAt = 0, lastShot = 0, noCardSince = null, redrawn = false;
  const deadline = Date.now() + Number(process.env.CASE_TIMEOUT_MS ?? 45 * 60_000);
  while (Date.now() < deadline) {
    await page.waitForTimeout(5000);
    const kits = await workshopKits();
    const fresh = kits.filter((id) => !before.has(id));
    // 조수가 그리지 않고 끝낸 턴(있는 기물을 썼거나 거절) — 턴이 끝나고 2분 동안 새 카드가 없으면 다음 요청으로.
    if (!kit && Date.now() - started > 120_000 && await sendIdle() && await page.locator('[data-testid="ai-objectgen-card"]').count() === cardsBefore) {
      const ended = await page.evaluate((from) => window.__capEvents.slice(from).some((e) => e.type === "done" || e.type === "stream_closed"), eventStart);
      if (ended) { noCardSince ??= Date.now(); if (Date.now() - noCardSince > 120_000) { log(`${job.id}: turn ended without a drawing card`); break; } }
    }
    if (fresh.length && !kit) { kit = fresh.at(-1); log(`baked ${kit} after ${Math.round((Date.now() - started) / 1000)}s`); }
    if (!lastShot && await page.locator('[data-testid="ai-objectgen-card"]').count() && Date.now() - started > 60_000) {
      await page.locator('[data-testid="ai-objectgen-card"]').last().screenshot({ path: resolve(out, `${job.id}-card.png`) }).catch(() => {});
      lastShot = Date.now();
    }
    // 알아서 고르기가 통과 후보를 못 찾으면 사람이 고를 차례다 — 감독 대역이 다 그린 후보 중 첫 장을 고르고 기록한다(SUPERVISOR_PICK=1).
    if (!kit && process.env.SUPERVISOR_PICK === "1") {
      const waiting = await page.locator('[data-testid="ai-objectgen-card"]').last().locator('[role="status"]').textContent().catch(() => "");
      // 후보를 하나도 못 그렸으면(격자 줄 길이 깨짐 등) 사람처럼 「다시 그리기」를 한 번 누른다.
      if (/후보를 그리지 못했어요/u.test(waiting ?? "") && !redrawn) {
        redrawn = true;
        await page.locator('[data-testid="ai-objectgen-card"]').last().locator('[data-testid="ai-objectgen-redraw"]').click().catch(() => {});
        log("redraw pressed (no candidate drawn)"); appendFileSync(resolve(out, `${job.id}-redraw.txt`), new Date().toISOString() + "\n");
      }
      if (/통과한 후보가 없어/u.test(waiting ?? "")) {
        const pick = page.locator('[data-testid="ai-objectgen-card"]').last().locator('[data-testid="ai-objectgen-pick"]:not([disabled])').first();
        if (await pick.count()) { await pick.click().catch(() => pick.evaluate((el) => el.click())); log("supervisor pick (no candidate passed the blind review)"); appendFileSync(resolve(out, `${job.id}-supervisor-pick.txt`), new Date().toISOString() + "\n"); }
      }
    }
    if (kit) {
      const stamped = await page.evaluate(({ mapId, kit }) => {
        const project = window.__oprnEditorStore.getCurrent();
        const tileset = project.tilesets[project.maps[mapId].tilesetId];
        const k = tileset.structureKits.find((x) => x.id === kit);
        const ids = new Set(k.rows.flatMap((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])]).filter((id) => id >= 0));
        const map = project.maps[mapId];
        const hits = [];
        map.lowerTiles.forEach((id, i) => { if (ids.has(id)) hits.push(i); });
        map.upperTiles.forEach((id, i) => { if (ids.has(id)) hits.push(i); });
        for (const layer of map.extraLayers ?? []) (layer.tiles ?? []).forEach((id, i) => { if (ids.has(id)) hits.push(i); });
        return hits.length ? { cells: [...new Set(hits)].map((i) => [i % map.width, Math.floor(i / map.width)]) } : null;
      }, { mapId, kit });
      if (stamped && !placedAt) { placedAt = Date.now(); log(`placed ${kit} at ${JSON.stringify(stamped.cells.slice(0, 3))}…`); }
      if (placedAt && Date.now() - placedAt > 15_000 && await sendIdle()) break;
    }
  }
  const events = await page.evaluate((from) => window.__capEvents.slice(from), eventStart);
  writeFileSync(resolve(out, `${job.id}-events.json`), JSON.stringify(events, null, 1));
  const card = page.locator('[data-testid="ai-objectgen-card"]').last();
  if (await card.count()) await card.screenshot({ path: resolve(out, `${job.id}-card-final.png`) }).catch(() => {});
  const harness = await page.locator('[data-testid="ai-objectgen-card"]').last().getAttribute("data-harness").catch(() => "map-objects");
  const dump = await dumpRound(harness ?? "map-objects", resolve(out, `${job.id}-round.json`));
  if (dump?.reference?.dataUrl) writeDataUrl(resolve(out, `${job.id}-ref-0.png`), dump.reference.dataUrl);
  (dump?.reference?.more ?? []).forEach((m, n) => writeDataUrl(resolve(out, `${job.id}-ref-${n + 1}.png`), m.dataUrl));
  if (dump?.reference?.anchor) writeDataUrl(resolve(out, `${job.id}-anchor.png`), dump.reference.anchor);
  log(`${job.id}: kit=${kit} placed=${Boolean(placedAt)} ${Math.round((Date.now() - started) / 1000)}s, ref=${dump?.reference?.status}, runs=${dump?.runs?.map((r) => `${r.letter}:${r.status}/${r.verdict?.verdict ?? "-"}`).join(",")}`);
  try { writeFileSync(resolve(out, "project.json"), await page.evaluate(() => JSON.stringify(window.__oprnEditorStore.getCurrent()))); } catch (error) { log(`export failed: ${error.message}`); }
}
writeFileSync(resolve(out, "page-errors.json"), JSON.stringify(pageErrors, null, 1));
log("all done");
await browser.close();
