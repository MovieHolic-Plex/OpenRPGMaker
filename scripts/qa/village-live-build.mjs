// 「마을을 만들어다오」 한 문장 → 선택 창 없이 바로 시공 → 맵 위 시공 연출 → 조수창 반영 시각.
// 실제 편집기·실제 전송 버튼·실제 도구(author_beodeul_town 을 브라우저 안 runTool 로)·실제 체크포인트 적용.
// 모델만 대본이다: 의도 선언(/chat/completions)은 고정 JSON, Pi 실행(/v1/agent/run)은 NDJSON 대본.
// 라이브 모델 지연·저장 증거가 아니다 — 화면이 언제 무엇을 보여 주는지 재는 UI 시험이다.
//
//   BASE=http://127.0.0.1:<dev port> node scripts/qa/village-live-build.mjs
// 증거 → verify-shots/village-live-build/ (report.json, frames/*.png, video/*.webm)
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const base = process.env.BASE ?? "http://127.0.0.1:9880";
// BEFORE=1: 바꾸기 전 코드(origin/main)에 같은 대본을 돌려 비교 화면을 남긴다. 선택 창이 뜨면 4초 뒤 추천 조합으로 확정한다.
const before = process.env.BEFORE === "1";
const out = process.env.OUT ?? (before ? "verify-shots/village-live-build-before" : "verify-shots/village-live-build");
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/frames`, { recursive: true });
mkdirSync(`${out}/video`, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--js-flags=--max-old-space-size=6144", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${out}/video`, size: { width: 1440, height: 900 } } });
const page = await context.newPage();
const report = { transport: "scripted model; native author_beodeul_town + checkpoint apply", errors: [], checks: [], timeline: [] };
page.on("pageerror", (e) => report.errors.push(String(e.message).slice(0, 300)));
page.on("console", (m) => { if (m.text().startsWith("QA")) console.log(m.text()); });
const watchdog = setTimeout(() => { console.error("QA wall timeout"); void browser.close(); }, 300000);
const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log(JSON.stringify({ name, passed, detail })); };
let frame = 0;
const shot = async (label) => { const file = `${out}/frames/${String(++frame).padStart(2, "0")}-${label}.png`; await page.screenshot({ path: file, timeout: 120000 }); return file; };

// NOREVEAL=1: 실시간 시공 표시를 끈 대조군 — 연출이 적용·ACK 를 늦추는지 잰다.
if (process.env.NOREVEAL === "1") await page.addInitScript(() => { window.name = "noreveal"; });
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  for (const key of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(key, "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "google-antigravity", model: "gemini-3.8-flash", piApply: "auto", piTeam: false }));
  if (window.name === "noreveal") localStorage.setItem("oprn:ai-live-canvas", "off"); else localStorage.removeItem("oprn:ai-live-canvas");
  const original = window.fetch.bind(window);
  const qa = window.__villageQa = { marks: {}, acks: 0, intentCalls: 0, stage: "boot" };
  const mark = (name) => { if (!(name in qa.marks)) qa.marks[name] = performance.now() - (qa.sentAt ?? 0); };
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
      mark("intent-reply"); const content = JSON.stringify({ mode: "create", space: "outdoor", tools: ["author_beodeul_town"], needsPlan: false, targetMapId: null });
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
      const { exportSpatialToolProof } = await import("/src/editor/tools/spatialToolState.ts");
      const ctx = { project: request.project, currentMapId: request.project.startMapId };
      write({ type: "start", provider: "scripted", model: "scripted", toolCount: 3 });
      write({ type: "turn", index: 1 });
      await sleep(900);
      write({ type: "assistant", text: "강과 다리가 있는 강가 마을 「여울나루」를 바로 지을게요. 맵에서 지어지는 모습을 보세요." });
      mark("assistant-1");
      await sleep(500);
      const args = { name: "여울나루", theme: "river" };
      write({ type: "tool_start", id: "build", name: "author_beodeul_town", args });
      mark("tool-start");
      const before = new Set(Object.keys(ctx.project.maps));
      const built = runTool(ctx, "author_beodeul_town", args, { dryRun: false });
      if (!built.ok) { qa.stage = JSON.stringify(built).slice(0, 400); throw Error(qa.stage); }
      const newMapId = Object.keys(ctx.project.maps).find((id) => !before.has(id));
      qa.newMapId = newMapId;
      await sleep(700);
      write({ type: "checkpoint", checkpointId: "build", label: "마을 시공", toolName: "author_beodeul_town", project: ctx.project, spatialProof: exportSpatialToolProof(ctx.project) });
      mark("checkpoint-sent");
      while (qa.acks < 1) await sleep(50);
      write({ type: "tool_end", id: "build", name: "author_beodeul_town", ok: true, summary: built.summary, durationMs: 1200 });
      write({ type: "turn", index: 2 });
      await sleep(4200);
      write({ type: "assistant", text: "마을이 섰어요. 길과 문 앞이 다 이어졌는지 확인할게요." });
      mark("assistant-2");
      await sleep(400);
      write({ type: "tool_start", id: "form", name: "check_city_form", args: { mapId: newMapId } });
      const form = runTool(ctx, "check_city_form", { mapId: newMapId });
      await sleep(600);
      write({ type: "tool_end", id: "form", name: "check_city_form", ok: form.ok, summary: form.summary });
      await sleep(400);
      write({ type: "assistant", text: "강가 마을 「여울나루」를 지었어요. 큰길·광장·다리·집들이 모두 이어져 있어요." });
      write({ type: "done", project: ctx.project, stats: { ms: 9000, turns: 3, toolCalls: 2, toolErrors: 0 }, changedKeys: ["maps"] });
      mark("done");
      controller.close();
    } }), { headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": request.runId } });
  };
  // 시공 연출과 조수창 변화를 시각과 함께 적는다.
  const observe = () => new MutationObserver(() => {
    if (document.documentElement.dataset.aiConstructionReveal === "playing") mark("reveal-playing");
    else if ("reveal-playing" in qa.marks) mark("reveal-ended");
    if (document.querySelector('[data-testid="ai-creation-choice"]')) mark("CHOICE-UI-SHOWN");
    const text = document.querySelector(".ai-chat-panel, [data-testid=ai-chat-panel]")?.textContent ?? document.body.textContent ?? "";
    if (text.includes("맵에 반영 중")) mark("chat-applying-row");
    if (text.includes("“강과 다리가")) mark("chat-assistant-say-1");
    if (text.includes("마을 짓는 중")) mark("chat-building-row");
    if (text.includes("마을 짓기 완료")) mark("chat-built-row");
    if (text.includes("맵에 반영됨")) mark("chat-applied-row");
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-ai-construction-reveal"] });
  if (document.documentElement) observe(); else document.addEventListener("DOMContentLoaded", observe, { once: true });
});

try {
  await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("ai-input").waitFor({ timeout: 120000 });
  // 대본 전송은 실제 워커와 달리 체크포인트에 프로젝트 전체를 싣는다 — 렌더러 메모리를 아끼려고 참고문서만 뺀다.
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const current = store.getCurrent();
    const tilesets = Object.fromEntries(Object.entries(current.tilesets).map(([id, t]) => [id, { ...t, referenceDocuments: [] }]));
    store.replace({ ...current, tilesets }, { change: { label: "QA references trimmed", source: "qa" } });
  });
  await page.waitForTimeout(2500);
  await shot("before-send");
  await page.getByTestId("ai-input").fill("마을을 만들어다오");
  // PROFILE=1: 보내기부터 시공 연출 시작까지 CPU 프로필 → 자기 시간 상위 함수(verify-shots/…/profile-top.json).
  const cdp = process.env.PROFILE === "1" ? await page.context().newCDPSession(page) : null;
  if (cdp) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start"); }
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
  await page.waitForFunction(() => "assistant-1" in window.__villageQa.marks, null, { timeout: 60000 });
  await page.waitForTimeout(150);
  await shot("assistant-says");
  await page.waitForFunction(() => "checkpoint-sent" in window.__villageQa.marks, null, { timeout: 60000 });
  await page.waitForTimeout(60);
  await shot("applying");
  if (before) {
    await page.waitForFunction(() => window.__villageQa.acks >= 1, null, { timeout: 90000 });
    for (let i = 0; i < 6; i++) { await shot(`after-apply-${i}`); await page.waitForTimeout(400); }
  } else if (process.env.NOREVEAL === "1") await page.waitForFunction(() => window.__villageQa.acks >= 1, null, { timeout: 120000 });
  else await page.waitForFunction(() => document.documentElement.dataset.aiConstructionReveal === "playing", null, { timeout: 60000 });
  if (cdp) {
    const { profile } = await cdp.send("Profiler.stop");
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    const dt = profile.timeDeltas; let i = 0;
    for (const id of profile.samples) {
      const n = byId.get(id); const f = n.callFrame;
      const key = `${f.functionName || "(anon)"} ${f.url.replace(/^.*\/src\//, "src/").replace(/\?.*$/, "")}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (dt[i++] ?? 0) / 1000);
    }
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, ms]) => ({ ms: Math.round(ms), fn: k }));
    writeFileSync(`${out}/profile-top.json`, JSON.stringify(top, null, 1));
  }
  if (!before && process.env.NOREVEAL !== "1") for (let i = 0; i < 26; i++) { await shot(`reveal-${String(i).padStart(2, "0")}`); await page.waitForTimeout(300); }
  await page.waitForFunction(() => "done" in window.__villageQa.marks, null, { timeout: 60000 });
  await page.waitForFunction(() => !window.__oprnAiBridge?.status?.().turnBusy, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot("finished");
  const qa = await page.evaluate(() => ({ marks: window.__villageQa.marks, intentCalls: window.__villageQa.intentCalls, newMapId: window.__villageQa.newMapId,
    currentMapId: null }));
  report.timeline = Object.entries(qa.marks).map(([name, ms]) => ({ name, ms: Math.round(ms) })).sort((a, b) => a.ms - b.ms);
  report.intentCalls = qa.intentCalls;
  report.modelCalls = await page.evaluate(() => window.__villageQa.calls);
  report.newMapId = qa.newMapId;
  const current = await page.evaluate(async () => (await import("/src/editor/editorState.ts")).editorState.get().currentMapId);
  check("선택 창이 뜨지 않는다", !("CHOICE-UI-SHOWN" in qa.marks));
  check("의도 선언 콜은 한 번(감사 콜 없음)", (report.modelCalls ?? []).filter((c) => c.startsWith("You classify ONE user request")).length === 1 && !(report.modelCalls ?? []).some((c) => c.startsWith("REQUEST_COVERAGE_AUDIT")), report.modelCalls);
  check("새 마을 맵으로 화면이 옮겨졌다", current === qa.newMapId, { current, newMapId: qa.newMapId });
  check("시공 연출이 재생됐다", "reveal-playing" in qa.marks, qa.marks["reveal-playing"]);
  check("조수 말이 간단히 보기에 보인다", "chat-assistant-say-1" in qa.marks, qa.marks["chat-assistant-say-1"]);
  check("체크포인트 직후 「맵에 반영 중」 행", "chat-applying-row" in qa.marks, qa.marks["chat-applying-row"]);
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
  if (video) renameSync(`${out}/video/${video}`, `${out}/video/village-live-build.webm`);
}
console.log(JSON.stringify({ timeline: report.timeline, checks: report.checks.map((c) => [c.name, c.passed]) }, null, 1));
