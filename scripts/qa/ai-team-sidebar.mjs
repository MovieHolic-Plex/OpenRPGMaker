// Real editor UI, deterministic Pi stream replay. No LLM calls or remote writes.
// BASE=http://127.0.0.1:9826 node scripts/qa/ai-team-sidebar.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9826";
const out = resolve("output/evidence/ai-team-sidebar");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const checks = [];
const requests = [];
let nextReply = "success";
let heldRoute;
page.on("pageerror", error => errors.push(error.message));
function check(label, ok, detail) { checks.push({ label, ok, detail }); if (!ok) throw new Error(label + ": " + JSON.stringify(detail)); }
const shot = name => page.screenshot({ path: resolve(out, name + ".png") });
try {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-studio", "0");
    localStorage.removeItem("oprn:ai-panel-collapsed");
    localStorage.removeItem("oprn:ai-sidebar-collapsed");
  });
  await page.route("**/rest/v1/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v1/agent/run**", async route => {
    const body = route.request().postDataJSON();
    requests.push({ mode: body.mode, mapIds: body.mapIds, readOnly: body.readOnly, toolDomains: body.toolDomains, task: body.task });
    if (nextReply === "failure") {
      nextReply = "success";
      await route.fulfill({ status: 503, body: "QA transport unavailable" });
      return;
    }
    if (nextReply === "hold") { nextReply = "success"; heldRoute = route; return; }
    const mapId = body.mapIds[0] ?? body.project.startMapId;
    const mapName = body.project.maps[mapId]?.name ?? "시장 마을";
    const stats = { ms: 2400, turns: 2, toolCalls: 1, toolErrors: 0 };
    const events = body.mode === "team" ? [
      { type: "team_start", task: body.task, roles: [] },
      { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: body.task },
      ...[
        { agentId: "terrain", memberId: "builder", label: "지형", role: "builder", task: "입구와 광장의 길 연결 상태 확인", report: "입구에서 광장까지 기존 길을 확인했습니다. 집과 나무를 유지하며 가장자리를 다듬을 수 있습니다." },
        { agentId: "events", memberId: "events", label: "이벤트", role: "builder", task: "안내 주민의 위치와 대사 검토", report: "광장 입구의 빈 칸을 확인했습니다. 주민이 이동 통로를 막지 않도록 배치할 수 있습니다." },
        { agentId: "review", memberId: "reviewer", label: "검토", role: "reviewer", task: "기존 집과 나무 유지 확인", report: "기존 집과 나무를 확인했습니다. 이 확인 작업에서는 프로젝트를 변경하지 않았습니다." },
      ].flatMap(agent => [
        { type: "agent_spawn", ...agent, mapId, mapName },
        { type: "agent_event", agentId: agent.agentId, event: { type: "turn", index: 1 } },
        { type: "agent_event", agentId: agent.agentId, event: { type: "assistant", text: agent.report } },
        { type: "agent_done", agentId: agent.agentId, ok: true, summary: agent.report, stats, changedKeys: [], spills: [], conflicts: [] },
      ]),
      { type: "team_report", text: "길과 안내 주민의 배치 조건을 확인했습니다. 집과 나무는 그대로 유지할 수 있어요." },
    ] : [
      { type: "start", provider: body.provider, model: body.model, toolCount: 1 },
      { type: "turn", index: 1 },
      { type: "assistant", text: "후속 요청을 받았습니다. 앞선 작업의 맥락과 지정된 맵 범위를 확인했습니다." },
    ];
    events.push({ type: "assistant", text: body.mode === "team" ? "길과 안내 주민의 배치 조건을 확인했어요. 오른쪽에서 담당별 내용을 확인할 수 있습니다. 이번에는 프로젝트를 변경하지 않았습니다." : "확인했습니다. 프로젝트는 변경하지 않았습니다." });
    events.push({ type: "done", project: body.project, changedKeys: [], stats });
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: events.map(e => JSON.stringify(e)).join("\n") + "\n" });
  });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByTestId("editor-zoom-prev").click();
  await page.waitForTimeout(500);
  await page.getByTestId("ai-input").fill("/pi team 입구에서 광장까지 길과 안내 주민의 배치 조건을 확인해줘. 집과 나무는 그대로 두고.");
  await page.getByTestId("ai-send").click();
  await page.getByTestId("ai-team-member").nth(2).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="ai-work-card"]')?.getAttribute("data-state") === "done");
  check("No bottom work strip", await page.getByTestId("ai-work-strip").count() === 0);
  check("Three team avatars", await page.getByTestId("ai-team-member").count() === 3);
  const boxes = await page.evaluate(() => {
    const rect = testid => { const r = document.querySelector(`[data-testid="${testid}"]`).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { ai: rect("ai-panel"), canvas: rect("edit-canvas"), team: rect("ai-team-sidebar") };
  });
  check("AI left / map center / team right", boxes.ai.x < boxes.canvas.x && boxes.canvas.x < boxes.team.x, boxes);
  const railBox = await page.getByTestId("ai-deck-rail").boundingBox();
  check("Left header stays on one row", railBox.height < 75, railBox);
  check("Input has no nested border", await page.getByTestId("ai-input").evaluate(node => getComputedStyle(node).borderTopWidth === "0px"));
  for (const [toggle, popover] of [["ai-preference-toggle", "ai-preference-popover"], ["ai-planning-toggle", "ai-planning-popover"], ["ai-context-meter", "ai-context-panel"]]) {
    await page.getByTestId("ai-command-menu-toggle").click();
    await page.getByTestId(toggle).click();
    const box = await page.getByTestId(popover).boundingBox();
    check("Overflow opens " + popover, !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440);
    await page.keyboard.press("Escape");
  }
  const toolbar = page.getByTestId("editor-zoom-controls");
  check("Map toolbar is compact", (await toolbar.boundingBox()).width < 540);
  check("Encounter action is icon-only with a full accessible name", await page.getByTestId("walk-encounter-list-open").textContent() === "" && (await page.getByTestId("walk-encounter-list-open").getAttribute("aria-label")).includes("걸을 때 적 만나기"));
  await page.getByTestId("walk-encounter-list-open").focus();
  await page.getByTestId("delayed-tooltip").filter({ hasText: "걷기 전투" }).waitFor();
  check("Keyboard reveals encounter tooltip", await page.getByTestId("delayed-tooltip").filter({ hasText: "걷기 전투" }).isVisible());
  await page.keyboard.press("Escape");
  await page.getByTestId("walk-encounter-list-open").click();
  await page.getByTestId("walk-encounter-list").waitFor();
  check("Encounter icon opens the existing settings", await page.getByTestId("walk-encounter-list").isVisible());
  await page.keyboard.press("Escape");
  for (const id of ["map-location-layer-toggle", "map-background-preview-toggle"]) {
    const old = await page.getByTestId(id).getAttribute("aria-pressed");
    await page.getByTestId(id).click();
    check(id + " reflects active state", await page.getByTestId(id).getAttribute("aria-pressed") !== old);
    await page.getByTestId(id).click();
  }
  await page.getByTestId("editor-canvas-toolbar-expand").click();
  check("More reveals PNG save without duplicating zoom choices", await page.getByTestId("editor-map-screenshot-button").isVisible() && !(await page.getByTestId("editor-zoom-menu").isVisible()));
  await page.getByTestId("editor-canvas-toolbar-expand").click();
  await page.getByTestId("ai-input").fill("접어도 유지되는 초안");
  const beforeCollapse = await page.getByTestId("edit-canvas").boundingBox();
  await page.getByTestId("sidebar-collapse").click();
  await page.waitForTimeout(500);
  check("Sidebar collapses to 48px and gives space to the map", (await page.getByTestId("editor-ai-sidebar").boundingBox()).width === 48 && (await page.getByTestId("edit-canvas").boundingBox()).width > beforeCollapse.width + 200);
  check("Hidden composer is removed from interaction", !(await page.getByTestId("ai-input").isVisible()) && !(await page.getByTestId("left-panel-resizer").isVisible()));
  await shot("06-collapsed-sidebar");
  await page.getByTestId("sidebar-ai").click();
  check("Rail AI restores the previous draft", await page.getByTestId("ai-input").inputValue() === "접어도 유지되는 초안");
  await page.getByTestId("sidebar-tools").click();
  await page.getByTestId("sidebar-collapse").click();
  await page.getByTestId("sidebar-collapse").click();
  check("Expand preserves the selected tools tab", await page.getByTestId("editor-ai-sidebar").getAttribute("data-pane") === "tools" && !(await page.getByTestId("ai-input").isVisible()));
  await page.getByTestId("sidebar-ai").click();
  await page.getByTestId("ai-input").fill("");
  await page.mouse.move(700, 500);
  await shot("01-team-overview");
  const eventMember = page.locator('[data-testid="ai-team-member"][data-agent-id="events"]');
  await eventMember.click();
  await page.getByTestId("ai-member-input").fill("안내 대사는 짧게 해줘");
  await page.locator('[data-testid="ai-team-member"][data-agent-id="terrain"]').click();
  await eventMember.click();
  check("Member draft preserved", (await page.getByTestId("ai-member-input").inputValue()).includes("안내 대사"));
  await page.getByTestId("ai-member-input").fill("안내 대사는 두 문장으로 짧게 해줘.");
  await shot("02-member-conversation");
  await page.getByTestId("ai-input").fill("주 대화 작성 중인 내용");
  await page.getByTestId("sidebar-tools").click();
  await page.getByTestId("sidebar-ai").click();
  check("Main draft survives palette switch", await page.getByTestId("ai-input").inputValue() === "주 대화 작성 중인 내용");
  await page.getByTestId("ai-input").fill("");
  await page.getByTestId("ai-member-close").click();

  // Replay busy status through the production reducer bus. Not a fake DOM image.
  const source = await page.evaluate(async () => (await fetch("/src/editor/panels/aiChatPanel.ts")).text());
  const busUrl = source.match(/from "([^"]*piAgent\/teamActivity[^\"]*)"/)[1];
  await page.evaluate(async url => {
    const bus = await import(url);
    const state = bus.currentTeamActivity();
    bus.publishTeamActivity({ ...state, phase: "실행 중", agents: state.agents.map(a => a.agentId === "terrain" ? { ...a, state: "실행 중" } : a) });
  }, busUrl);
  check("Status update does not open member detail", !(await page.getByTestId("ai-member-detail").isVisible()));
  await eventMember.click();
  check("No pretending to send to a busy worker", await page.getByTestId("ai-member-send").isDisabled());
  await page.evaluate(async url => { const bus = await import(url); const state = bus.currentTeamActivity(); bus.publishTeamActivity({ ...state, phase: "완료", agents: state.agents.map(a => ({ ...a, state: "완료" })) }); }, busUrl);

  await page.locator('[data-testid="ai-team-member"][data-agent-id="review"]').click();
  await page.getByTestId("ai-member-input").fill("기존 집과 나무가 유지되는지 다시 확인해줘.");
  await page.getByTestId("ai-member-send").click();
  await page.getByTestId("ai-member-apply").waitFor({ timeout: 20000 });
  check("Reviewer follow-up stays read-only", requests.at(-1).readOnly === true, requests.at(-1));
  check("Follow-up carries preceding context", requests.at(-1).task.includes("이전 작업:") && requests.at(-1).task.includes("후속 요청:"));
  await shot("03-member-follow-up");
  await page.getByTestId("ai-member-discard").click();
  await page.getByTestId("ai-member-close").click();
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.waitForTimeout(600);
  await shot("04-compact-overview");
  check("No document horizontal overflow at 1024", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await eventMember.click();
  await shot("05-compact-member");
  await page.getByTestId("ai-member-close").click();
  await page.locator('.ai-team-rail-tab', { hasText: "속성" }).click();
  check("Real map properties open in right panel", await page.locator('.ai-team-member-head strong').textContent() === "맵 속성");
  await page.getByTestId("ai-member-close").click();
  await page.getByRole("button", { name: "AI 팀 설정", exact: true }).click();
  check("Team settings remain available", await page.getByTestId("ai-team-panel").isVisible());
  await page.getByTestId("ai-member-close").click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByTestId("topbar-ai-studio").click();
  await page.getByTestId("ai-studio-shell").waitFor({ state: "visible" });
  const studioBox = await page.getByTestId("ai-panel").boundingBox();
  check("Explicit studio retains fullscreen layout", studioBox.width > 1300, studioBox);
  await page.getByTestId("topbar-ai-studio").click();
  await page.waitForTimeout(400);
  check("Studio exit restores left sidebar", (await page.getByTestId("ai-panel").boundingBox()).width < 400);
  await eventMember.click();
  await page.locator('[data-member-tab="changes"]').click();
  check("Member changes tab shows its own report", (await page.getByTestId("ai-member-content").textContent()).includes("광장 입구"));
  await page.locator('[data-member-tab="chat"]').click();
  nextReply = "failure";
  const retryText = "연결 실패 후에도 이 요청을 유지해줘.";
  await page.getByTestId("ai-member-input").fill(retryText);
  await page.getByTestId("ai-member-send").click();
  await page.locator('[data-testid="ai-team-member"][data-state="실패"]').waitFor();
  await page.waitForFunction(text => document.querySelector('[data-testid="ai-member-input"]')?.value === text, retryText);
  check("Failed follow-up preserves request for retry", await page.getByTestId("ai-member-input").inputValue() === retryText);
  check("Transport failure is visible", await page.locator('.ai-team-member-notice').isVisible());
  await page.getByTestId("ai-member-send").click();
  await page.getByTestId("ai-member-apply").waitFor();
  check("Successful retry clears previous error", !(await page.locator('.ai-team-member-notice').isVisible()));
  await page.getByTestId("ai-member-apply").click();
  await page.locator('[data-testid="ai-team-member"][data-state="적용됨"]').waitFor();
  check("Member result can be applied", await page.getByTestId("ai-member-apply").count() === 0);
  nextReply = "hold";
  await page.getByTestId("ai-member-input").fill("중단 동작 확인");
  await page.getByTestId("ai-member-send").click();
  await page.getByTestId("ai-member-stop").waitFor();
  await page.waitForTimeout(100);
  await page.getByTestId("ai-member-stop").click();
  await page.locator('[data-testid="ai-team-member"][data-state="중단"]').waitFor();
  check("Member stop ends the running state", await page.getByTestId("ai-member-stop").count() === 0);
  if (heldRoute) await heldRoute.abort().catch(() => {});
  await page.getByTestId("ai-member-input").focus();
  await page.keyboard.press("Escape");
  check("Escape closes detail and restores avatar focus", !(await page.getByTestId("ai-member-detail").isVisible()) && await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "ai-team-member"));
  check("No browser exceptions", errors.length === 0, errors);
} catch (error) {
  await shot("failure");
  checks.push({ label: "Capture completed", ok: false, detail: String(error) });
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, "report.json"), JSON.stringify({ checks, errors, requests }, null, 2));
  writeFileSync(resolve(out, "SUMMARY.md"), ["# AI sidebar evidence", "", "Actual editor UI at " + base + ". Pre-existing local marketTown showcase; remote writes blocked. Pi responses are deterministic transport replays, not live LLM evidence.", "", ...checks.map(c => `- ${c.ok ? "PASS" : "FAIL"} ${c.label}`), "", "Screenshots: 01-team-overview.png, 02-member-conversation.png, 03-member-follow-up.png, 04-compact-overview.png, 05-compact-member.png."].join("\n"));
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
