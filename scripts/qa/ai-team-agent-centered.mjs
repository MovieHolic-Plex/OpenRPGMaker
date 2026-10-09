// Actual editor and live Pi team. Ephemeral observation fixtures; no canonical writes.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9861";
const out = resolve(process.env.QA_OUTPUT_DIR ?? "verify-shots/ai-team-agent-centered");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: resolve(out, "video"), size: { width: 1600, height: 1000 } } });
const videoStartedAt = Date.now();
const page = await context.newPage();
const checks = [], errors = [];
let recordingStarted = 0;
page.on("pageerror", e => errors.push(e.message));
function check(name, ok, detail) { checks.push({ name, ok, detail }); if (!ok) throw new Error(name + ": " + JSON.stringify(detail)); }
const shot = name => page.screenshot({ path: resolve(out, `${name}.png`) });
try {
  await page.addInitScript(() => {
    for (const [key, value] of Object.entries({ "oprn:locale": "ko", "oprn:standard-welcome-seen": "1", "oprn:editor-welcome-dismissed": "1", "oprn:ai-activity-level": "brief", "oprn:ai-live-canvas": "on" })) localStorage.setItem(key, value);
    window.__teamEvidence = { requests: [], events: [], snapshots: [] };
    const original = fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (url.pathname !== "/v1/agent/run" || init?.method !== "POST") return original(input, init);
      let body = init.body;
      if (new Headers(init.headers).get("Content-Encoding") === "gzip") body = await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      const request = JSON.parse(typeof body === "string" ? body : await new Response(body).text());
      const item = { runId: request.runId, mode: request.mode, provider: request.provider, model: request.model, mapIds: request.mapIds, startedAt: Date.now() };
      window.__teamEvidence.requests.push(item);
      const response = await original(input, init);
      item.status = response.status;
      if (!response.ok || !response.body) return response;
      const [observe, application] = response.body.tee();
      (async () => {
        const reader = observe.pipeThrough(new TextDecoderStream()).getReader(); let pending = "";
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break; pending += chunk.value;
          let lineEnd;
          while ((lineEnd = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, lineEnd); pending = pending.slice(lineEnd + 1); if (!line.trim()) continue;
            const e = JSON.parse(line), detail = e.type === "agent_event" ? e.event : e;
            window.__teamEvidence.events.push({ receivedAt: Date.now(), type: e.type, agentId: e.agentId, kind: detail.type, name: detail.name, id: detail.id, ok: detail.ok ?? e.ok, at: detail.at ?? e.at, ...(detail.type === "tool_end" ? { summary: detail.summary } : {}), ...(e.type === "agent_spawn" ? { role: e.role, memberId: e.memberId, mapId: e.mapId, label: e.label } : {}), ...(e.type === "done" ? { stats: e.stats, changedKeys: e.changedKeys } : {}) });
          }
        }
      })().catch(e => window.__teamEvidence.observerError = e.message);
      return new Response(application, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
  });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 120000 });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });
  const setup = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { resolveCurrentMapId } = await import("/src/editor/mapSelection.ts");
    const { saveTeamSpec, defaultTeamSpec } = await import("/src/ai/piAgent/teamSpecStore.ts").then(async m => ({ ...m, ...(await import("/src/ai/piAgent/teamSpec.ts")) }));
    const { loadAiConfig } = await import("/src/ai/llmClient.ts");
    const { modelForRole } = await import("/src/ai/modelRoles.ts");
    const { fetchChatGptAuthStatus } = await import("/src/ai/chatgptOAuthClient.ts");
    const model = modelForRole(loadAiConfig(), "deep"), auth = await fetchChatGptAuthStatus(model.provider);
    if (!auth.connected || auth.expired) throw new Error("Live model unavailable");
    const selected = resolveCurrentMapId();
    store.update(project => {
      const original = project.maps[selected];
      project.maps = { [selected]: { ...original, name: "시장 · 관찰 A" }, team_observe_b: { ...structuredClone(original), id: "team_observe_b", name: "시장 · 관찰 B" } };
      project.mapTree = { mapId: "team_observation_folder", kind: "folder", name: "관찰용 맵", children: [{ mapId: selected, children: [] }, { mapId: "team_observe_b", children: [] }] };
      project.tilesets = { [original.tilesetId]: project.tilesets[original.tilesetId] };
    }, { label: "팀 화면 관찰용 메모리 fixture", origin: "system" });
    const team = defaultTeamSpec();
    const builder = { ...team.members[0], label: "구조 조수", prompt: "관찰 전용이다. get_map_region으로 지정된 맵을 한 번 읽고 두 문장으로 보고한다. 어떤 쓰기 도구도 사용하지 않는다.", toolDomains: ["core", "map"], maxTurns: 6 };
    saveTeamSpec({ ...team, workBudget: 100, reviewAfterWork: true, orchestratorNotes: "화면 관찰 작업이다. 지시에 적힌 두 조수만 배정하며 시공과 별도 검수는 하지 않는다. 읽기 완료 후 finish 한다.", members: [builder, { ...builder, id: "events", label: "동선 조수" }, { ...team.members[2], label: "검수 조수" }] });
    window.__teamEvidence.before = JSON.stringify(store.getCurrent());
    return { mapA: selected, mapB: "team_observe_b", provider: model.provider, model: model.model, projectId: store.getCurrent().id };
  });
  check("Live provider connected", !!setup.provider, setup);
  const task = `team 화면 관찰용 읽기 작업이다. 프로젝트를 전혀 수정하지 마라. assign_map_agent로 ${setup.mapA}에 builder를 배정해 get_map_region 한 번으로 맵 구조를 읽고 두 문장 보고하게 하고, ${setup.mapB}에 events를 배정해 get_map_region 한 번으로 이동 동선을 읽고 두 문장 보고하게 해라. 두 맵은 서로 별개이므로 두 배정을 먼저 시작한 뒤 wait_agents로 받아라. 다른 배정과 review_map은 하지 말고, 완료하면 finish로 변경 없음과 두 보고를 알려라.`;
  await page.getByTestId("ai-input").fill(task);
  recordingStarted = Date.now();
  await page.getByTestId("ai-send").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ai-team-lead"]')?.getClientRects().length > 0, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await shot("01-assigning");
  check("Pending members expose assignment reason", (await page.getByTestId("ai-team-avatar-list").innerText()).includes("배정을 기다리는 중"));
  // Record real streamed states without slowing or synthesizing the model.
  let selectedWorker = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    const snapshot = await page.evaluate(async () => {
      const { currentTeamActivity } = await import("/src/ai/piAgent/teamActivity.ts");
      const state = currentTeamActivity();
      const rows = [...document.querySelectorAll('[data-testid="ai-team-member"]')].map(n => ({ id: n.dataset.agentId, state: n.dataset.state, text: n.innerText }));
      const snapshot = { at: Date.now(), phase: state?.phase, rows };
      const history = window.__teamEvidence.snapshots;
      if (JSON.stringify(history.at(-1)?.rows) !== JSON.stringify(rows)) history.push(snapshot);
      return snapshot;
    });
    const worker = snapshot.rows.find(r => !r.id.startsWith("pending:"));
    if (worker && !selectedWorker) {
      await page.locator(`[data-testid="ai-team-member"][data-agent-id="${worker.id}"]`).click();
      await page.getByTestId("ai-member-input").fill("동선 보고를 짧게 정리해 줘.");
      check("Follow-up is blocked during team execution", await page.getByTestId("ai-member-send").isDisabled());
      await shot("02-live-member"); selectedWorker = true;
      await page.getByTestId("ai-member-close").click();
    }
    if (["완료", "실패", "적용됨", "중단", "검토 대기"].includes(snapshot.phase)) break;
    await page.waitForTimeout(2000);
  }
  const final = await page.evaluate(async () => {
    const { currentTeamActivity } = await import("/src/ai/piAgent/teamActivity.ts");
    const { store } = await import("/src/project/store.ts");
    const state = currentTeamActivity();
    const trace = state?.trace;
    return { phase: state?.phase, agents: state?.agents.map(a => ({ id: a.agentId, role: a.role, state: a.state, summary: a.summary, toolCalls: a.toolCalls })), unchanged: window.__teamEvidence.before === JSON.stringify(store.getCurrent()), receipts: trace?.entries.filter(e => e.kind === "tool").map(e => ({ actor: e.actor, name: e.name, status: e.status, summary: e.summary })) };
  });
  check("Live team completed", final.phase === "완료", final);
  check("Observation fixture unchanged", final.unchanged);
  check("Real child workers received tool receipts", final.agents.filter(a => a.role !== "orchestrator" && a.toolCalls > 0).length >= 2, final.agents);
  await shot("03-complete-overview");
  const memberButtons = page.getByTestId("ai-team-member");
  check("Cards show action, scope, result and clock", await memberButtons.first().evaluate(n => ["task", "scope", "result", "signal"].every(key => n.querySelector(`.ai-team-member-${key}`)?.getClientRects().length > 0)));
  await memberButtons.first().click();
  check("Recent receipts stay visible in brief mode", await page.getByTestId("ai-member-recent").isVisible() && (await page.getByTestId("ai-member-recent").innerText()).length > 10);
  check("Draft survived live updates", await page.getByTestId("ai-member-input").inputValue() === "동선 보고를 짧게 정리해 줘.");
  await page.waitForTimeout(2000); await shot("04-member-receipts");
  await memberButtons.nth(1).click(); await page.waitForTimeout(1500); await shot("05-switch-member");
  await memberButtons.first().click();
  check("Draft survives member switching", await page.getByTestId("ai-member-input").inputValue() === "동선 보고를 짧게 정리해 줘.");
  await page.getByTestId("ai-member-input").focus(); await page.keyboard.press("Escape");
  check("Escape restores card focus", await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "ai-team-member"));
  await page.getByTestId("ai-wide-open").click();
  await page.getByTestId("ai-assistant-wide").waitFor();
  await page.waitForTimeout(2000); await shot("06-wide-team");
  check("Wide view retains agent cards", await page.getByTestId("ai-team-member").first().isVisible());
  await page.getByTestId("ai-wide-close").click();
  if (await page.getByTestId("ai-member-detail").isVisible()) await page.getByTestId("ai-member-close").click();
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(700);
    await memberButtons.first().click();
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="ai-team-sidebar"]');
      const detail = document.querySelector('[data-testid="ai-member-detail"]');
      const rect = n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, width: r.width }; };
      return { overflow: document.documentElement.scrollWidth > innerWidth, sidebar: rect(sidebar), detail: rect(detail), input: rect(document.querySelector('[data-testid="ai-member-input"]')) };
    });
    check(`Layout fits ${width}px`, !layout.overflow && layout.sidebar.right <= width && layout.input.bottom <= 900 && layout.detail.x >= layout.sidebar.x, layout);
    await shot(`07-width-${width}`); await page.getByTestId("ai-member-close").click();
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByTestId("topbar-ai-studio").click(); await page.getByTestId("ai-studio-shell").waitFor({ state: "visible" });
  // Studio is an explicit separate surface; use its work tab when offered.
  const teamRow = page.getByTestId("lane-team-row");
  if (await teamRow.count()) await teamRow.first().click();
  check("Studio shows shared agent observation", await page.getByTestId("ai-team-work-current").isVisible());
  await page.waitForTimeout(1200); await shot("08-studio");
  await page.getByTestId("topbar-ai-studio").click();
  check("No browser exceptions", errors.length === 0, errors);
  const evidence = await page.evaluate(() => window.__teamEvidence);
  delete evidence.before;
  writeFileSync(resolve(out, "live-events.json"), JSON.stringify({ setup, final, ...evidence }, null, 2));
  await page.waitForTimeout(2000);
} catch (error) {
  checks.push({ name: "Evidence completed", ok: false, detail: String(error) });
  await shot("failure").catch(() => {});
  const evidence = await page.evaluate(() => window.__teamEvidence).catch(() => ({}));
  delete evidence.before;
  writeFileSync(resolve(out, "live-events.json"), JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  const video = page.video(); await context.close(); const file = await video.path(); await browser.close();
  const mp4 = resolve(out, "ai-team-agent-centered.mp4");
  // Trim boot, preserve actual execution timing, encode a seekable native video.
  const length = (Date.now() - recordingStarted) / 1000;
  const converted = spawnSync("ffmpeg", ["-y", "-ss", String(recordingStarted ? Math.max(0, (recordingStarted - videoStartedAt) / 1000) : 0), "-i", file, "-t", String(Math.max(1, length)), "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], { encoding: "utf8" });
  checks.push({ name: "MP4 encoded", ok: converted.status === 0 });
  writeFileSync(resolve(out, "report.json"), JSON.stringify({ checks, errors }, null, 2));
  writeFileSync(resolve(out, "SUMMARY.md"), ["# 조수 중심 팀 모드", "", "실제 개발 편집기 + Pi companion + 연결된 모델의 팀 실행. 전송 mock·가짜 이벤트·시간 조작 없음.", "관찰용 메모리 fixture 맵 2개를 조회한다. 게임 콘텐츠 제작·SQLite 저장 검증이 아니다.", "", ...checks.map(c => `- ${c.ok ? "PASS" : "FAIL"} ${c.name}`), "", "원시 근거: live-events.json, report.json. 녹화: ai-team-agent-centered.mp4.", "전체 gates/Vitest/typecheck는 AGENTS의 세션 실행 제한에 따라 돌리지 않았다."].join("\n"));
  console.log(JSON.stringify({ checks: checks.map(({ name, ok }) => ({ name, ok })), errors, mp4 }, null, 2));
}
