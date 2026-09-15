/**
 * 「작업」 탭 QA — 실제 리듀서로 만든 `/pi` 실행 상태를 teamActivity 버스에 게시하고,
 * (a) 조수 데크의 「대화|작업」 탭이 팀원 열·과정 열을 그리는지, (b) 단독 실행은 팀원 열 없이 과정만인지,
 * (c) 검토 대기 스트립이 버스 액션을 부르는지, (d) 스튜디오 덱 「작업」이 상세(툴 인자)로 그리는지를
 * 스크린샷으로 남긴다. LLM 을 부르지 않는다.
 * 사용: BASE=http://127.0.0.1:9831 node scripts/qa/ai-work-tab-qa.mjs
 * 출력: output/evidence/ai-work-tab/<viewport>/*.png + SUMMARY.md
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9831";
const OUT = join(process.cwd(), "output", "evidence", "ai-work-tab");
mkdirSync(OUT, { recursive: true });
const summary = [];
const failures = [];

function check(label, ok, detail = "") {
  summary.push(`- ${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.removeItem("oprn:ai-panel-collapsed");
    localStorage.setItem("oprn:ai-studio", "0");
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
    const ok = await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
    if (ok) break;
  }
  for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.getByTestId("ai-work-tabs").waitFor({ state: "attached", timeout: 10_000 });
}

/**
 * 앱이 실제로 import 한 모듈 URL 을 서밙 소스에서 읽는다. Vite 는 HMR 로 무효화된 모듈에
 * `?t=…` 을 붙이므로, 베어 경로를 import 하면 **다른 인스턴스**의 버스에 게시하게 된다(2026-09-14 실측:
 * 패널은 teamActivity.ts?t=1789406276890, evaluate 는 teamActivity.ts — 구독자가 안 불렸다).
 */
async function resolveAppModules(page) {
  const source = await page.evaluate(async () => await (await fetch("/src/editor/panels/aiChatPanel.ts")).text());
  const pick = (needle, fallback) => {
    const match = source.match(new RegExp(`from "([^"]*${needle}[^"]*)"`));
    return match ? match[1] : fallback;
  };
  return {
    bus: pick("piAgent/teamActivity", "/src/ai/piAgent/teamActivity.ts"),
    boardState: pick("piAgent/teamBoardState", "/src/ai/piAgent/teamBoardState.ts"),
    store: pick("project/store", "/src/project/store.ts"),
  };
}

/** 앱과 같은 Vite 모듈 인스턴스를 import 해 버스에 게시한다 — 앱이 구독하는 바로 그 버스다. */
async function seed(page, stage) {
  const modules = await resolveAppModules(page);
  return await page.evaluate(async ({ stage, modules }) => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const [{ store }, bs, bus] = await Promise.all([load(modules.store), load(modules.boardState), load(modules.bus)]);
    bus.setTeamReviewActions(null);
    if (stage === "none") { bus.publishTeamActivity(null); return { agents: 0 }; }
    const project = store.getCurrent();
    const mapIds = Object.keys(project.maps);
    const m = (i) => ({ id: mapIds[i % mapIds.length], name: project.maps[mapIds[i % mapIds.length]]?.name ?? mapIds[i % mapIds.length] });
    const steps = [];
    const push = (e) => steps.push(e);
    let state;
    if (stage === "single") {
      state = bs.createTeamBoardState("single", "우물 옆에 벤치 두 개 놓고 주변에 꽃 심어줘");
      push({ type: "agent_spawn", agentId: m(0).id, role: "builder", mapId: m(0).id, mapName: m(0).name, task: state.task });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "turn", index: 1 } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "tool_start", id: "s1", name: "get_map_region", args: { x: 15, y: 9, w: 7, h: 7 } } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "tool_end", id: "s1", name: "get_map_region", ok: true, summary: "우물 주변 7×7 · 빈 칸 31" } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "assistant", text: "우물 양옆 두 칸씩 띄워 벤치를 마주 보게 놓습니다." } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "turn", index: 2 } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "tool_start", id: "s2", name: "place_event", args: { kind: "bench", at: [[16, 13], [20, 13]] } } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "tool_end", id: "s2", name: "place_event", ok: true, summary: "벤치 (16,13) · 벤치 (20,13)" } });
      push({ type: "agent_event", agentId: m(0).id, event: { type: "tool_start", id: "s3", name: "lint_map", args: {} } });
    } else {
      state = bs.createTeamBoardState("team", "마을 북쪽에 대장간 거리를 만들고 남쪽 숲길을 정비해줘");
      push({ type: "team_start", task: state.task, roles: [] });
      push({ type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: state.task });
      push({ type: "agent_event", agentId: "lead", event: { type: "turn", index: 1 } });
      push({ type: "agent_event", agentId: "lead", event: { type: "tool_start", id: "l1", name: "get_map_region", args: { mapId: m(0).id } } });
      push({ type: "agent_event", agentId: "lead", event: { type: "tool_end", id: "l1", name: "get_map_region", ok: true, summary: "시장 마을 40×30 · 북쪽 잔디 84%" } });
      push({ type: "agent_event", agentId: "lead", event: { type: "assistant", text: "북쪽 빈터에 대장간 거리를, 남쪽 숲에 길 정비를 배정합니다." } });
      push({ type: "agent_spawn", agentId: "a1", role: "builder", mapId: m(0).id, mapName: m(0).name, task: "북쪽 (12,4)~(28,10) 에 대장간 2채와 앞마당 돌길을 놓는다. 입구는 남향.", memberId: "architect", label: "건축가" });
      const tools = [
        ["get_map_region", true, "시장 마을 (10,2)–(30,12) · 잔디 84% · 빈 자리 확인", { x: 10, y: 2, w: 20, h: 10 }],
        ["find_open_area", true, "3×3 이상 빈 구역 4곳 — (13,5) (20,5) (14,9) (22,9)", { minW: 3, minH: 3 }],
        ["place_structure", true, "대장간 「서쪽」 6×5 (13,5) · 지붕 갈색", { kind: "smithy", x: 13, y: 5, roof: "brown" }],
        ["place_structure", true, "대장간 「동쪽」 6×5 (21,5)", { kind: "smithy", x: 21, y: 5 }],
        ["paint_path", true, "돌길 (14,10)→(26,10) 폭 2", { from: [14, 10], to: [26, 10], width: 2 }],
        ["paint_path", false, "(27,7) 은 나무 — 우회 필요", { from: [26, 10], to: [27, 7] }],
        ["paint_path", true, "돌길 (26,10)→(27,11) 한 칸 남쪽 우회", { from: [26, 10], to: [27, 11] }],
        ["place_event", true, "모루·화로 소품 (15,8) (23,8)", { props: ["anvil", "forge"], at: [[15, 8], [23, 8]] }],
        ["lint_map", true, "reachability 통과 · 겹침 0", {}],
      ];
      let turn = 0;
      tools.forEach(([name, ok, sum, args], i) => {
        if (i % 3 === 0) push({ type: "agent_event", agentId: "a1", event: { type: "turn", index: ++turn } });
        push({ type: "agent_event", agentId: "a1", event: { type: "tool_start", id: `a1-${i}`, name, args } });
        if (i === 4) push({ type: "agent_event", agentId: "a1", event: { type: "assistant", text: "두 대장간 사이 폭 2 를 남겨 앞마당 돌길을 남향으로 뺍니다." } });
        push({ type: "agent_event", agentId: "a1", event: { type: "tool_end", id: `a1-${i}`, name, ok, summary: sum } });
      });
      push({ type: "agent_spawn", agentId: "a2", role: "builder", mapId: m(1).id, mapName: m(1).name, task: "남쪽 숲길을 폭 2 로 정리하고 끊긴 곳을 잇는다.", memberId: "gardener", label: "정원사" });
      push({ type: "agent_event", agentId: "a2", event: { type: "turn", index: 1 } });
      push({ type: "agent_event", agentId: "a2", event: { type: "tool_start", id: "a2-1", name: "paint_path", args: { width: 2 } } });
      if (stage === "running") {
        push({ type: "agent_event", agentId: "a1", event: { type: "tool_start", id: "a1-live", name: "lint_map", args: {} } });
      } else {
        push({ type: "agent_event", agentId: "a2", event: { type: "tool_end", id: "a2-1", name: "paint_path", ok: true, summary: "숲길 32칸 · 끊긴 구간 3곳 이음" } });
        push({ type: "agent_done", agentId: "a1", ok: true, summary: "대장간 2채와 앞마당 돌길을 놓았습니다.", stats: { ms: 48_000, turns: 3, toolCalls: 9, toolErrors: 1 }, changedKeys: [`maps.${m(0).id}`], spills: [], conflicts: [] });
        push({ type: "agent_done", agentId: "a2", ok: true, summary: "숲길을 폭 2 로 정리했습니다.", stats: { ms: 21_000, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [`maps.${m(1).id}`], spills: [], conflicts: [] });
        push({ type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: m(0).id, mapName: m(0).name, task: "전체 맵 조화 검수", memberId: "reviewer", label: "검수관" });
        push({ type: "agent_event", agentId: "r1", event: { type: "tool_start", id: "r1-1", name: "lint_map", args: {} } });
        push({ type: "agent_event", agentId: "r1", event: { type: "tool_end", id: "r1-1", name: "lint_map", ok: true, summary: "돌길 (20,9) 한 칸 끊김 · 지붕-나무 겹침 (27,5)" } });
        push({ type: "review", agentId: "r1", mapId: m(0).id, ok: false, findings: ["(20,9) 대장간 입구 앞 돌길이 한 칸 끊김", "동쪽 대장간 지붕이 (27,5) 나무와 겹침"] });
        push({ type: "team_report", text: "대장간 2채를 (13,5)·(21,5)에 세우고 앞마당 돌길을 남향으로 뺐습니다. 검수 지적 2건은 재배정으로 고쳤습니다." });
      }
    }
    for (const step of steps) state = bs.reduceTeamBoard(state, step);
    if (stage === "review") {
      window.__qaReviewClicks = { apply: 0, discard: 0, report: 0 };
      bus.setTeamReviewActions({
        apply: () => { window.__qaReviewClicks.apply += 1; },
        discard: () => { window.__qaReviewClicks.discard += 1; },
        openReport: () => { window.__qaReviewClicks.report += 1; },
      });
      state = bs.markTeamBoardReview(state, ["타일 128칸", "이벤트 +2", "맵 2"]);
    }
    bus.publishTeamActivity(state);
    return { agents: state.agents.length, phase: state.phase };
  }, { stage, modules });
}

async function rect(page, testid) {
  return await page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), hidden: node.hidden };
  }, testid);
}

async function runViewport(browser, width, height) {
  const dir = join(OUT, `${width}x${height}`);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await boot(page);
  const tabs = page.getByTestId("ai-work-tabs");
  check(`${width}: 실행이 없으면 탭 줄은 숨어 있다`, (await tabs.getAttribute("hidden")) !== null);

  // (a) 팀 실행 → 자동으로 작업 탭
  const running = await seed(page, "running");
  await page.waitForTimeout(400);
  check(`${width}: 팀 실행이 오면 탭 줄이 보이고 「작업」이 선택된다`, (await tabs.getAttribute("hidden")) === null && (await page.getByTestId("ai-work-tab-work").getAttribute("aria-selected")) === "true", `agents=${running.agents}`);
  const members = await page.getByTestId("ai-team-work-member").count();
  check(`${width}: 팀원 열에 3명(팀장·건축가·정원사)`, members === 3, `members=${members}`);
  const txName = await page.getByTestId("ai-team-tx-name").textContent();
  check(`${width}: 과정 열은 최근 배정 팀원(정원사)을 따라간다`, txName === "정원사", txName ?? "");
  await page.getByTestId("ai-team-work-member").nth(1).click();
  await page.waitForTimeout(150);
  const architect = await page.getByTestId("ai-team-tx-name").textContent();
  const toolRows = await page.getByTestId("ai-team-tx-tool").count();
  check(`${width}: 건축가를 누르면 그 과정(툴 10행)이 보인다`, architect === "건축가" && toolRows >= 9, `name=${architect} tools=${toolRows}`);
  const pane = await rect(page, "ai-team-work");
  const composer = await rect(page, "ai-command-bar") ?? await rect(page, "ai-composer");
  check(`${width}: 작업 페인은 호스트의 55% 이상 키(목업 계약 ≈68%)`, pane !== null && pane.h >= height * 0.55, `pane=${JSON.stringify(pane)}`);
  check(`${width}: 컴포저는 여전히 맨 아래에 있다`, composer !== null && pane !== null && composer.y >= pane.y + pane.h - 4, `composer=${JSON.stringify(composer)}`);
  const chatBody = await rect(page, "ai-chat-body");
  check(`${width}: 작업 탭에서 채팅 본문은 숨는다`, chatBody === null || chatBody.hidden || chatBody.h === 0);
  await page.screenshot({ path: join(dir, "01-work-team-running.png") });

  // (b) 대화 탭으로 → 실행 종료(검토 대기)가 오면 배지 — 배지는 「작업 탭을 보는 중」일 때만
  await page.getByTestId("ai-work-tab-chat").click();
  await page.waitForTimeout(150);
  check(`${width}: 「대화」를 누르면 채팅 본문이 돌아온다`, (await rect(page, "ai-chat-body"))?.hidden === false);
  await seed(page, "review");
  await page.waitForTimeout(300);
  const badgeOnChat = await page.getByTestId("ai-work-tab-badge").getAttribute("hidden");
  check(`${width}: 대화 탭을 보던 중이면 배지는 뜨지 않는다`, badgeOnChat !== null);
  await page.getByTestId("ai-work-tab-work").click();
  await page.waitForTimeout(200);
  const strip = await rect(page, "ai-team-work-review");
  check(`${width}: 검토 대기 스트립이 보인다`, strip !== null && !strip.hidden && strip.h > 0, JSON.stringify(strip));
  const stripText = await page.getByTestId("ai-team-work-review").textContent();
  check(`${width}: 스트립에 변경 칩 문장이 있다`, (stripText ?? "").includes("타일 128칸"), stripText ?? "");
  await page.getByTestId("ai-team-work-report").click();
  await page.getByTestId("ai-team-work-apply").click();
  const clicks = await page.evaluate(() => window.__qaReviewClicks);
  check(`${width}: 「보고서 열기」「적용」이 버스 액션을 부른다`, clicks?.report === 1 && clicks?.apply === 1, JSON.stringify(clicks));
  const live = await page.getByTestId("ai-work-tab-work").locator(".ai-work-tab-live").getAttribute("data-state");
  check(`${width}: 작업 탭 점은 검토 대기 색(attention)`, live === "attention", live ?? "");
  await page.screenshot({ path: join(dir, "02-work-review-strip.png") });

  // (c) 배지 — 작업 탭을 보는 중에 실행이 끝나면 대화 탭에 1
  await seed(page, "running");
  await page.waitForTimeout(200);
  await seed(page, "review");
  await page.waitForTimeout(200);
  const badge = page.getByTestId("ai-work-tab-badge");
  check(`${width}: 작업 탭을 보던 중 답이 오면 「대화」에 배지 1`, (await badge.getAttribute("hidden")) === null && (await badge.textContent()) === "1");
  await page.getByTestId("ai-work-tab-chat").click();
  await page.waitForTimeout(100);
  check(`${width}: 대화 탭을 열면 배지가 사라진다`, (await badge.getAttribute("hidden")) !== null);

  // (d) 단독 실행 — 팀원 열 없이 과정만
  const single = await seed(page, "single");
  await page.waitForTimeout(300);
  check(`${width}: 단독 실행도 「작업」으로 자동 전환된다`, (await page.getByTestId("ai-work-tab-work").getAttribute("aria-selected")) === "true", `agents=${single.agents}`);
  const isSingle = await page.evaluate(() => document.querySelector(".ai-team-work-body")?.classList.contains("is-single"));
  const membersBox = await rect(page, "ai-team-work-members");
  check(`${width}: 단독 실행은 팀원 열이 없다(is-single, 폭 0)`, isSingle === true && (membersBox === null || membersBox.w === 0), JSON.stringify(membersBox));
  check(`${width}: 압축 보기에는 툴 인자 줄이 없다`, (await page.getByTestId("ai-team-tx-args").count()) === 0);
  await page.screenshot({ path: join(dir, "03-work-single-run.png") });

  // (e) 스튜디오 — 덱 「작업」이 상세 페인
  await seed(page, "running");
  await page.waitForTimeout(200);
  await page.getByTestId("topbar-ai-studio").click();
  await page.getByTestId("ai-studio-shell").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
  const deckTabsHidden = await page.evaluate(() => {
    const tabsNode = document.querySelector('[data-testid="ai-work-tabs"]');
    return tabsNode ? getComputedStyle(tabsNode).display === "none" : true;
  });
  check(`${width}: 스튜디오에서는 데크 탭 줄이 숨는다`, deckTabsHidden);
  await page.getByTestId("ai-studio-tab-work").click();
  await page.waitForTimeout(300);
  const detail = await page.evaluate(() => document.querySelector('[data-testid="ai-studio-deck-pane"] [data-testid="ai-team-work"]')?.getAttribute("data-detail"));
  check(`${width}: 스튜디오 덱 「작업」은 상세 페인이다`, detail === "true", String(detail));
  await page.locator('[data-testid="ai-studio-deck-pane"] [data-testid="ai-team-work-member"]').nth(1).click();
  await page.waitForTimeout(150);
  const argRows = await page.locator('[data-testid="ai-studio-deck-pane"] [data-testid="ai-team-tx-args"]').count();
  const firstArgs = await page.locator('[data-testid="ai-studio-deck-pane"] [data-testid="ai-team-tx-args"]').first().textContent();
  check(`${width}: 상세 페인은 툴 인자 줄을 그린다`, argRows >= 5, `rows=${argRows} first=${firstArgs}`);
  const workBadge = await page.getByTestId("ai-studio-tab-work").textContent();
  check(`${width}: 스튜디오 「작업」 배지는 실행 중 인원`, (workBadge ?? "").includes("3"), workBadge ?? "");
  const deckPane = await rect(page, "ai-studio-deck-pane");
  check(`${width}: 기본 높이 덱은 보드가 뜨면 420 으로 자란다`, deckPane !== null && deckPane.h >= 400, JSON.stringify(deckPane));
  await page.screenshot({ path: join(dir, "04-studio-work-detail.png") });
  await seed(page, "none");

  check(`${width}: 페이지 오류 0`, errors.length === 0, errors.join(" | "));
  await page.close();
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  await runViewport(browser, 1440, 900);
  await runViewport(browser, 1920, 1080);
} finally {
  await browser.close();
}
const status = failures.length === 0 ? "전부 통과" : `실패 ${failures.length}건`;
writeFileSync(join(OUT, "SUMMARY.md"), `# 「작업」 탭 QA — ${status}\n\n${summary.join("\n")}\n\n즉시 확인: 1440x900/01-work-team-running.png · 02-work-review-strip.png · 03-work-single-run.png · 04-studio-work-detail.png\n`);
console.log(summary.join("\n"));
console.log(status);
process.exit(failures.length === 0 ? 0 : 1);
