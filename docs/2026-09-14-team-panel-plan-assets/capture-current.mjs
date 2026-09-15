/**
 * 팀원 전용 패널 계획서 — 「지금」 증거 캡처.
 * 사용: BASE=http://127.0.0.1:9831 node docs/2026-09-14-team-panel-plan-assets/capture-current.mjs
 * 출력: docs/2026-09-14-team-panel-plan-assets/current/*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://127.0.0.1:9831";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "current");
mkdirSync(OUT, { recursive: true });
const manifest = [];

async function snap(page, name, caption, locator) {
  const path = join(OUT, `${name}.png`);
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
  const box = locator ? await locator.boundingBox() : null;
  manifest.push({ file: `${name}.png`, caption, box });
  console.log("shot", name, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "");
}

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.removeItem("oprn:ai-panel-collapsed");
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
    const ok = await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
    if (ok) break;
    console.log("boot retry", attempt + 1);
  }
  for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(1200);
}

/** 실제 리듀서로 팀 실행 상태를 만들어 버스에 게시하고, 로그에 보드 카드도 붙인다. */
async function seedTeamRun(page, phase) {
  return await page.evaluate(async (phase) => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const [{ store }, boardState, activity, boardMod] = await Promise.all([
      load("/src/project/store.ts"),
      load("/src/ai/piAgent/teamBoardState.ts"),
      load("/src/ai/piAgent/teamActivity.ts"),
      load("/src/editor/panels/aiTeamBoard.ts"),
    ]);
    const project = store.getCurrent();
    const mapIds = Object.keys(project.maps);
    const m = (i) => ({ id: mapIds[i % mapIds.length], name: project.maps[mapIds[i % mapIds.length]]?.name ?? mapIds[i % mapIds.length] });
    let state = boardState.createTeamBoardState("team", "마을 북쪽에 대장간 거리를 만들고 남쪽 숲길을 정비해줘");
    const push = (e) => { state = boardState.reduceTeamBoard(state, e); };
    push({ type: "team_start", task: state.task, roles: [] });
    push({ type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: state.task });
    push({ type: "agent_event", agentId: "lead", event: { type: "turn", index: 3 } });
    push({ type: "agent_event", agentId: "lead", event: { type: "tool_start", id: "t1", name: "assign_map_agent", args: {} } });
    push({ type: "agent_event", agentId: "lead", event: { type: "tool_end", id: "t1", name: "assign_map_agent", ok: true, summary: "건축가 → 시장 마을 배정" } });
    push({ type: "agent_spawn", agentId: "a1", role: "builder", mapId: m(0).id, mapName: m(0).name, task: "북쪽 (12,4)~(28,10) 에 대장간 2채와 앞마당 돌길을 놓는다. 입구는 남향.", memberId: "architect", label: "건축가" });
    push({ type: "agent_event", agentId: "a1", event: { type: "turn", index: 7 } });
    for (let i = 0; i < 5; i++) push({ type: "agent_event", agentId: "a1", event: { type: "tool_start", id: `a1-${i}`, name: "place_structure", args: {} } });
    push({ type: "agent_event", agentId: "a1", event: { type: "tool_end", id: "a1-4", name: "place_structure", ok: true, summary: "대장간 2 · 타일 64칸 (14,5)" } });
    push({ type: "agent_spawn", agentId: "a2", role: "builder", mapId: m(1).id, mapName: m(1).name, task: "남쪽 숲길을 폭 2 로 정리하고 끊긴 곳을 잇는다.", memberId: "gardener", label: "정원사" });
    push({ type: "agent_event", agentId: "a2", event: { type: "turn", index: 4 } });
    push({ type: "agent_event", agentId: "a2", event: { type: "tool_start", id: "a2-1", name: "paint_path", args: {} } });
    push({ type: "agent_event", agentId: "a2", event: { type: "tool_end", id: "a2-1", name: "paint_path", ok: false, summary: "(30,41) 은 물 타일 — 길을 놓을 수 없음" } });
    push({ type: "agent_event", agentId: "a2", event: { type: "assistant", text: "물가를 피해 한 칸 동쪽으로 우회합니다." } });
    if (phase === "review") {
      push({ type: "agent_done", agentId: "a1", ok: true, summary: "대장간 2채와 돌길을 (14,5)~(26,9) 에 놓았습니다.", stats: { ms: 48000, turns: 9, toolCalls: 12, toolErrors: 0 }, changedKeys: [`maps.${m(0).id}`], spills: [], conflicts: [] });
      push({ type: "agent_done", agentId: "a2", ok: true, summary: "숲길 폭 2 로 정리, 끊긴 구간 3곳을 이었습니다.", stats: { ms: 31000, turns: 6, toolCalls: 8, toolErrors: 1 }, changedKeys: [`maps.${m(1).id}`], spills: [], conflicts: [] });
      push({ type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: m(0).id, mapName: m(0).name, task: "대장간 거리 검수", memberId: "inspector", label: "검수관" });
      push({ type: "review", agentId: "r1", mapId: m(0).id, ok: false, findings: ["(20,9) 대장간 입구 앞 돌길이 한 칸 끊김", "동쪽 대장간 지붕이 (27,5) 나무와 겹침"] });
      push({ type: "team_report", text: "대장간 2채·돌길·숲길 정비 완료. 검수 지적 2건은 재배정으로 고쳤습니다." });
      push({ type: "done", project, stats: { ms: 120000, turns: 20, toolCalls: 31, toolErrors: 1 }, changedKeys: [`maps.${m(0).id}`, `maps.${m(1).id}`] });
      state = boardState.markTeamBoardReview(state, ["타일 128칸", "이벤트 +2", "맵 2"]);
    }
    activity.publishTeamActivity(state);
    // 로그 안 보드 카드 — 실제 렌더러.
    const board = boardMod.createTeamBoard(state);
    if (phase === "review") board.setReview({ onApply() {}, onDiscard() {} });
    const log = [...document.querySelectorAll(".ai-chat-log")].find((n) => n.getClientRects().length > 0) ?? document.querySelector(".ai-chat-log");
    if (log) { log.append(board.root); board.root.scrollIntoView(); }
    return { agents: state.agents.length, phase: state.phase, log: Boolean(log) };
  }, phase);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("dialog", (d) => d.accept());

await boot(page);
const panel = page.getByTestId("ai-panel");
const deck = page.getByTestId("ai-deck");

// 1. 유휴 — 팀 막대 접힘
await snap(page, "01-idle-full", "유휴 조수 데크 · 「팀」 막대는 레일 아래 한 줄 (1440×900)");
await snap(page, "02-idle-deck", "유휴 데크 크롭 — 팀 막대 접힘", deck);

// 2. 팀 막대 펼침 — 유휴(실행 없음)
await page.getByTestId("ai-team-panel-toggle").click();
await page.waitForTimeout(500);
await snap(page, "03-team-open-idle", "팀 막대 펼침 · 실행 없음 — 「지금」 비어 있고 명단만", deck);

// 3. 실행 중 — 버스에 게시 + 로그 보드 카드
await page.getByTestId("ai-input").click();
await page.waitForTimeout(300);
const seeded = await seedTeamRun(page, "running");
console.log("seeded", JSON.stringify(seeded));
await page.waitForTimeout(700);
await snap(page, "04-team-running-full", "팀 실행 중 · 막대 펼침 + 로그 안 보드 카드 (전체)");
await snap(page, "05-team-running-deck", "팀 실행 중 — 데크 크롭 (막대 「지금」 + 보드 카드가 한 기둥에 겹침)", deck);

// 4. 막대만 접고 보드 카드 보기
await page.getByTestId("ai-team-panel-toggle").click();
await page.waitForTimeout(400);
await snap(page, "06-team-running-bar-collapsed", "막대 접힘 — 한 줄 요약만, 상세는 로그 카드 안", deck);

// 5. 검토 대기 — 보드 카드에 적용/버리기
await page.evaluate(() => { document.querySelectorAll(".ai-team-board").forEach((n) => n.remove()); });
await seedTeamRun(page, "review");
await page.waitForTimeout(700);
await snap(page, "07-team-review-deck", "검토 대기 — 검수 지적·적용/버리기가 로그 카드 안에", deck);

// 6. 로그 안 보드 카드 크롭
const boardCard = page.getByTestId("ai-team-board").last();
if (await boardCard.isVisible().catch(() => false)) await snap(page, "08-team-board-card", "로그 안 팀 보드 카드 크롭", boardCard);

// 7. 팀 막대 펼침 + 명단 편집 폼
await page.getByTestId("ai-team-panel-toggle").click();
await page.waitForTimeout(400);
const edit = page.getByTestId("ai-team-member-edit").first();
if (await edit.isVisible().catch(() => false)) { await edit.click(); await page.waitForTimeout(400); await snap(page, "09-team-roster-form", "팀원 편집 폼 — 조수 데크 안에서 펼쳐진다", deck); }

writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), shots: manifest }, null, 2));
await browser.close();
console.log("done", manifest.length);
