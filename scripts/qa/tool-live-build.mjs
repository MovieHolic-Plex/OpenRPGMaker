// 마을이 아닌 작은 쓰기 도구(paint_road → paint_tiles → stamp_object)도 맵 위에 실제 변경 순서대로 깔리는지(2026-10-04).
// 실제 편집기·실제 전송 버튼·실제 도구(브라우저 안 runTool)·실제 체크포인트 적용. village-live-build.mjs 의 틀을 그대로 쓴다.
// 모델만 대본이다: 의도 선언(/chat/completions)은 고정 JSON, Pi 실행(/v1/agent/run)은 NDJSON 대본.
// 라이브 모델 지연·저장 증거가 아니다 — 화면이 언제 무엇을 보여 주는지 재는 UI 시험이다.
//
//   BASE=http://127.0.0.1:<dev port> node scripts/qa/tool-live-build.mjs
// 증거 → verify-shots/tool-live-build/ (report.json, frames/*.png, video/*.webm)
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const base = process.env.BASE ?? "http://127.0.0.1:9880";
const before = false;
const out = process.env.OUT ?? "verify-shots/tool-live-build";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/frames`, { recursive: true });
mkdirSync(`${out}/video`, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--js-flags=--max-old-space-size=6144", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${out}/video`, size: { width: 1440, height: 900 } } });
const page = await context.newPage();
const videoStartWall = Date.now();
const report = { transport: "scripted model; native paint_road/paint_tiles/stamp_object + checkpoint apply", errors: [], checks: [], timeline: [] };
page.on("pageerror", (e) => report.errors.push(String(e.message).slice(0, 300)));
page.on("console", (m) => { if (m.text().startsWith("QA")) console.log(m.text()); });
const watchdog = setTimeout(() => { console.error("QA wall timeout"); void browser.close(); }, 600000);
const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log(JSON.stringify({ name, passed, detail })); };
let frame = 0;
const shot = async (label) => { const file = `${out}/frames/${String(++frame).padStart(2, "0")}-${label}.png`; await page.screenshot({ path: file, timeout: 120000 }); return file; };

// NOREVEAL=1: 실시간 시공 표시를 끈 대조군 — 연출이 적용·ACK 를 늦추는지 잰다.
if (process.env.NOREVEAL === "1") await page.addInitScript(() => { window.name = "noreveal"; });
// FOREIGN=1: 도구가 끝나고 체크포인트를 보내기 직전에 사람이 시작 맵 칸 하나를 고친다 — 3-way 병합이 둘 다 살리는지 본다.
if (process.env.FOREIGN === "1") await page.addInitScript(() => { window.__villageQaForeign = true; });
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  for (const key of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(key, "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "google-antigravity", model: "gemini-3.8-flash", piApply: "auto", piTeam: false }));
  if (window.name === "noreveal") localStorage.setItem("oprn:ai-live-canvas", "off"); else localStorage.removeItem("oprn:ai-live-canvas");
  const original = window.fetch.bind(window);
  const qa = window.__villageQa = { marks: {}, acks: 0, intentCalls: 0, stage: "boot" };
  const mark = (name) => { if (!(name in qa.marks)) { qa.marks[name] = performance.now() - (qa.sentAt ?? 0); (qa.wall ??= {})[name] = Date.now(); } };
  qa.mark = mark;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = async (init) => {
    const stream = new Response(init.body).body;
    return JSON.parse(await new Response(new Headers(init.headers).get("content-encoding") === "gzip" ? stream.pipeThrough(new DecompressionStream("gzip")) : stream).text());
  };
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/chat/completions")) {
      qa.intentCalls++; mark(`model-call-${qa.intentCalls}`);
      try { const body = JSON.parse(typeof init.body === "string" ? init.body : await new Response(init.body).text()); (qa.calls ??= []).push(String(body.messages?.[0]?.content ?? "").slice(0, 160)); } catch { (qa.calls ??= []).push("?"); }
      await sleep(900);
      mark("intent-reply"); const content = JSON.stringify({ mode: "modify", space: "outdoor", tools: ["paint_road", "paint_tiles", "stamp_object"], needsPlan: false, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], summary: "길·광장·집 하나" });
      return new Response(JSON.stringify({ id: "qa", object: "chat.completion", model: "scripted", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/v1/agent/checkpoint")) {
      await read(init); qa.acks++; mark(`ack-${qa.acks}`);
      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    }
    if (!url.includes("/v1/agent/run")) return original(input, init);
    mark("run-request-sent");
    const request = await read(init); mark("run-request-decoded(대본 비용)");
    for (const [key, hash] of Object.entries(request.heavy ?? {})) request.project[key] = JSON.parse(request.heavyBlobs[hash]);
    return new Response(new ReadableStream({ async start(controller) {
      const write = (event) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
      const { runTool } = await import("/src/editor/tools/toolRunner.ts");
      const { prepareTool } = await import("/src/editor/tools/asyncToolRunner.ts");
      const { exportSpatialToolProof } = await import("/src/editor/tools/spatialToolState.ts");
      const { withConstructionLog, synthesizeToolConstructionLogs } = await import("/src/editor/tools/constructionLog.ts");
      // 실제 워커처럼 안 바뀐 무거운 키(타일셋·DB·에셋)는 빼고 보낸다 — 체크포인트마다 프로젝트 전체를 실으면 렌더러가 버티지 못한다.
      const { slimProjectForWire } = await import("/src/ai/piAgent/protocol.ts");
      const origin = request.project;
      const mapId = request.project.startMapId;
      const ctx = { project: request.project, currentMapId: mapId };
      const map0 = ctx.project.maps[mapId];
      qa.mapSize = [map0.width, map0.height];
      write({ type: "start", provider: "scripted", model: "scripted", toolCount: 4 });
      // 실제 워커(toolAdapter)와 같은 길: 쓰기 도구를 기록기로 감싸고, 기록이 없으면 실제 변경으로 기록을 만든다.
      const step = async (id, name, args, say) => {
        write({ type: "turn", index: ++qa.turns });
        await sleep(500);
        write({ type: "assistant", text: say });
        await sleep(400);
        write({ type: "tool_start", id, name, args });
        console.log(`QA tool_start ${name}`);
        const before = ctx.project;
        await prepareTool(name, args, ctx.project);
        const started = Date.now();
        const { value: result, logs } = withConstructionLog(name, () => runTool(ctx, name, args, { dryRun: false }));
        if (!result.ok) { qa.stage = `${name}: ${JSON.stringify(result).slice(0, 300)}`; throw Error(qa.stage); }
        const constructionLogs = [...logs, ...synthesizeToolConstructionLogs(name, before, ctx.project, logs, Date.now() - started)];
        (qa.tools ??= []).push({ name, steps: constructionLogs.flatMap((l) => l.steps.map((s) => `${s.kind}:${s.cells.length}`)), synthetic: constructionLogs.every((l) => l.synthetic) });
        await sleep(300);
        const ackTarget = qa.acks + 1;
        const wire = slimProjectForWire(origin, ctx.project);
        write({ type: "checkpoint", checkpointId: id, label: name, toolName: name, project: wire.project, unchangedKeys: wire.unchangedKeys,
          ...(wire.unchangedTilesetIds.length ? { unchangedTilesetIds: wire.unchangedTilesetIds } : {}), spatialProof: exportSpatialToolProof(ctx.project), constructionLogs });
        mark(`checkpoint-${id}`);
        console.log(`QA checkpoint ${name} ${JSON.stringify(qa.tools.at(-1))}`);
        while (qa.acks < ackTarget) await sleep(50);
        console.log(`QA ack ${name}`);
        write({ type: "tool_end", id, name, ok: true, summary: result.summary, durationMs: 400 });
        while (document.documentElement.dataset.aiConstructionReveal === "playing") await sleep(100);
        await sleep(600);
        return result;
      };
      qa.turns = 0;
      try {
      const W = map0.width, H = map0.height, cy = Math.floor(H / 2);
      await step("road", "paint_road", { mapId, style: "dirt", naturalness: 0, points: [{ x: 1, y: cy }, { x: W - 2, y: cy }] }, "가운데로 흙길을 하나 낼게요.");
      // 광장·집은 시작 위치(통행 검사 대상)를 비켜 놓는다.
      const sx = ctx.project.startPos?.x ?? Math.floor(W / 2);
      const px = sx < W / 2 ? Math.floor(W * 3 / 4) : Math.floor(W / 4);
      const roadTile = ctx.project.maps[mapId].lowerTiles[cy * W + px];
      await step("plaza", "paint_tiles", { mapId, layer: "1", mode: "rect", tile: roadTile, from: { x: Math.max(1, px - 4), y: cy - 3 }, to: { x: Math.min(W - 2, px + 4), y: cy + 3 } }, "길 가운데를 넓혀 작은 광장을 만들게요.");
      console.log("QA listing objects");
      const list = runTool(ctx, "list_spatial_designs", { kind: "object" });
      console.log(`QA listed ${list.ok} ${(list.data?.shared?.rows ?? []).length}`);
      const rows = list.data?.shared?.rows ?? [];
      const house = rows.find((r) => String(r.id).startsWith("obj:house")) ?? rows[0];
      qa.objectId = house?.id;
      if (house) await step("house", "stamp_object", { objectId: house.id, mapId, x: Math.max(0, px - 3), y: Math.max(0, cy - 9) }, "광장 북쪽에 집 한 채를 세울게요.");
      } catch (error) { qa.stage = `stream: ${String(error?.stack ?? error).slice(0, 600)}`; }
      write({ type: "assistant", text: "길·광장·집을 놓았어요." });
      const doneWire = slimProjectForWire(origin, ctx.project);
      write({ type: "done", project: doneWire.project, unchangedKeys: doneWire.unchangedKeys, ...(doneWire.unchangedTilesetIds.length ? { unchangedTilesetIds: doneWire.unchangedTilesetIds } : {}),
        stats: { ms: 9000, turns: qa.turns, toolCalls: 3, toolErrors: 0 }, changedKeys: ["maps"] });
      mark("done");
      controller.close();
    } }), { headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": request.runId } });
  };
  // 시공 연출과 조수창 변화를 시각과 함께 적는다.
  const observe = () => new MutationObserver(() => {
    const on = document.documentElement.dataset.aiConstructionReveal === "playing";
    if (on) mark("reveal-playing");
    else if (qa.revealOn) { qa.marks["reveal-ended"] = performance.now() - (qa.sentAt ?? 0); (qa.wall ??= {})["reveal-ended"] = Date.now(); } // 켜졌다 꺼진 마지막 때
    qa.revealOn = on;
    const step = document.documentElement.dataset.aiConstructionStep;
    if (step && (qa.steps ??= []).at(-1) !== step) qa.steps.push(step);
    if (document.querySelector('[data-testid="ai-creation-choice"]')) mark("CHOICE-UI-SHOWN");
    const text = document.querySelector(".ai-chat-panel, [data-testid=ai-chat-panel]")?.textContent ?? document.body.textContent ?? "";
    if (text.includes("맵에 반영 중")) mark("chat-applying-row");
    if (text.includes("“가운데로 흙길")) mark("chat-assistant-say-1");
    if (text.includes("맵에 반영됨")) mark("chat-applied-row");
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-ai-construction-reveal", "data-ai-construction-step"] });
  if (document.documentElement) observe(); else document.addEventListener("DOMContentLoaded", observe, { once: true });
});

try {
  await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("ai-input").waitFor({ timeout: 360000 });
  // 대본 전송은 실제 워커와 달리 체크포인트에 프로젝트 전체를 싣는다 — 렌더러 메모리를 아끼려고 참고문서만 뺀다.
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const current = store.getCurrent();
    const tilesets = Object.fromEntries(Object.entries(current.tilesets).map(([id, t]) => [id, { ...t, referenceDocuments: [] }]));
    store.replace({ ...current, tilesets }, { change: { label: "QA references trimmed", source: "qa" } });
  });
  await page.waitForTimeout(2500);
  await shot("before-send");
  await page.getByTestId("ai-input").fill("가운데 길이랑 광장, 집 하나 놔 줘");
    await page.evaluate(() => { window.__villageQa.sentAt = performance.now(); document.querySelector('[data-testid="ai-send"]').click(); });
  await page.waitForTimeout(250);
  await shot("sent");
  if (before) {
    await page.waitForFunction(() => !!document.querySelector('[data-testid="ai-creation-choice"]') || "assistant-1" in window.__villageQa.marks, null, { timeout: 90000 });
    if (await page.locator('[data-testid="ai-creation-choice"]').count()) {
      await page.evaluate(() => window.__villageQa.mark("choice-ui-shown"));
      await page.waitForTimeout(2500);
      await shot("choice-ui");
      await page.waitForTimeout(1500);
      await page.getByTestId("ai-creation-recommend").click();
      await page.waitForTimeout(800);
      await shot("choice-picked");
      await page.getByTestId("ai-creation-start").click();
      await page.evaluate(() => window.__villageQa.mark("choice-confirmed"));
    }
  }
  // 도구마다 재생을 따라 찍는다.
  const seen = new Set();
  const until = Date.now() + 240000;
  let i = 0;
  while (Date.now() < until && !(await page.evaluate(() => "done" in window.__villageQa.marks))) {
    const step = await page.evaluate(() => document.documentElement.dataset.aiConstructionReveal === "playing" ? (document.documentElement.dataset.aiConstructionStep ?? "?") : null);
    if (step && !seen.has(step)) { seen.add(step); await shot(`reveal-${String(++i).padStart(2, "0")}`); }
    else if (step && i % 2 === 0) { await shot(`reveal-${String(++i).padStart(2, "0")}`); }
    else await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => !window.__oprnAiBridge?.status?.().turnBusy, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot("finished");
  const qa = await page.evaluate(() => ({ marks: window.__villageQa.marks, steps: window.__villageQa.steps ?? [], tools: window.__villageQa.tools, objectId: window.__villageQa.objectId, mapSize: window.__villageQa.mapSize }));
  report.videoAt = Object.fromEntries(Object.entries(await page.evaluate(() => window.__villageQa.wall ?? {})).map(([k, v]) => [k, Math.round((v - videoStartWall) / 100) / 10]));
  report.stage = await page.evaluate(() => window.__villageQa.stage);
  report.tools = qa.tools; report.objectId = qa.objectId; report.mapSize = qa.mapSize; report.shownSteps = qa.steps;
  report.timeline = Object.entries(qa.marks).map(([name, ms]) => ({ name, ms: Math.round(ms) })).sort((a, b) => a.ms - b.ms);
  check("도구마다 실제 변경 기록이 만들어졌다(합성)", (qa.tools ?? []).length >= 3 && qa.tools.every((t) => t.steps.length && t.synthetic), qa.tools);
  check("맵 위 재생이 돌았다", "reveal-playing" in qa.marks, qa.steps);
  check("도구마다 재생 단계가 보였다", ["paint_road", "paint_tiles", "stamp_object"].every((n) => qa.steps.some((t) => t.includes(n))), qa.steps);
  check("페이지 오류 없음", report.errors.length === 0, report.errors);
} catch (error) {
  report.failure = String(error?.message ?? error);
  report.stage = await page.evaluate(() => window.__villageQa?.stage).catch(() => "?");
  await shot("failure").catch(() => {});
  console.error(report.failure, report.stage);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  clearTimeout(watchdog);
  await context.close();
  await browser.close();
  const video = readdirSync(`${out}/video`).find((f) => f.endsWith(".webm"));
  if (video) renameSync(`${out}/video/${video}`, `${out}/video/tool-live-build.webm`);
}
console.log(JSON.stringify({ timeline: report.timeline, checks: report.checks.map((c) => [c.name, c.passed]) }, null, 1));
