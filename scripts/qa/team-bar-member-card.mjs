// 상태 줄 조수 칩 → 조수 카드 → 오른쪽 조수 상세 → 크게 보기. 메모리 fixture(팀 보드 이벤트)만 쓰고 프로젝트는 저장하지 않는다.
// 사용: QA_BASE_URL=http://127.0.0.1:9974 node scripts/qa/team-bar-member-card.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9974";
const out = resolve(process.env.QA_OUTPUT_DIR ?? "verify-shots/team-bar-member-card");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", e => errors.push(e.message));
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`); };
const shot = (name, options = {}) => page.screenshot({ path: resolve(out, `${name}.png`), ...options });

try {
  await page.addInitScript(() => {
    for (const [key, value] of Object.entries({ "oprn:locale": "ko", "oprn:standard-welcome-seen": "1", "oprn:editor-welcome-dismissed": "1", "oprn:ai-activity-level": "brief", "oprn:ai-team-sidebar-collapsed": "0" })) localStorage.setItem(key, value);
  });
  // scarloxy 데모: 맵 영역 그림(get_map_region visuals)이 실제로 만들어지는 칩셋. 빈 프로젝트의 기본 칩셋은 그림 상한을 넘어 그림이 없다.
  await page.goto(`${base}/?devProject=1&scarloxyDemo=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 120000 });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });

  const fixture = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { resolveCurrentMapId } = await import("/src/editor/mapSelection.ts");
    const { createTeamBoardState, reduceTeamBoard } = await import("/src/ai/piAgent/teamBoardState.ts");
    const { publishTeamActivity } = await import("/src/ai/piAgent/teamActivity.ts");
    const { captureActivityVisuals } = await import("/src/ai/activityVisual.ts");
    const project = store.getCurrent();
    const mapA = resolveCurrentMapId();
    const others = Object.keys(project.maps).filter(id => id !== mapA);
    const mapB = others[0] ?? mapA;
    const nameA = project.maps[mapA].name, nameB = project.maps[mapB].name;
    const t0 = Date.now() - 74_000;
    let board = createTeamBoardState("team", "시작 마을을 완성해 줘 — 지형·건물, 여관·상점 실내, 마지막에 통행·시각 검수", project.id);
    const put = (event, dt) => { board = reduceTeamBoard(board, { ...event, at: t0 + dt }); };
    const inner = (agentId, event, dt) => put({ type: "agent_event", agentId, event: { ...event, at: t0 + dt } }, dt);
    const tool = (agentId, id, name, args, summary, start, end, ok = true, withVisual = false) => {
      inner(agentId, { type: "tool_start", id, name, args }, start);
      if (end === null) return;
      const visuals = withVisual ? captureActivityVisuals(project, "get_map_region", args) : undefined;
      inner(agentId, { type: "tool_end", id, name, ok, summary, durationMs: end - start, ...(visuals?.length ? { visuals } : {}) }, end);
    };
    put({ type: "team_start", task: board.task, roles: [{ id: "orchestrator", label: "팀장" }, { id: "builder", label: "시공" }, { id: "reviewer", label: "검수" }] }, 0);
    put({ type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: "요청을 맵별 작업으로 나누고 조수에게 배정", label: "팀장" }, 200);
    tool("lead", "l1", "list_maps", {}, "맵 4개 확인", 600, 1400);
    tool("lead", "l2", "assign_map_agent", { mapId: mapA }, `${nameA}에 시공 1 배정`, 2000, 2600);
    tool("lead", "l3", "assign_map_agent", { mapId: mapB }, `${nameB}에 시공 2 배정`, 2800, 3300);
    tool("lead", "l4", "wait_agents", {}, "", 3600, null);
    put({ type: "agent_spawn", agentId: "b1", role: "builder", mapId: mapA, mapName: nameA, memberId: "builder", task: "시작 마을 지형·건물 시공 — 남쪽 광장 길, 대장간·여관 외벽, 우물", label: "시공 1" }, 2700);
    tool("b1", "b1-1", "get_map_region", { mapId: mapA, x: 4, y: 4, width: 24, height: 16 }, "광장 주변 24×16 읽기", 4000, 6400, true, true);
    tool("b1", "b1-2", "paint_terrain", { mapId: mapA, x: 6, y: 9, width: 14, height: 3 }, "남쪽 광장 흙길 42칸", 8000, 12800);
    tool("b1", "b1-3", "place_building", { mapId: mapA, x: 10, y: 4 }, "대장간 외벽·지붕 배치", 14000, 21500);
    tool("b1", "b1-4", "place_building", { mapId: mapA, x: 18, y: 5 }, "여관 외벽 배치 — 문 위치가 길과 어긋남", 23000, 26100, false);
    tool("b1", "b1-5", "place_building", { mapId: mapA, x: 18, y: 6 }, "여관 외벽 다시 배치 — 문을 길 쪽으로", 27500, 33900);
    tool("b1", "b1-6", "place_props", { mapId: mapA, x: 14, y: 11 }, "우물·벤치·화분 6개", 35000, 41200);
    tool("b1", "b1-7", "get_map_region", { mapId: mapA, x: 6, y: 3, width: 24, height: 16 }, "시공 결과 다시 읽기", 43000, 45600, true, true);
    tool("b1", "b1-8", "paint_terrain", { mapId: mapA, x: 4, y: 14, width: 8, height: 4 }, "", 69000, null);
    put({ type: "agent_spawn", agentId: "b2", role: "builder", mapId: mapB, mapName: nameB, memberId: "decorator", task: "실내 여관·상점 가구 배치 — 카운터, 침대 2개, 진열장", label: "시공 2" }, 3200);
    tool("b2", "b2-1", "get_map_region", { mapId: mapB, x: 0, y: 0, width: 20, height: 14 }, "여관 1층 실내 읽기", 5000, 7600, true, true);
    tool("b2", "b2-2", "place_props", { mapId: mapB, x: 3, y: 3 }, "카운터·장부 배치", 9000, 15600);
    tool("b2", "b2-3", "place_props", { mapId: mapB, x: 9, y: 2 }, "침대 2개·협탁 배치", 17000, 24400);
    tool("b2", "b2-4", "place_props", { mapId: mapB, x: 12, y: 8 }, "", 26000, null);
    put({ type: "agent_spawn", agentId: "rv", role: "reviewer", mapId: mapA, mapName: nameA, memberId: "reviewer", task: "맵 통행·시각 조화 검수 — 막힌 길, 겹친 지붕, 문 앞 통로", label: "검수" }, 3400);
    tool("rv", "rv-1", "get_map_region", { mapId: mapA, x: 4, y: 4, width: 24, height: 16 }, "검수 대상 영역 읽기", 47000, 49200);
    tool("rv", "rv-2", "check_passability", { mapId: mapA }, "광장→여관 문 통행 확인", 50000, 54400);
    tool("rv", "rv-3", "get_map_region", { mapId: mapA, x: 16, y: 4, width: 12, height: 10 }, "", 70000, null);
    publishTeamActivity(board);
    // 실제 팀 실행(aiPiAgentCommand)이 거는 상태 문구 — fixture 는 런타임을 거치지 않으므로 같은 문구를 직접 건다.
    const status = document.querySelector('[data-testid="ai-status"]');
    if (status) status.textContent = "팀원들이 작업하고 있어요.";
    return { mapA, mapB, nameA, nameB, agents: board.agents.map(a => [a.agentId, a.roleLabel, a.state, a.toolCalls]) };
  });
  check("fixture published", fixture.agents.length === 4, fixture);

  const bar = page.getByTestId("ai-status-bar");
  await bar.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="ai-status-chip"]').length >= 3, null, { timeout: 10000 });
  const chipNames = await page.locator('[data-testid="ai-status-chip"] b').allInnerTexts();
  check("bar shows team member chips", chipNames.length >= 3, chipNames);
  const statusText = () => page.evaluate(() => document.querySelector('[data-testid="ai-status"]')?.textContent ?? "");
  check("status reads '팀원들이 작업하고 있어요'", (await statusText()).includes("팀원들이 작업하고 있어요"), await statusText());
  await shot("01-bar-full");
  const barBox = await bar.boundingBox();
  await shot("01-bar-zoom", { clip: { x: Math.max(0, barBox.x - 16), y: Math.max(0, barBox.y - 60), width: Math.min(1600 - Math.max(0, barBox.x - 16), barBox.width + 32), height: barBox.height + 76 } });

  // 칩 클릭 → 조수 카드
  await page.locator('[data-testid="ai-status-chip"][data-presence-id="b1"]').click();
  const pop = page.getByTestId("ai-status-pop");
  await pop.waitFor({ state: "visible" });
  await page.waitForTimeout(600); // media image decode
  const card = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="ai-status-pop"]');
    const rect = p.getBoundingClientRect();
    return {
      width: Math.round(rect.width), top: Math.round(rect.top), bottom: Math.round(rect.bottom), right: Math.round(rect.right),
      name: p.querySelector(".ai-status-pop-title strong")?.textContent,
      task: p.querySelector('[data-testid="ai-status-pop-task"] p')?.textContent,
      now: p.querySelector('[data-testid="ai-status-pop-now"]')?.textContent,
      spinner: !!p.querySelector(".ai-status-pop-now-banner .ai-status-spinner"),
      rows: [...p.querySelectorAll('[data-testid="ai-status-pop-timeline"] li')].map(li => [li.dataset.status, li.querySelector(".ai-status-step-text")?.textContent, li.querySelector("time")?.textContent]),
      media: !!p.querySelector('[data-testid="ai-status-pop-media"] img, [data-testid="ai-status-pop-media"] canvas'),
      clock: p.querySelector('[data-testid="ai-status-pop-clock"]')?.textContent,
      buttons: [...p.querySelectorAll(".ai-status-pop-actions button")].map(b => b.textContent),
      overflow: [...p.querySelectorAll("*")].filter(n => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow === "visible").map(n => n.className).slice(0, 5),
    };
  });
  check("card is 420px and above the bar", card.width === 420 && card.bottom <= barBox.y, card);
  check("card header names the member", card.name === "시공 1", card.name);
  check("card shows assigned task", card.task?.includes("시작 마을 지형"), card.task);
  check("card live banner has spinner", card.spinner, card.now);
  check("card timeline lists >= 6 steps incl. running + error", card.rows.length >= 6 && card.rows.some(r => r[0] === "running") && card.rows.some(r => r[0] === "error"), card.rows);
  check("card shows media preview", card.media);
  check("card clock shows steps + elapsed", /단계 진행 · \d+분/.test(card.clock ?? ""), card.clock);
  check("card footer actions", card.buttons.some(t => t.includes("조수 상세 패널 열기")) && card.buttons.some(t => t.includes("멈춤")), card.buttons);
  await shot("02-card-full");
  const popBox = await pop.boundingBox();
  await shot("02-card-zoom", { clip: { x: Math.max(0, popBox.x - 20), y: Math.max(0, popBox.y - 20), width: popBox.width + 40, height: Math.min(1000 - Math.max(0, popBox.y - 20), popBox.height + 40 + barBox.height + 20) } });

  // 조수 상세 패널 열기 → 오른쪽 도크가 같은 조수로 열린다
  await page.getByTestId("ai-status-detail").click();
  const detail = page.getByTestId("ai-member-detail");
  await detail.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(600);
  const dock = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="ai-member-detail"]');
    const records = document.querySelector('[data-testid="ai-member-records"]');
    return {
      title: d.querySelector(".ai-team-member-head strong")?.textContent,
      assignment: document.querySelector('[data-testid="ai-member-assignment"]')?.textContent,
      recordsOpen: records?.open, recordsVisible: !!records && records.getBoundingClientRect().height > 40,
      media: !document.querySelector('[data-testid="ai-member-media"]')?.hidden,
      composer: !!document.querySelector('[data-testid="ai-member-input"]') && document.querySelector('[data-testid="ai-member-input"]').getBoundingClientRect().height > 0,
      tabs: !document.querySelector('[data-testid="ai-workspace-tabs"]')?.hidden,
      teamTab: document.querySelector('[data-testid="ai-workspace-team-tab"]')?.textContent,
      selectedRow: document.querySelector('[data-testid="ai-team-member"][aria-pressed="true"]')?.dataset.agentId,
    };
  });
  check("dock opened to the clicked member", dock.title === "시공 1" && dock.selectedRow === "b1", dock);
  check("dock records open by default", dock.recordsOpen && dock.recordsVisible, dock);
  check("dock shows media + follow-up composer", dock.media && dock.composer, dock);
  check("workspace tabs visible with team count", dock.tabs && /조수 \d/.test(dock.teamTab ?? ""), dock.teamTab);
  await shot("03-dock-member");
  const panelBox = await page.locator(".ai-chat-panel").first().boundingBox();
  if (panelBox) await shot("03-dock-zoom", { clip: { x: panelBox.x, y: 0, width: Math.min(panelBox.width, 1600 - panelBox.x), height: 1000 } });

  // 다른 칩: 도크가 이미 조수 화면이면 같은 조수로 따라간다. 도크가 열리면 줄이 좁아지므로 넓은 화면에서 본다.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(300);
  await page.locator('[data-testid="ai-status-chip"][data-presence-id="rv"]').click();
  await pop.waitFor({ state: "visible" });
  await page.waitForTimeout(250);
  const followed = await page.evaluate(() => document.querySelector('[data-testid="ai-member-detail"] .ai-team-member-head strong')?.textContent);
  check("chip click syncs visible dock to member", followed === "검수", followed);
  await shot("04-chip-sync");
  await page.keyboard.press("Escape");

  // 크게 보기
  const wide = page.getByTestId("ai-wide-open");
  check("wide button visible", await wide.isVisible());
  await wide.click();
  await page.waitForTimeout(800);
  await shot("05-wide-studio");
  const wideState = await page.evaluate(() => ({ dialog: !!document.querySelector("dialog[open], .ai-wide, .is-wide"), team: !!document.querySelector('[data-testid="ai-team-sidebar"]:not([hidden])') }));
  check("wide studio shows team surface", wideState.team, wideState);
} catch (error) {
  errors.push(String(error?.stack ?? error));
  await shot("zz-error").catch(() => {});
} finally {
  writeFileSync(resolve(out, "report.json"), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).map(c => c.name), errors }, null, 2));
  await browser.close();
}
