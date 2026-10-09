// Follow-up layout check using the captured real team's receipts; no new LLM call.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const out = resolve("verify-shots/ai-team-agent-centered");
const recorded = JSON.parse(readFileSync(resolve(out, "live-events.json"), "utf8"));
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
mkdirSync(resolve(out, "layout-video"), { recursive: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: resolve(out, "layout-video"), size: { width: 1600, height: 1000 } } });
const videoStartedAt = Date.now();
const page = await context.newPage();
let studioOpenedAt = 0;
let passed = false;
const errors = [];
const pendingRequests = new Set();
page.on("pageerror", e => errors.push(e.message));
page.on("request", request => pendingRequests.add(request.url()));
page.on("requestfinished", request => pendingRequests.delete(request.url()));
page.on("requestfailed", request => pendingRequests.delete(request.url()));
try {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:locale", "ko");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:ai-activity-level", "brief");
  });
  await page.goto(`${process.env.QA_BASE_URL ?? "http://127.0.0.1:9861"}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 90000 });
  const observation = await page.evaluate(async ({ events, final }) => {
    const { createTeamBoardState, reduceTeamBoard } = await import("/src/ai/piAgent/teamBoardState.ts");
    const { publishTeamActivity } = await import("/src/ai/piAgent/teamActivity.ts");
    const { teamObservation } = await import("/src/editor/panels/aiTeamObservation.ts");
    let state = createTeamBoardState("team", "기록된 팀 실행의 화면 확인");
    for (const e of events) {
      if (e.type === "agent_spawn") state = reduceTeamBoard(state, { type: "agent_spawn", agentId: e.agentId, role: e.role,
        memberId: e.memberId, label: e.label, mapId: e.mapId, mapName: e.mapId ? e.mapId === "team_observe_b" ? "시장 · 관찰 B" : "시장 · 관찰 A" : null, task: "기록된 맵 조회 작업", at: e.at ?? e.receivedAt });
      if (e.kind === "tool_start" || e.kind === "tool_end") state = reduceTeamBoard(state, { type: "agent_event", agentId: e.agentId,
        event: { type: e.kind, id: e.id, name: e.name, args: {}, ok: e.ok, summary: e.summary, at: e.at ?? e.receivedAt } });
    }
    state = { ...state, phase: final.phase, agents: state.agents.map(a => ({ ...a, state: final.agents.find(s => s.id === a.agentId)?.state ?? a.state,
      summary: final.agents.find(s => s.id === a.agentId)?.summary ?? a.summary })) };
    publishTeamActivity(state);
    // Check the in-place stream receipt risk independently of presentation.
    let traceState = createTeamBoardState("team", "stream receipt check");
    traceState = reduceTeamBoard(traceState, { type: "agent_spawn", agentId: "a", role: "builder", mapId: "a", mapName: "a", task: "read", at: 1000 });
    for (const event of [{ type: "delta", kind: "thinking", text: "PRIVATE_THINKING", at: 2000 }, { type: "turn", index: 2, at: 3000 }, { type: "delta", kind: "text", text: "response", at: 4000 }]) {
      traceState = reduceTeamBoard(traceState, { type: "agent_event", agentId: "a", event });
    }
    const observation = teamObservation(traceState.agents[0], traceState.trace);
    return { latestSignal: observation.action === "모델 응답을 받는 중", privateThinkingExcluded: !JSON.stringify(observation).includes("PRIVATE_THINKING") };
  }, recorded);
  studioOpenedAt = Date.now();
  await page.getByTestId("topbar-ai-studio").click();
  await page.getByTestId("ai-studio-shell").waitFor({ state: "visible" });
  await page.getByTestId("lane-team-row").first().click();
  await page.waitForTimeout(1000);
  const geometry = await page.getByTestId("ai-team-work").evaluate(root => {
    const members = root.querySelector(".ai-team-work-members").getBoundingClientRect();
    const progress = root.querySelector(".ai-team-work-progress").getBoundingClientRect();
    return { membersBottom: members.bottom, progressTop: progress.top, progressWidth: progress.width, rootWidth: root.clientWidth,
      containerType: getComputedStyle(root).containerType, columns: getComputedStyle(root.querySelector(".ai-team-work-body")).gridTemplateColumns,
      stacked: progress.top >= members.bottom - 1, fits: root.scrollWidth <= root.clientWidth };
  });
  if (!geometry.stacked || !geometry.fits || geometry.progressWidth < 300 || !observation.latestSignal || !observation.privateThinkingExcluded || errors.length) throw new Error(JSON.stringify({ geometry, observation, errors }));
  await page.screenshot({ path: resolve(out, "09-studio-stacked.png") });
  writeFileSync(resolve(out, "layout-report.json"), JSON.stringify({ provenance: "Replay of receipts from live-events.json for responsive layout; synthetic stream probe for the in-place update edge case.", geometry, observation, errors }, null, 2));
  console.log(JSON.stringify({ geometry, observation, errors }));
  await page.waitForTimeout(2500);
  await page.getByTestId("ai-team-work-member").nth(1).click();
  await page.waitForTimeout(3000);
  passed = true;
} catch (error) {
  await page.screenshot({ path: resolve(out, "layout-failure.png") });
  console.error(JSON.stringify({ errors, pendingRequests: [...pendingRequests].slice(0, 10), title: await page.title(), body: (await page.locator("body").innerText()).slice(0, 800) }));
  throw error;
} finally {
  const source = await page.video().path();
  await context.close();
  await browser.close();
  if (passed) {
    const encoded = spawnSync("ffmpeg", ["-y", "-ss", String((studioOpenedAt - videoStartedAt) / 1000), "-i", source, "-t", "8", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", resolve(out, "studio-record-replay.mp4")], { encoding: "utf8" });
    if (encoded.status !== 0) throw new Error("Studio evidence encoding failed");
  }
}
