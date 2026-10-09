// Real editor UI, deterministic Pi stream replay. No LLM calls or remote writes.
// BASE=http://127.0.0.1:9826 node scripts/qa/ai-team-sidebar.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9826";
const out = resolve("output/evidence/ai-team-menu");
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
    requests.push({ team: body.team, maxTurns: body.maxTurns, mode: body.mode, mapIds: body.mapIds, readOnly: body.readOnly, toolDomains: body.toolDomains, task: body.task });
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
    events.push({ type: "assistant", text: body.mode === "team" ? "길과 안내 주민의 배치 조건을 확인했어요. 오른쪽에서 담당별 내용을 확인할 수 있습니다. 이번에는 프로젝트를 변경하지 않았습니다. 안내 주민을 입구에 둘까요?" : "확인했습니다. 프로젝트는 변경하지 않았습니다." });
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
  const trigger = page.getByTestId("ai-composer-team");
  const menu = page.getByTestId("ai-team-menu");
  await trigger.click();
  await menu.getByRole("button", { name: "팀으로", exact: true }).click();
  await menu.getByRole("button", { name: "오래 맡기기", exact: true }).click();
  const review = menu.getByRole("switch", { name: "완료 후 검토" });
  check("Review defaults on", await review.getAttribute("aria-checked") === "true");
  await review.click();
  check("Review can be disabled independently", await review.getAttribute("aria-checked") === "false");
  const rect = await menu.boundingBox();
  check("Compact menu fits viewport", rect.width <= 282 && rect.height < 270 && rect.x >= 0 && rect.y >= 0, rect);
  check("Trigger reflects shared budget", (await trigger.innerText()).includes("오래 맡기기"));
  await shot("01-compact-team-menu");
  await page.keyboard.press("Escape");
  check("Escape closes and returns focus", !(await menu.isVisible()) && await trigger.evaluate(n => n === document.activeElement));
  await page.getByTestId("ai-input").fill("/pi team 시장에 집 두 채를 지어줘");
  await page.getByTestId("ai-send").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ai-work-card"]')?.getAttribute("data-state") === "done");
  check("Team request uses shared controls", requests.at(-1).mode === "team" && requests.at(-1).team.workBudget === 600 && requests.at(-1).team.reviewAfterWork === false, requests.at(-1).team);
  await trigger.click();
  await menu.getByRole("button", { name: /팀 구성/ }).click();
  await page.locator('[data-member-id="reviewer"]').getByTestId("ai-team-member-enabled").uncheck();
  await page.getByTestId("ai-member-close").click();
  await trigger.click();
  check("Missing reviewer is explicit", await menu.getByRole("button", { name: /담당 설정/ }).isVisible());
  check("Missing reviewer cannot appear enabled", await review.getAttribute("aria-checked") === "false" && await review.isDisabled());
  await shot("02-reviewer-missing");
  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("ai-composer-team").waitFor();
  await trigger.click();
  check("Shared settings persist across reload", (await trigger.innerText()).includes("오래 맡기기") && await review.getAttribute("aria-checked") === "false");
  await menu.getByRole("button", { name: "혼자", exact: true }).click();
  check("Solo hides team-only controls", !(await review.isVisible()));
  // Existing popover owner considers the whole composer inside; clicking the map closes it.
  await page.locator('[data-testid="edit-canvas"] canvas').click({ position: { x: 10, y: 10 } });
  check("Outside click dismisses", !(await menu.isVisible()));
  check("No browser errors", errors.length === 0, errors);
} catch (error) {
  await shot("failure");
  throw error;
} finally {
  writeFileSync(resolve(out, "SUMMARY.json"), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
