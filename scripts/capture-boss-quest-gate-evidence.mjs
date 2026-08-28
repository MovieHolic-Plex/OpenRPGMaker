/**
 * 보스 페이즈 / 퀘스트 산출물 게이트 증거 캡처.
 *
 * 1) 페이지 컨텍스트에서 실제 툴 실행기 + 게이트 함수를 돌려 수치·차단 사유를 모은다.
 * 2) 같은 프로젝트를 시드해 (a) 에디터 트룹 전투 이벤트 패널 (b) 실제 전투 페이즈 대사창
 *    (c) 퀘스트 기버 대화창을 스크린샷으로 남긴다.
 *
 * 출력: reports/boss-quest-gate/assets/*.png + evidence.json
 * 사용: DEV_SERVER_PORT=9801 node scripts/capture-boss-quest-gate-evidence.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9801";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "reports/boss-quest-gate";
const QUEST_KEY_RUNTIME = "mayor_errand";
const ASSETS = path.join(OUT, "assets");
fs.mkdirSync(ASSETS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("console", (message) => {
  if (message.type() === "error") console.log("  [page error]", message.text().slice(0, 200));
});

async function open(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('[data-testid="edit-canvas"]', { timeout: 30_000 });
}

async function shot(file) {
  const modal = page.getByTestId("test-play-window");
  if (await modal.count()) await modal.first().screenshot({ path: path.join(ASSETS, file) });
  else await page.screenshot({ path: path.join(ASSETS, file) });
}

/**
 * 테스트 플레이 창을 연다.
 * 이 창은 자동 시작이 기본값이라(testPlayModal 의 test-play-auto-start) title-screen 만
 * 기다리면 영원히 못 만난다 — play-stage 가 이미 떠 있기 때문이다. 둘 중 무엇이든 받는다.
 */
async function openPlayWindow() {
  const modeButton = page.getByTestId("mode-play");
  if ((await modeButton.count()) > 0 && (await modeButton.isVisible())) await modeButton.click();
  else await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
  const modal = page.getByTestId("test-play-window");
  await page.waitForTimeout(300);
  if (!(await modal.isVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
  }
  await modal.waitFor({ state: "visible", timeout: 20_000 });
  await modal.getByTestId("title-screen").or(modal.getByTestId("play-stage")).waitFor({ state: "visible", timeout: 25_000 });
  if (await modal.getByTestId("title-screen").isVisible()) {
    await page.keyboard.press("Enter");
    await modal.getByTestId("play-stage").waitFor({ state: "visible", timeout: 20_000 });
  }
  await page.waitForTimeout(500);
}

console.log("→ 1/5 증거 수집 (툴 + 게이트 실측)");
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await open(`${BASE}/?freshProject=1`);

/** 보스 페이즈 정의 — 페이지 컨텍스트(저작)와 Node 컨텍스트(대사 대기)에서 같은 값을 쓴다. */
const bossPhases = [
  { atHpPercent: 70, name: "1차 각성", message: "제법이군… 인간치고는." },
  { atHpPercent: 30, name: "광폭화", message: "끝이다! 재로 만들어 주마!" },
];

const evidence = await page.evaluate(async (bossPhases) => {
  const [ember, runner, outcome, simulate, questGraph] = await Promise.all([
    import("/src/project/defaults/emberQuestGame.ts"),
    import("/src/editor/tools/toolRunner.ts"),
    import("/src/ai/workItemOutcome.ts"),
    import("/src/battle/simulate.ts"),
    import("/src/project/quest/questGraph.ts"),
  ]);
  const TROOP = "troop_dragon";
  const QUEST = "mayor_errand";
  const call = (ctx, name, args) => runner.runTool(ctx, name, args, { dryRun: false });
  const fresh = () => ({ project: ember.createEmberQuestProject() });

  // ── 보스 페이즈: 저작 → 시뮬 → 게이트 ─────────────────────────────────────
  const boss = fresh();
  const authored = call(boss, "author_boss_phases", { troopId: TROOP, phases: bossPhases });
  const pages = boss.project.database.troops.find((t) => t.id === TROOP).battleEventPages;

  // 저작 직후 게이트(시뮬 근거 없음)
  const blockedNoSim = outcome.verifyAuthoredBossPhases(boss.project, [TROOP], new Map());

  // 레벨별 발동률
  const byLevel = [1, 3, 5, 8].map((heroLevel) => {
    const result = simulate.simulateBattle({ project: boss.project, troopId: TROOP, heroLevel, n: 30, seed: 4242 });
    return {
      heroLevel,
      samples: result.samples,
      winRate: result.winRate,
      avgTurns: result.avgTurns,
      coverage: result.phaseCoverage.map((phase) => ({
        pageId: phase.pageId, name: phase.name, firedRuns: phase.firedRuns,
        firstRound: phase.firstRound ?? null, unsupported: phase.unsupported,
      })),
    };
  });

  // 시뮬 근거를 붙인 게이트(통과)
  const simTool = call(boss, "simulate_battle", { troopId: TROOP, heroLevel: 3, n: 30, seed: 4242 });
  const simEvidence = outcome.battlePhaseSimulationFrom("simulate_battle", { troopId: TROOP }, simTool.data);
  const passed = outcome.verifyAuthoredBossPhases(boss.project, [TROOP], new Map([[TROOP, simEvidence]]));

  // 도달 불가 조건(99라운드) → 침묵 페이지로 차단
  const unreachable = fresh();
  call(unreachable, "upsert_troop_battle_page", {
    troopId: TROOP,
    page: {
      id: "page_never", name: "절대 안 뜨는 연출",
      conditions: [{ kind: "onRound", round: 99 }], span: "battle",
      commands: [{ kind: "text", body: "99라운드!" }],
    },
  });
  const unreachableSim = call(unreachable, "simulate_battle", { troopId: TROOP, heroLevel: 5, n: 30, seed: 4242 });
  const unreachableEvidence = outcome.battlePhaseSimulationFrom("simulate_battle", { troopId: TROOP }, unreachableSim.data);
  const blockedSilent = outcome.verifyAuthoredBossPhases(unreachable.project, [TROOP], new Map([[TROOP, unreachableEvidence]]));

  // 저작 시점 거부 사례(무검증 저장 경로 차단 포함)
  const rejects = [];
  const pushReject = (label, ctx, name, args) => {
    const result = call(ctx, name, args);
    rejects.push({
      label, tool: name, ok: result.ok,
      message: (result.issues ?? []).map((issue) => issue.message).join(" ") || result.summary,
    });
  };
  pushReject("빈 commands", fresh(), "upsert_troop_battle_page", { troopId: TROOP, page: { id: "empty", conditions: [], commands: [] } });
  pushReject("조건 kind 오타", fresh(), "upsert_troop_battle_page", {
    troopId: TROOP, page: { id: "typo", conditions: [{ kind: "enemyHpUnder", enemyId: "enemy_dragon", percent: 50 }], commands: [{ kind: "text", body: "x" }] },
  });
  pushReject("무한 반복 조합", fresh(), "upsert_troop_battle_page", {
    troopId: TROOP, page: { id: "spam", conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_dragon", percent: 50 }], span: "turn", runOnce: false, commands: [{ kind: "text", body: "도배" }] },
  });
  pushReject("임계 오름차순", fresh(), "author_boss_phases", { troopId: TROOP, phases: [{ atHpPercent: 30, message: "a" }, { atHpPercent: 70, message: "b" }] });
  pushReject("없는 상태 id", fresh(), "author_boss_phases", { troopId: TROOP, phases: [{ atHpPercent: 50, enrageStateId: "state_nope" }] });
  pushReject("무검증 저장 경로", fresh(), "upsert_troop", {
    troop: { id: TROOP, battleEventPages: [{ id: "raw", conditions: [{ kind: "nonsense" }], commands: [] }] },
  });

  // ── 퀘스트: 컴파일 → 그래프 → 완주 검증 ────────────────────────────────────
  const questDef = (mapId) => ({
    key: QUEST, title: "촌장의 부탁", summary: "촌장이 마을 밖 상황을 확인해 달라고 한다.",
    giver: { create: { mapId, x: 17, y: 14, name: "촌장" } },
    steps: [{ kind: "reach", mapId, x: 18, y: 15 }],
  });
  const graphNodes = (full) => full
    ? [
        { id: "talk-chief", description: "촌장과 대화한다", completesWhen: { kind: "switch", switchId: `sw_${QUEST}_started`, value: true } },
        { id: "reach-outskirts", description: "마을 밖으로 나간다", completesWhen: { kind: "switch", switchId: `sw_${QUEST}_step0`, value: true } },
      ]
    : [{ id: "reach-outskirts", description: "마을 밖으로 나간다", completesWhen: { kind: "switch", switchId: `sw_${QUEST}_step0`, value: true } }];

  const compileOnly = fresh();
  const compiled = call(compileOnly, "create_quest", { def: questDef(compileOnly.project.startMapId) });
  const questBlockedNoGraph = outcome.verifyAuthoredQuestsPlayable(compileOnly.project, [QUEST]);

  const partial = fresh();
  call(partial, "create_quest", { def: questDef(partial.project.startMapId) });
  call(partial, "define_quest", { id: QUEST, title: "촌장의 부탁", nodes: graphNodes(false), edges: [] });
  const questBlockedNoPrereq = outcome.verifyAuthoredQuestsPlayable(partial.project, [QUEST]);

  const complete = fresh();
  call(complete, "create_quest", { def: questDef(complete.project.startMapId) });
  call(complete, "define_quest", { id: QUEST, title: "촌장의 부탁", nodes: graphNodes(true), edges: [{ from: "talk-chief", to: "reach-outskirts" }] });
  const questPassed = outcome.verifyAuthoredQuestsPlayable(complete.project, [QUEST]);
  const walkthrough = questGraph.generateQuestWalkthrough(complete.project, QUEST);
  const verified = call(complete, "verify_quest", { questId: QUEST });

  const broken = fresh();
  call(broken, "create_quest", { def: questDef(broken.project.startMapId) });
  call(broken, "define_quest", { id: QUEST, title: "촌장의 부탁", nodes: graphNodes(true), edges: [{ from: "talk-chief", to: "reach-outskirts" }] });
  const brokenMap = broken.project.maps[broken.project.startMapId];
  brokenMap.events = brokenMap.events.filter((event) => event.id !== `ev_${QUEST}_reach0`);
  const questBlockedLint = outcome.verifyAuthoredQuestsPlayable(broken.project, [QUEST]);

  // 스크린샷용 프로젝트: 페이즈 + 완성 퀘스트를 한 프로젝트에 담는다.
  const showcase = fresh();
  call(showcase, "author_boss_phases", { troopId: TROOP, phases: bossPhases });
  call(showcase, "create_quest", { def: questDef(showcase.project.startMapId) });
  call(showcase, "define_quest", { id: QUEST, title: "촌장의 부탁", nodes: graphNodes(true), edges: [{ from: "talk-chief", to: "reach-outskirts" }] });

  const toolCount = (await import("/src/editor/tools/toolRegistry.ts")).allTools().length;

  return {
    toolCount,
    boss: {
      authoredSummary: authored.summary,
      authoredWarnings: authored.diff?.warnings ?? [],
      pages: pages.map((page) => ({ id: page.id, name: page.name, span: page.span, runOnce: page.runOnce === true, conditions: page.conditions, commands: page.commands })),
      simulateSummary: simTool.summary,
      blockedNoSim, passed, byLevel,
      unreachableSummary: unreachableSim.summary,
      unreachableWarnings: unreachableSim.diff?.warnings ?? [],
      blockedSilent,
      rejects,
    },
    quest: {
      compiledSummary: compiled.summary,
      questBlockedNoGraph, questBlockedNoPrereq, questBlockedLint, questPassed,
      verifiedSummary: verified.summary,
      walkthrough: { steps: walkthrough.scenario.steps, nodes: walkthrough.nodes, manualHints: walkthrough.manualHints },
    },
    showcaseProject: JSON.parse(JSON.stringify(showcase.project)),
  };
}, bossPhases);

const showcase = evidence.showcaseProject;
delete evidence.showcaseProject;
console.log(`   툴 ${evidence.toolCount}개 · 페이즈 ${evidence.boss.pages.length}개 · 레벨 ${evidence.boss.byLevel.length}종 측정`);

console.log("→ 2/5 에디터 전투 이벤트 패널");
await page.addInitScript((seed) => {
  window.__RPG_ZZU_E2E_PROJECT__ = seed;
}, showcase);
await open(`${BASE}/`);
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible" });
const troopsTab = page.getByTestId("db-tab-troops");
if (!(await troopsTab.isVisible())) {
  const groups = page.locator('[data-testid^="db-tab-group-"]');
  const total = await groups.count();
  for (let index = 0; index < total; index += 1) {
    await groups.nth(index).click();
    if (await troopsTab.isVisible()) break;
  }
}
await troopsTab.click({ force: true });
await page.waitForTimeout(600);
const dragonRow = page.locator('.db-list-row[data-record-id="troop_dragon"]');
if (await dragonRow.count()) await dragonRow.first().click();
else await page.locator(".db-list-row").first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(ASSETS, "editor-troop-event-panel.png") });
const eventPanel = page.locator(".db-troop-event-panel").first();
if (await eventPanel.count()) {
  await eventPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await eventPanel.screenshot({ path: path.join(ASSETS, "editor-troop-event-panel-zoom.png") });
}
await page.getByTestId("database-modal-close").click();

console.log("→ 3/5 실제 전투 페이즈 대사창");
await open(`${BASE}/`);
await openPlayWindow();

const mount = await page.evaluate(async () => {
  const [runtimeMod, advanceMod, battleDom, storeMod, tuning] = await Promise.all([
    import("/src/battle/runtime.ts"),
    import("/src/battle/battleRuntimeAdvance.ts"),
    import("/src/player/battleDom.ts"),
    import("/src/project/store.ts"),
    import("/src/battle/simulate.ts"),
  ]);
  const project = storeMod.store.getCurrent();
  // Lv1 영웅이 ~10대에 잡는 보스로 맞춘다(임계 70%/30%를 실제 타격으로 통과시키기 위한 스크린샷 세팅).
  const enemy = project.database.enemies.find((entry) => entry.id === "enemy_dragon");
  const tuned = tuning.computeEnemyTuning({
    project, heroLevel: 1, enemyDefense: enemy.stats.defense,
    targetHitsToKill: 10, targetDamageToHeroPerHit: 18,
  });
  enemy.stats.maxHp = tuned.maxHp;
  enemy.stats.attack = tuned.attack;
  const host =
    document.querySelector('[data-testid="test-play-window-body"]') ||
    document.querySelector('[data-testid="play-viewport"]') ||
    document.body;
  const runtime = runtimeMod.createBattleRuntime({ project, troopId: "troop_dragon", canEscape: true, canLose: true, battleFlow: "gauge" });
  window.__GATE_RT__ = runtime;
  window.__GATE_ADV__ = advanceMod;
  for (let i = 0; i < 20000; i += 1) {
    runtime.tick(50);
    if (runtime.snapshot().phase === "actorCommand") break;
  }
  advanceMod.advanceBattleRuntime(runtime);
  battleDom.mountBattleScene({ host, runtime, onResult: () => {} });
  const snapshot = runtime.snapshot();
  return { phase: snapshot.phase, tunedMaxHp: tuned.maxHp, enemies: snapshot.enemies.map((entry) => `${entry.hp}/${entry.maxHp}`) };
});
console.log("   battle mounted:", JSON.stringify(mount));
await page.waitForTimeout(700);
await shot("battle-open.png");

/**
 * 전투 상태를 Node 쪽에서 훔쳐본다.
 * 주의: 페이지 안에서 동기 루프로 tick 을 돌리면 rAF/setInterval 이 굶어 대사창 DOM 이 절대 갱신되지 않는다.
 * 그래서 진행은 battleDom 자신의 200ms 인터벌에 맡기고, 우리는 실제 UI 버튼만 누른다.
 */
const battleProbe = () =>
  page.evaluate(() => {
    const snapshot = window.__GATE_RT__.snapshot();
    const boss = snapshot.enemies[0];
    return {
      phase: snapshot.phase,
      round: snapshot.turn,
      result: snapshot.result ?? null,
      hpPercent: boss ? Math.round((boss.hp / boss.maxHp) * 100) : null,
      firedPhases: snapshot.eventLogs.filter((log) => log.kind === "fired" && /_phase\d+$/.test(log.pageId)).map((log) => log.pageId),
      line: document.querySelector('[data-testid="battle-message-window"]')?.textContent?.trim() ?? null,
    };
  });

/** 커맨드창이 뜨면 공격 → 보스 선택. 실제 플레이어가 누르는 경로 그대로. */
async function pressAttack() {
  // 커맨드/타깃 메뉴가 서로 겹쳐 있어 히트테스트 클릭은 intercept 된다 — DOM click() 으로 직접 누른다.
  const attack = page.locator('[data-testid="actor-command-attack"]');
  if (!(await attack.count()) || !(await attack.first().isVisible())) return false;
  await attack.first().evaluate((node) => node.click());
  await page.waitForTimeout(150);
  const target = page.locator('[data-battle-targetable="true"]');
  if (await target.count()) await target.first().evaluate((node) => node.click());
  return true;
}

/** 기대 대사가 대사창에 실제로 렌더될 때까지 UI 를 굴린다. */
async function playUntilPhaseLine(expectedText) {
  let firedAt = null;
  for (let step = 0; step < 240; step += 1) {
    const probe = await battleProbe();
    if (probe.line?.includes(expectedText)) return { ...probe, hpAtFirePercent: firedAt?.hpPercent ?? null, roundAtFire: firedAt?.round ?? null };
    if (!firedAt && probe.firedPhases.length > 0) firedAt = probe;
    if (probe.result) return { ...probe, hpAtFirePercent: firedAt?.hpPercent ?? null, roundAtFire: firedAt?.round ?? null, ended: probe.result };
    if (probe.phase === "actorCommand") await pressAttack();
    await page.waitForTimeout(220);
  }
  return { ...(await battleProbe()), hpAtFirePercent: firedAt?.hpPercent ?? null, roundAtFire: firedAt?.round ?? null, timeout: true };
}

const phase1 = await playUntilPhaseLine(bossPhases[0].message);
await shot("battle-phase1.png");
console.log("   phase1:", JSON.stringify(phase1).slice(0, 300));
const phase2 = await playUntilPhaseLine(bossPhases[1].message);
await shot("battle-phase2.png");
console.log("   phase2:", JSON.stringify(phase2).slice(0, 300));

console.log("→ 4/5 퀘스트 기버 대화");
await open(`${BASE}/`);
await openPlayWindow();
await page.waitForTimeout(1200);
await shot("quest-village.png");

// 맵 화면은 캔버스라 대사 텍스트가 DOM 에 없다 — 증거는 runtime-state-json 의 스위치로 잡는다.
const runtimeState = async () =>
  page.evaluate(() => {
    const dump = document.querySelector('[data-testid="runtime-state-json"]')?.textContent;
    if (!dump) return null;
    try {
      return JSON.parse(dump);
    } catch {
      return null;
    }
  });

const before = await runtimeState();
// 기버는 (17,14). 컴파일된 이벤트는 정면에서 말을 걸어야 발동한다 — (16,14) 로 가서 오른쪽을 본다.
for (let step = 0; step < 10; step += 1) {
  const state = await runtimeState();
  if (state?.player?.y !== 14) await page.keyboard.press(state?.player?.y > 14 ? "ArrowUp" : "ArrowDown");
  else if (state?.player?.x !== 16) await page.keyboard.press(state?.player?.x > 16 ? "ArrowLeft" : "ArrowRight");
  else break;
  await page.waitForTimeout(320);
}
// (16,14) 에 도착해도 바라보는 방향이 아래일 수 있다 — NPC 쪽으로 한 번 밀어 방향을 맞춘다(이동은 막힘).
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
await page.keyboard.press("Enter");
await page.waitForTimeout(1000);
await shot("quest-giver-talk.png");
const after = await runtimeState();
const questSwitch = `sw_${QUEST_KEY_RUNTIME}_started`;
const talkState = {
  playerBefore: before?.player ?? null,
  playerAfter: after?.player ?? null,
  startedSwitch: questSwitch,
  startedBefore: before?.switches?.[questSwitch] ?? false,
  startedAfter: after?.switches?.[questSwitch] ?? false,
  progressVariable: after?.variables?.[`var_${QUEST_KEY_RUNTIME}_progress`] ?? null,
};
console.log("   giver:", JSON.stringify(talkState));

// 대사창을 넘겨 '퀘스트 시작' 스위치가 실제로 켜지는 화면까지 진행한다.
for (const key of ["Enter", "Enter", "Enter"]) {
  await page.keyboard.press(key);
  await page.waitForTimeout(450);
}
await shot("quest-giver-accepted.png");
const accepted = await runtimeState();
talkState.startedAfterAccept = accepted?.switches?.[questSwitch] ?? false;
console.log("   accepted:", talkState.startedAfterAccept);

console.log("→ 5/5 evidence.json");
fs.writeFileSync(path.join(OUT, "evidence.json"), `${JSON.stringify({ ...evidence, phase1, phase2, talkState }, null, 2)}\n`);
await browser.close();
console.log(`완료: ${OUT}/evidence.json + ${fs.readdirSync(ASSETS).length}개 이미지`);
