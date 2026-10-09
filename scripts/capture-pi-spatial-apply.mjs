/**
 * `/pi` 가 canonical 프로젝트에 적용되는지를 브라우저에서 before/after 로 찍는다 — 워커 경로의
 * 수용 증거가 프로세스 경계를 넘는지가 축이다(openwiki/spatial-ai-tools.md 「프로세스 경계를 넘는 증거」).
 *
 *   1) 라이브 프로젝트 만들기: npx vite-node --script scripts/spatial-wire-fixture.mts /tmp/pi-spatial-live.json
 *   2) dev 서버(워크트리 포트) + 캡처: BASE=http://127.0.0.1:9843 CASES=1,2,3 node scripts/capture-pi-spatial-apply.mjs
 *
 * 케이스는 `spatialProof` 유무만 다르다 — 1(팀·증거 있음)은 «적용했습니다», 2(팀·증거 없음)는
 * `적용 실패(commit-rejected): Canonical AI acceptance requires an issued tool proposal`,
 * 3(맵 범위·증거 있음)은 브라우저가 묶음을 병합한 뒤 승인을 다시 찍는 경로다.
 * 결과: verify-shots/pi-spatial-apply/ + 진행 로그 /tmp/pi-spatial-progress.log.
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9843";
const OUT = process.env.OUT ?? "verify-shots/pi-spatial-apply";
const PROGRESS = "/tmp/pi-spatial-progress.log";
mkdirSync(OUT, { recursive: true });
mkdirSync("/tmp", { recursive: true });
const say = (line) => { appendFileSync(PROGRESS, `${new Date().toISOString()} ${line}\n`); console.log(line); };
writeFileSync(PROGRESS, "");

const liveJson = readFileSync("/tmp/pi-spatial-live.json", "utf8");
const sha = (value) => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

function workerResult(base) {
  const done = JSON.parse(JSON.stringify(base));
  done.maps[base.startMapId].name = "검수된 마을";
  return done;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (error) => say(`pageerror:${String(error).slice(0, 200)} :: ${String(error.stack ?? "").split("\n").slice(0, 4).join(" <- ").slice(0, 400)}`));

await page.addInitScript(({ projectJson }) => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ executionRoute: "pi-agent", piTeam: false, piApply: "review" }));
  window.__OPRN_E2E_PROJECT__ = JSON.parse(projectJson);
}, { projectJson: liveJson });

let lastProof = null;
let runRequest = null;
await page.route("**/v1/agent/run**", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  runRequest = body;
  const base = body.project;
  // 단독 실행은 실행 전에 계획 턴(readOnly)을 먼저 돈다 — 계획은 말로만 남아야 하므로 프로젝트를 바꾸지 않는다.
  if (body.readOnly) {
    say("stub:plan-turn");
    const plan = [
      { type: "assistant", text: "1. 빈 맵 북서쪽에 우물 1채를 놓는다 · 빈 맵 · 통행로 확보\n2. 주변 바닥을 정비한다 · 빈 맵 · 마을 인상\n위험: 없음" },
      { type: "done", project: base, stats: { ms: 900, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [], spatialProof: null },
    ];
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: plan.map((line) => `${JSON.stringify(line)}\n`).join("") });
    return;
  }
  const done = workerResult(base);
  const wantsProof = String(body.task ?? "").includes("증거포함");
  lastProof = wantsProof;
  const spatialProof = wantsProof ? { baseline: sha(base), spatial: sha(base.spatialAuthoring), proposed: sha(done) } : null;
  const mapId = base.startMapId;
  const lines = [
    { type: "team_start", task: body.task, roles: [{ id: "orchestrator", label: "팀장" }, { id: "builder", label: "시공" }, { id: "reviewer", label: "검수" }] },
    { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: body.task },
    { type: "agent_spawn", agentId: "b1", role: "builder", mapId, mapName: base.maps[mapId]?.name ?? null, task: "우물 하나와 마을 정비", memberId: "architect", label: "건축가" },
    { type: "agent_event", agentId: "b1", event: { type: "tool_start", id: "t1", name: "place_structure", args: { x: 4, y: 4, kind: "well" } } },
    { type: "agent_event", agentId: "b1", event: { type: "tool_end", id: "t1", name: "place_structure", ok: true, summary: "x: 4 · y: 4" } },
    { type: "agent_done", agentId: "b1", ok: true, summary: "우물 1채 배치", stats: { ms: 1200, turns: 2, toolCalls: 1, toolErrors: 0 }, changedKeys: [`maps.${mapId}`], spills: [], conflicts: [] },
    { type: "team_report", text: "마을 정비를 마쳤습니다." },
    { type: "done", project: done, stats: { ms: 3400, turns: 6, toolCalls: 3, toolErrors: 0 }, changedKeys: [`maps.${mapId}`], spatialProof },
  ];
  say(`stub:run mode=${body.mode} proof=${wantsProof} canonical=${base.spatialAuthoring !== undefined}`);
  await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: lines.map((line) => `${JSON.stringify(line)}\n`).join("") });
});
await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.route("**/auth/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

await page.goto(`${BASE}/?aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.waitForTimeout(1500);
say(`boot:ok canonicalLive=${JSON.parse(liveJson).spatialAuthoring !== undefined}`);

const cases = (process.env.CASES ?? "1").split(",").map((value) => value.trim());
const suites = {
  "1": { name: "team-proof", task: "/pi team 증거포함 마을을 정비해줘", prefix: "01-team-proof", expect: "적용했습니다", studio: true },
  "2": { name: "team-noproof", task: "/pi team 증거없음 마을을 한 번 더 정비해줘", prefix: "02-team-noproof", expect: "적용 실패", studio: true },
  "3": { name: "map-scoped", task: "/pi 증거포함 우물을 하나 더 놓아줘", prefix: "03-map-scoped", expect: "적용했습니다", studio: false },
};

const results = [];
for (const key of cases) {
  const spec = suites[key];
  const before = await page.evaluate(() => document.body.innerText.length);
  await page.getByTestId("ai-input").fill(spec.task);
  await page.getByTestId("ai-send").click();
  say(`${spec.name}:sent`);
  const pane = page.getByTestId("ai-studio-deck-pane").first();
  const paneOpen = await pane.isVisible().catch(() => false);
  if (spec.studio !== false && !paneOpen) await page.getByTestId("topbar-ai-studio").click().catch(() => say(`${spec.name}:studio-click-failed`));
  if (spec.studio === false && paneOpen) await page.getByTestId("topbar-ai-studio").click().catch(() => say(`${spec.name}:studio-close-failed`));
  const apply = page.getByTestId("ai-team-apply").first();
  let reviewSeen = false;
  try { await apply.waitFor({ state: "visible", timeout: 90_000 }); reviewSeen = true; } catch { reviewSeen = false; }
  say(`${spec.name}:review=${reviewSeen}`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${spec.prefix}-1-review.png`) });
  let clickError = null;
  if (reviewSeen) {
    try { await apply.click({ timeout: 20_000 }); say(`${spec.name}:click=ok`); }
    catch (error) { clickError = String(error).slice(0, 160); say(`${spec.name}:click=err ${clickError}`);
      try { await apply.click({ timeout: 10_000, force: true }); say(`${spec.name}:click=force-ok`); clickError = null; }
      catch (error2) { say(`${spec.name}:click=force-err ${String(error2).slice(0, 160)}`); } }
  }
  let outcome = null;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !outcome) {
    const text = await page.evaluate(() => document.body.innerText);
    const match = text.match(/적용했습니다[^\n]*|적용 실패[^\n]*/);
    if (match) outcome = match[0];
    else await page.waitForTimeout(600);
  }
  say(`${spec.name}:outcome=${outcome ?? "none"}`);
  const tail = await page.evaluate(() => document.body.innerText.slice(-700).replace(/\n+/g, " | "));
  say(`${spec.name}:tail=${tail}`);
  await page.screenshot({ path: path.join(OUT, `${spec.prefix}-2-outcome.png`) });
  results.push({ ...spec, reviewSeen, cameFromServer: lastProof, clickError, outcome, ok: Boolean(outcome && outcome.includes(spec.expect)), newText: (await page.evaluate(() => document.body.innerText.length)) - before });
  await page.waitForTimeout(1500);
}

writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
say(`SUMMARY ${JSON.stringify(results.map((entry) => `${entry.name}:${entry.ok ? "PASS" : "FAIL"}${entry.outcome ? `(${entry.outcome.slice(0, 60)})` : ""}`))}`);
await browser.close();
