/**
 * 좌 레일 «실시간 팀원» 캡처 — /pi 팀 토글을 켜고 실행해, 팀장·팀원 행이 좌 레일에 사는지 본다.
 *
 *   BASE=http://127.0.0.1:9841 OUT=output/evidence/studio-team-rail node scripts/capture-studio-team.mjs
 *
 * 스텁은 done 을 보내지 않는다 — 그래야 실행 중 상태가 유지되어 «일하는 중» 화면을 잡을 수 있다
 * (클라이언트 워치독은 30초라 캡처 동안에는 살아 있다). 끝나면 페이지를 닫는다.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9841";
const OUT = process.env.OUT ?? "/tmp/studio-team-rail";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_REFUSED")) errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));

let sawTeamRun = false;
await page.route("**/v1/agent/run**", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  sawTeamRun = body.mode === "team";
  const mapIds = Array.isArray(body.mapIds) ? body.mapIds : [];
  const lines = [
    { type: "team_start", task: body.task, roles: [{ id: "orchestrator", label: "팀장" }, { id: "builder", label: "시공" }, { id: "reviewer", label: "검수" }] },
    { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: body.task },
    { type: "agent_spawn", agentId: "b1", role: "builder", mapId: mapIds[0] ?? null, mapName: "빈 맵", task: "대장간 2채", memberId: "architect", label: "건축가" },
    { type: "agent_spawn", agentId: "b2", role: "builder", mapId: mapIds[0] ?? null, mapName: "빈 맵", task: "우물 1", memberId: "gardener", label: "정원사" },
    { type: "agent_event", agentId: "b1", event: { type: "tool_start", id: "t1", name: "place_structure", args: { x: 13, y: 5 } } },
    { type: "agent_event", agentId: "b1", event: { type: "tool_end", id: "t1", name: "place_structure", ok: true, summary: "x: 13 · y: 5" } },
    { type: "agent_event", agentId: "b2", event: { type: "tool_start", id: "t2", name: "paint_tiles", args: { tile: "well", count: 4 } } },
  ];
  await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: lines.map((l) => JSON.stringify(l) + "\n").join("") });
});
await page.route("**/__oprn/ai-activity", (r) => r.fulfill({ json: { ok: true } }));
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.route("**/auth/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

let booted = false;
for (let attempt = 0; attempt < 5 && !booted; attempt++) {
  try {
    await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90000 });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible().catch(() => false)) await guest.click();
    await page.waitForTimeout(1200);
    booted = true;
  } catch (error) { console.log("attempt " + attempt + ": " + String(error).slice(0, 100)); }
}
if (!booted) { console.log("boot failed"); await browser.close(); process.exit(1); }

// 팀 토글이 보이는 Pi 경로로 두고 켠다(첫 클릭이 idle 전환에 삼켜질 수 있어 두 번까지).
const teamToggle = page.getByTestId("ai-composer-team-input");
await teamToggle.waitFor({ state: "visible", timeout: 30000 });
await teamToggle.click();
if (!(await teamToggle.isChecked())) await teamToggle.click();
await page.waitForTimeout(300);
const teamOn = await teamToggle.isChecked();

await page.getByTestId("ai-input").fill("대장간 두 채와 우물 하나를 지어줘");
await page.getByTestId("ai-send").click();
await page.waitForTimeout(1500);

await page.getByTestId("topbar-ai-studio").click();
// 팀 보드는 «의도 읽기 → 실행» 뒤에 발행된다 — 행이 설 때까지 기다렸다 찍는다(고정 대기는 이 결정을 못 한다).
for (let i = 0; i < 40; i++) {
  const n = await page.locator("[data-testid=ai-studio-team-row]").count();
  if (n > 0) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, "01-studio-team-live.png") });

// 결정적 실험: 같은 순간에 드로워 「작업」 탭(팀 보드)에는 행이 있는가?
await page.getByTestId("ai-studio-deck-handle").click();
await page.waitForTimeout(400);
await page.getByTestId("ai-studio-tab-work").click();
await page.waitForTimeout(600);
const boardProbe = await page.evaluate(() => ({
  teamWork: Boolean(document.querySelector("[data-testid=ai-team-work]")),
  workRows: document.querySelectorAll("[data-testid=ai-team-work] [data-testid*=agent], [data-testid=ai-team-agent]").length,
  workText: (document.querySelector("[data-testid=ai-studio-deck-pane]")?.textContent ?? "").slice(0, 160),
}));
await page.screenshot({ path: path.join(OUT, "03-drawer-work-tab.png") });
await page.getByTestId("ai-studio-deck-collapse").click();
await page.waitForTimeout(300);

const state = await page.evaluate(() => ({
  rows: [...document.querySelectorAll("[data-testid=ai-studio-team-row]")].map((r) => ({ state: r.dataset.state, text: r.textContent })),
  agentCount: document.querySelector("[data-testid=ai-studio-agents]") ? document.querySelector(".ai-studio-pane-title")?.textContent : null,
  dot: document.querySelector(".ai-studio-status-dot")?.dataset.state ?? null,
}));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, "02-studio-team-later.png") });

await writeFile(path.join(OUT, "report.json"), JSON.stringify({ teamOn, sawTeamRun, boardProbe, state, errors: errors.slice(0, 5) }, null, 2));
console.log("teamOn=" + teamOn + " sawTeamRun=" + sawTeamRun + " railRows=" + state.rows.length + " board=" + JSON.stringify(boardProbe));
state.rows.forEach((r) => console.log("  [" + r.state + "] " + (r.text ?? "").slice(0, 90)));
console.log("errors=" + JSON.stringify(errors.slice(0, 3)));
await browser.close();
