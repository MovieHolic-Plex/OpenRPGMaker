/**
 * 조수 UI/UX 개편 제안(2026-09-17) — 「지금」 증거 캡처.
 * 사용: BASE=http://127.0.0.1:9893 node docs/2026-09-17-assistant-uiux-proposal-assets/capture-current.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9893";
const OUT = join(process.cwd(), "docs", "2026-09-17-assistant-uiux-proposal-assets", process.env.OUT_DIR ?? "current");
mkdirSync(OUT, { recursive: true });
const manifest = [];

async function snap(page, name, caption, locator) {
  const path = join(OUT, `${name}.png`);
  try {
    if (locator) await locator.screenshot({ path, timeout: 8000 });
    else await page.screenshot({ path, fullPage: false });
  } catch (e) { console.log("snap fail", name, e.message.split("\n")[0]); return; }
  const box = locator ? await locator.boundingBox().catch(() => null) : null;
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

async function seedConversation(page) {
  return await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const { store } = await load("/src/project/store.ts");
    const { conversationScopeKey } = await load("/src/ai/conversationStore.ts");
    const contextKey = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    const record = {
      id: "proposal-fixture-0917", title: "시장 광장 손보기", model: "fixture", savedAt: Date.now(), projectContextKey: contextKey,
      entries: [
        { kind: "user", text: "시장 광장 북쪽에 우물을 하나 놓고, 상인 두 명을 광장 주변에 세워줘" },
        { kind: "tool", name: "get_map_info", args: {}, ok: true, summary: "시장 마을 60×45 · 이벤트 18 · 바닥 잔디/돌길" },
        { kind: "tool", name: "find_open_area", args: { near: "plaza" }, ok: true, summary: "광장 북쪽 3×3 빈 자리 (24,11)" },
        { kind: "tool", name: "place_structure", args: { kind: "well" }, ok: true, summary: "우물 1 · 타일 9칸" },
        { kind: "tool", name: "place_npc", args: { role: "merchant" }, ok: true, summary: "상인 「하나」 (22,14) · 상인 「두리」 (27,15)" },
        { kind: "assistant", text: "광장 북쪽 **(24,11)** 에 우물을 놓고, 상인 **하나**와 **두리**를 광장 양쪽에 세웠습니다.\n\n- 우물은 돌길과 맞닿게 두어 동선이 끊기지 않습니다.\n- 상인 둘은 서로 마주보는 방향으로 두었습니다.\n\n다음으로 상점 창(물건 목록)을 붙일까요?" },
        { kind: "user", text: "두리는 무기 상인으로 하고 검·방패만 팔게 해줘" },
        { kind: "tool", name: "configure_shop", args: { npc: "두리" }, ok: true, summary: "상점 「두리의 무기점」 · 품목 2 (동검, 나무 방패)" },
        { kind: "assistant", text: "「두리」에게 무기점 상점 창을 붙였습니다. 품목은 **동검**(120G)·**나무 방패**(80G) 둘입니다. 가격은 DB 기본값을 썼으니 바꾸려면 말씀해 주세요." },
      ],
    };
    const { saveConversation } = await load("/src/ai/conversationStore.ts");
    const outcome = await saveConversation(record);
    return { contextKey, outcome };
  });
}

async function mountChangeCard(page) {
  return await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const [{ store }, preview] = await Promise.all([load("/src/project/store.ts"), load("/src/editor/panels/aiChangePreview.ts")]);
    const before = store.getCurrent();
    const mapId = before.startMapId ?? Object.keys(before.maps)[0];
    const map = before.maps[mapId];
    if (!map) return "no map";
    const counts = new Map();
    for (const t of map.lowerTiles) if (t > 0) counts.set(t, (counts.get(t) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const rectW = Math.min(8, map.width), rectH = Math.min(6, map.height);
    const x0 = Math.floor((map.width - rectW) / 2), y0 = Math.floor((map.height - rectH) / 2);
    const centerTile = map.lowerTiles[y0 * map.width + x0];
    const paint = ranked.find((t) => t !== centerTile) ?? ranked[0];
    const after = structuredClone(before);
    for (let y = y0; y < y0 + rectH; y++) for (let x = x0; x < x0 + rectW; x++) after.maps[mapId].lowerTiles[y * map.width + x] = paint;
    const card = preview.renderChangePreviewCard({
      before, after, mapId, title: "우물 1 · 상인 2 · 바닥 9칸", detail: "place_structure · place_npc",
      chips: preview.changePreviewChips({ tilesChanged: 9, eventsAdded: 2, eventsModified: 0, eventsRemoved: 0, mapsAdded: 0, mapsRemoved: 0, dbRecordsChanged: 1, tilesetsChanged: 0, switchesAdded: 0, variablesAdded: 0, worldEntitiesAdded: 0, worldEntitiesModified: 0, palettePresetsAdded: 0, palettePresetsModified: 0, endingsChanged: 0, sessionChanged: false, systemChanged: false, warnings: [] }),
      onUndo: () => {},
    });
    const log = [...document.querySelectorAll(".ai-chat-log")].find((n) => n.getClientRects().length > 0) ?? document.querySelector(".ai-chat-log");
    if (!log) return "no log";
    log.append(card); card.scrollIntoView();
    return "ok";
  });
}

async function seedTeamRun(page, phase) {
  return await page.evaluate(async (phase) => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const [{ store }, boardState, activity, boardMod] = await Promise.all([
      load("/src/project/store.ts"), load("/src/ai/piAgent/teamBoardState.ts"), load("/src/ai/piAgent/teamActivity.ts"), load("/src/editor/panels/aiTeamBoard.ts"),
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
    const board = boardMod.createTeamBoard(state);
    if (phase === "review") board.setReview({ onApply() {}, onDiscard() {} });
    const log = [...document.querySelectorAll(".ai-chat-log")].find((n) => n.getClientRects().length > 0) ?? document.querySelector(".ai-chat-log");
    if (log) { log.append(board.root); board.root.scrollIntoView(); }
    return { agents: state.agents.length, phase: state.phase, log: Boolean(log) };
  }, phase);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("dialog", (d) => d.accept());

await boot(page);
const panel = page.getByTestId("ai-panel");
const deck = page.getByTestId("ai-deck");

// metrics dump
const metrics = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const cs = (el, p) => el ? getComputedStyle(el)[p] : null;
  const deck = q('[data-testid="ai-deck"]');
  return {
    viewport: { w: innerWidth, h: innerHeight },
    deck: r(deck), deckBg: cs(deck, "backgroundColor"), deckBackdrop: cs(deck, "backdropFilter"),
    rail: r(q('[data-testid="ai-deck-rail"]')), bar: r(q('[data-testid="ai-command-bar"]')), input: r(q('[data-testid="ai-input"]')),
    inputFont: cs(q('[data-testid="ai-input"]'), "fontSize"), inputPlaceholder: q('[data-testid="ai-input"]')?.getAttribute("placeholder"),
    canvas: r(q('[data-testid="edit-canvas"]')),
    railText: q('[data-testid="ai-deck-rail"]')?.innerText, barText: q('[data-testid="ai-command-bar"]')?.innerText,
    buttons: [...(deck?.querySelectorAll("button") ?? [])].map((b) => ({ t: (b.textContent || "").trim().slice(0, 24), title: b.title || b.getAttribute("aria-label") || "", w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })),
  };
});
writeFileSync(join(OUT, "metrics-idle.json"), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics).slice(0, 1500));

const clickTid = async (tid, wait = 400) => {
  const l = page.getByTestId(tid).first();
  if (!(await l.isVisible().catch(() => false))) { console.log("absent", tid); return false; }
  await l.click({ timeout: 5000 }).catch((e) => console.log("click fail", tid, e.message.split("\n")[0]));
  await page.waitForTimeout(wait); return true;
};
const closeAll = async () => {
  for (const tid of ["ai-settings-close", "tool-browser-close", "ai-instructions-close", "ai-history-close", "ai-harness-close"]) {
    const l = page.getByTestId(tid).first();
    if (await l.isVisible().catch(() => false)) { await l.click().catch(() => {}); await page.waitForTimeout(250); }
  }
  const menu = page.getByTestId("ai-command-menu");
  if (await menu.isVisible().catch(() => false)) { await clickTid("ai-command-menu-toggle", 250); }
  for (const tid of ["ai-preference-popover", "ai-plan-book-overlay", "ai-context-panel"]) {
    const l = page.getByTestId(tid).first();
    if (await l.isVisible().catch(() => false)) { await page.mouse.click(700, 300); await page.waitForTimeout(250); }
  }
};

await snap(page, "01-idle-full", "빈 대화 · 유휴 데크 (1440×900)");
await snap(page, "02-idle-deck", "유휴 데크 크롭", deck);

await page.getByTestId("ai-input").click();
await page.waitForTimeout(500);
await snap(page, "03-focus-deck", "입력 포커스 (추천 팝오버 없음)", deck);
await page.getByTestId("ai-input").fill("시장 광장 북쪽에 우물을 하나 놓고 상인 두 명 세워줘");
await page.waitForTimeout(400);
await snap(page, "05-typed-deck", "문장 입력 상태", deck);
await page.getByTestId("ai-input").fill("");

// 레일 팝오버들
if (await clickTid("ai-deck-rail-ctx")) { await snap(page, "04a-context-popover", "맥락 팝오버", panel); await closeAll(); }
if (await clickTid("ai-preference-toggle")) { await snap(page, "04b-preference-popover", "AI 가 기억한 내 성향", panel); await closeAll(); }
if (await clickTid("ai-plan-book")) { await snap(page, "04c-plan-book", "보존 기획 재사용", panel); await closeAll(); }

// ☰ 메뉴
if (await clickTid("ai-command-menu-toggle", 300)) {
  writeFileSync(join(OUT, "menu-text.txt"), await page.getByTestId("ai-command-menu").innerText().catch(() => ""));
  await snap(page, "06-menu", "☰ 메뉴", panel);
  await clickTid("ai-command-menu-toggle", 250);
}
const autonomy = page.getByTestId("ai-composer-autonomy");
if (await autonomy.isVisible().catch(() => false)) {
  const opts = await autonomy.locator("option").allInnerTexts().catch(() => []);
  writeFileSync(join(OUT, "autonomy-options.txt"), opts.join("\n"));
  console.log("autonomy options", opts);
}

// 메뉴 항목 → 모달
const viaMenu = async (itemTid, modalTid, shot, caption, closeTid) => {
  if (!(await clickTid("ai-command-menu-toggle", 300))) return;
  if (!(await clickTid(itemTid, 800))) { await clickTid("ai-command-menu-toggle", 200); return; }
  await page.getByTestId(modalTid).first().waitFor({ state: "visible", timeout: 6000 }).catch(() => console.log("modal absent", modalTid));
  await snap(page, shot, caption);
  const text = await page.getByTestId(modalTid).first().innerText().catch(() => "");
  writeFileSync(join(OUT, `${shot}-text.txt`), text);
  await clickTid(closeTid, 400);
  await closeAll();
};
await viaMenu("ai-command-menu-settings", "ai-settings-modal", "08-settings", "⚙ 설정 모달", "ai-settings-close");
await viaMenu("ai-command-menu-tools", "tool-browser-modal", "09-tools-browser", "도구 목록 (229)", "tool-browser-close");
await viaMenu("ai-command-menu-instructions", "ai-instructions-modal", "10-instructions", "감독 지침", "ai-instructions-close");

// 접힘
if (await clickTid("ai-collapse", 500)) {
  await snap(page, "11-collapsed-full", "접힘 · 복귀 알약");
  const r = page.getByTestId("ai-collapsed-restore");
  if (await r.isVisible().catch(() => false)) { await snap(page, "12-collapsed-pill", "복귀 알약", r); await r.click(); await page.waitForTimeout(500); }
}

// 대화 복원: 스토어에 저장 → 새로고침 → 부팅 자동 복원
console.log("seed", JSON.stringify(await seedConversation(page).catch((e) => e.message)));
await boot(page);
await page.locator(".ai-chat-log .ai-msg, .ai-chat-log [data-testid='ai-turn-group'], .ai-chat-log article, .ai-chat-log li").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => console.log("no restored entries"));
await page.waitForTimeout(600);
await snap(page, "14-conversation-full", "이어받은 대화 (전체)");
await snap(page, "15-conversation-deck", "대화 데크 크롭", deck);
writeFileSync(join(OUT, "conversation-text.txt"), await deck.innerText().catch(() => ""));
const convMetrics = await page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const log = document.querySelector('[data-testid="ai-chat-log"]');
  return { deck: r(document.querySelector('[data-testid="ai-deck"]')), log: r(log), logScroll: log ? { sh: log.scrollHeight, ch: log.clientHeight } : null,
    children: log ? [...log.children].map((c) => ({ cls: c.className.slice(0, 60), h: Math.round(c.getBoundingClientRect().height), text: (c.textContent || "").trim().slice(0, 60) })) : [] };
});
writeFileSync(join(OUT, "metrics-conversation.json"), JSON.stringify(convMetrics, null, 2));
console.log(JSON.stringify(convMetrics).slice(0, 1200));

// 툴 활동 펼침
const toolToggle = page.getByTestId("ai-tool-activity-toggle").first();
if (await toolToggle.isVisible().catch(() => false)) { await toolToggle.click(); await page.waitForTimeout(300); await snap(page, "16-tool-activity-open", "툴 호출 펼침", deck); }
const groupToggle = page.getByTestId("ai-turn-group-toggle").first();
if (await groupToggle.isVisible().catch(() => false)) { await groupToggle.click(); await page.waitForTimeout(300); await snap(page, "16b-turn-group-open", "턴 그룹 펼침", deck); }

// 이전 대화 모달
if (await clickTid("ai-open-conversations", 600)) {
  await page.getByTestId("ai-history-row").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => console.log("no history row"));
  await snap(page, "13-history-modal", "이전 대화 모달");
  await clickTid("ai-history-close", 300);
  await closeAll();
}

console.log("change card", await mountChangeCard(page).catch((e) => e.message));
await page.waitForTimeout(800);
await snap(page, "17-change-card-deck", "변경 카드 마운트", deck);
const card = page.getByTestId("ai-change-card").last();
if (await card.isVisible().catch(() => false)) await snap(page, "18-change-card", "변경 카드 크롭", card);

await page.evaluate(() => {
  document.querySelector('[data-testid="ai-panel"]')?.classList.add("is-turn-running");
  const s = document.querySelector('[data-testid="ai-status"]'); if (s) { s.textContent = "place_npc 실행 중…"; s.dataset.statusTone = "busy"; }
});
await page.waitForTimeout(300);
await snap(page, "19-turn-running", "턴 진행(시뮬레이션)", deck);
await page.evaluate(() => document.querySelector('[data-testid="ai-panel"]')?.classList.remove("is-turn-running"));

const teamToggle = page.getByTestId("ai-team-panel-toggle");
if (await teamToggle.isVisible().catch(() => false)) { await teamToggle.click(); await page.waitForTimeout(400); await snap(page, "20-team-bar-open", "팀 막대 펼침", deck); }
console.log("team", JSON.stringify(await seedTeamRun(page, "running").catch((e) => e.message)));
await page.waitForTimeout(700);
await snap(page, "21-team-running-full", "팀 실행 중 (전체)");
await snap(page, "22-team-running-deck", "팀 실행 중 데크", deck);
await page.evaluate(() => { document.querySelectorAll(".ai-team-board").forEach((n) => n.remove()); });
await seedTeamRun(page, "review").catch((e) => console.log(e.message));
await page.waitForTimeout(700);
await snap(page, "23-team-review-deck", "팀 검토 대기 데크", deck);
await page.evaluate(() => { document.querySelectorAll(".ai-team-board").forEach((n) => n.remove()); });

await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(600);
await snap(page, "24-conversation-1280x720", "1280×720 대화 상태");
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(400);

if (await clickTid("topbar-ai-studio", 1500) || await clickTid("ai-studio-toggle", 1500)) {
  await snap(page, "25-studio", "AI 스튜디오 전체");
  writeFileSync(join(OUT, "studio-text.txt"), await page.evaluate(() => document.querySelector('[data-testid="ai-studio-shell"]')?.innerText ?? document.body.innerText.slice(0, 4000)));
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), shots: manifest }, null, 2));
await browser.close();
console.log("done", manifest.length);
