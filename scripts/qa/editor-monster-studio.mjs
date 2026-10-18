/**
 * 도트 몬스터 공방 E2E (편집기 UI + AI 도구 + 실제 player.html 전투).
 *
 *   node scripts/qa/editor-monster-studio.mjs [--out <dir>]
 *   OPRN_DEV_URL=http://127.0.0.1:<DEV_SERVER_PORT>/ (기본: .env.local 의 DEV_SERVER_PORT)
 *
 * 편집기는 `?blankProject=1` 빈 프로젝트로 띄운다(fixture 가 아니라 사용자가 새로 만든 게임과 같은 출발점).
 * Flow 1: 자료집 → 적 → 「+ 새 적」 → 「+ 9칸 도트 시트 생성·편집」 → 생성 → 9칸 시트 + 초안 무대의
 *         대기·공격·스킬·피격·쓰러짐 → 적용 → 적 도트 미리보기 카드가 저작 시트로 바뀐다.
 * Flow 2: AI 조수와 같은 runTool 경로(window.__oprnEditorTool)로 author_enemy_pixel_sheet ×3 + upsert_troop +
 *         시작 맵 자동 시작(trigger auto) battleProcessing 이벤트(upsert_event) → 편집기 store 를 직렬화해
 *         player.html 이 project.json 으로 받아 retro2003 전투를 실제로 돌리고 적 노드의 data-battle-pose-frame 을 관찰한다.
 * 프레임은 <out>/frames/<name>/*.png 로 남기고 ffmpeg 로 GIF 를 만든다.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const args = { out: "output/evidence/editor-monster-studio" };
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--out") args.out = process.argv[++i];
  else throw new Error(`Unknown argument: ${process.argv[i]}`);
}
const OUT = path.resolve(args.out);
fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });
const envPort = fs.existsSync(".env.local") ? /^DEV_SERVER_PORT=(\d+)/m.exec(fs.readFileSync(".env.local", "utf8"))?.[1] : undefined;
const BASE = process.env.OPRN_DEV_URL || `http://127.0.0.1:${envPort ?? 9999}/`;
const report = { base: BASE, flow1: {}, flow2: {} };

async function bootEditor(page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(new URL("?blankProject=1", BASE).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__oprnEditorTool === "function", null, { timeout: 90_000 });
}

/** 자료집은 store 변경을 rAF·유예 뒤에 탭 전체 재렌더로 반영한다. 본문 트리가 600ms 조용해질 때까지(최대 5초) 기다린다. */
function settle(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const root = document.querySelector(".database-modal-body") ?? document.body;
    let timer = setTimeout(done, 600);
    const cap = setTimeout(done, 5_000);
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, 600); });
    observer.observe(root, { childList: true, subtree: true });
    function done() { observer.disconnect(); clearTimeout(timer); clearTimeout(cap); resolve(); }
  }));
}

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

function gif(name, fps) {
  const dir = path.join(OUT, "frames", name);
  const target = path.join(OUT, `${name}.gif`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%03d.png"),
    "-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none", target]);
  return target;
}

/** 일정 간격으로 locator 를 찍어 GIF 로 묶는다. onFrame(i) 는 찍기 직전에 불리고, 돌려준 값은 프레임 메타로 남는다. */
async function frames(page, name, locator, count, everyMs, onFrame) {
  const dir = path.join(OUT, "frames", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const meta = [];
  for (let i = 0; i < count; i += 1) {
    meta.push(onFrame ? await onFrame(i) : null);
    await locator.screenshot({ path: path.join(dir, `${String(i).padStart(3, "0")}.png`), animations: "allow" });
    await page.waitForTimeout(everyMs);
  }
  gif(name, Math.round(1000 / everyMs));
  return meta;
}

// ---------------------------------------------------------------- Flow 1: editor UI
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(`[editor] ${msg.text()}`); });
  page.on("pageerror", (error) => consoleErrors.push(`[editor] ${error.message}`));
  await bootEditor(page);
  // 실제 사용자 경로: 머리줄 「자료집」 → 왼쪽 「전투」 구획 → 「전투 몬스터」 탭 → 「+ 추가」.
  await page.getByRole("button", { name: "자료집", exact: true }).first().click();
  const modal = page.locator(".database-modal-window");
  await modal.getByText("전투", { exact: true }).first().click();
  await modal.locator('[data-testid="db-tab-enemies"]').click();
  await page.locator('.database-modal-window [data-testid="db-add-record"]:visible').first().click();
  const name = page.locator('.database-modal-window [data-testid="db-field-name"]:visible').first();
  await name.fill("가시 자수정 늑대");
  await name.dispatchEvent("change");
  await page.locator('[data-testid="db-enemy-pixel-studio-toggle"]').click();
  const studio = page.locator('[data-testid="db-enemy-pixel-studio"]');
  await studio.locator('[data-testid="db-pixel-studio-archetype"]').selectOption("beast");
  await studio.locator('[data-testid="db-pixel-studio-primary"]').fill("#5b3f8f");
  await studio.locator('[data-testid="db-pixel-studio-accent"]').fill("#c77dff");
  await studio.locator('[data-testid="db-pixel-studio-cell"]').selectOption("64");
  await studio.locator('[data-testid="db-pixel-studio-motion"]').selectOption("dash");
  await studio.locator('[data-testid="db-pixel-studio-skill"]').selectOption("wolf-grey");
  await studio.locator('[data-testid="db-pixel-studio-generate"]').click();
  await studio.locator('[data-testid="db-pixel-studio-strip"] img').waitFor();
  const draft = studio.locator('[data-testid="db-pixel-studio-draft"] [data-testid="db-enemy-pixel-preview"]');
  await draft.waitFor();
  await settle(page);
  report.flow1.status = await studio.locator('[data-testid="db-pixel-studio-status"]').textContent();
  // 공방 본문은 모달 스크롤 창보다 길다 — 잠깐 키 큰 창으로 찍어 조작부·9칸 시트·초안 무대가 한 장에 들어오게 한다.
  await page.setViewportSize({ width: 1440, height: 2600 });
  await settle(page);
  await studio.scrollIntoViewIfNeeded();
  await studio.screenshot({ path: path.join(OUT, "flow1-studio-generated.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await settle(page);
  await studio.locator('[data-testid="db-pixel-studio-strip"]').screenshot({ path: path.join(OUT, "flow1-studio-sheet.png") });
  await draft.locator('[data-testid="db-enemy-pixel-cells"]').screenshot({ path: path.join(OUT, "flow1-draft-cells.png") });
  report.flow1.draftCells = await draft.locator('[data-testid="db-enemy-pixel-cells"] [data-cell]').count();
  assert.equal(report.flow1.draftCells, 9, "draft preview must list idle_a..dead");

  // 초안 무대: 대기 → 공격 → 스킬 → 피격 → 쓰러짐. 카드 전체를 찍어 눌린 버튼도 함께 보인다.
  const stage = draft.locator('[data-testid="db-enemy-pixel-stage"]');
  await stage.evaluate((node) => {
    node.__cellLog = [];
    new MutationObserver(() => {
      if (node.dataset.pixelCell) node.__cellLog.push(node.dataset.pixelCell);
    }).observe(node, { attributes: true, attributeFilter: ["data-pixel-cell"] });
  });
  const cellOf = () => stage.evaluate((node) => node.dataset.pixelCell ?? "");
  const drainCellLog = () => stage.evaluate((node) => {
    const out = [...(node.__cellLog ?? []), node.dataset.pixelCell ?? ""];
    node.__cellLog = [];
    return out;
  });
  const stageCells = {};
  const skillButton = draft.locator(".db-enemy-pixel-skill").first();
  report.flow1.skillButtons = await draft.locator(".db-enemy-pixel-skill").count();
  assert.ok(report.flow1.skillButtons > 0, "draft preview must expose monster skill buttons");
  const plays = [
    ["idle", draft.locator('[data-testid="db-enemy-pixel-idle"]'), 16, 110],
    ["attack", draft.locator('[data-testid="db-enemy-pixel-attack"]'), 16, 90],
    ["skill", skillButton, 24, 90],
    ["hit", draft.locator('[data-testid="db-enemy-pixel-hit"]'), 10, 90],
    ["dead", draft.locator('[data-testid="db-enemy-pixel-dead"]'), 18, 90],
  ];
  for (const [action, button, count, everyMs] of plays) {
    await drainCellLog();
    const meta = await frames(page, `flow1-draft-${action}`, draft, count, everyMs, async (i) => {
      if (i === 0) await button.click();
      return cellOf();
    });
    const logged = await drainCellLog();
    stageCells[action] = [...new Set([...meta, ...logged].filter(Boolean))];
  }
  report.flow1.stageCells = stageCells;
  report.flow1.skillName = await skillButton.textContent();
  assert.ok(stageCells.idle.length >= 2, "idle must loop through several cells");
  for (const cell of ["windup", "attack"]) assert.ok(stageCells.attack.includes(cell), `attack must show ${cell}`);
  assert.ok(stageCells.skill.includes("skill"), "skill must show the (0,2) skill cell");
  assert.ok(stageCells.hit.includes("hit") && stageCells.dead.includes("dead"), "hit/dead cells must play");

  await studio.locator('[data-testid="db-pixel-studio-apply"]').click();
  await settle(page);
  const slotPreview = page.locator('[data-testid="db-enemy-pixel-slot"] [data-testid="db-enemy-pixel-preview"]');
  await slotPreview.waitFor();
  report.flow1.appliedResourceId = await slotPreview.getAttribute("data-resource-id");
  const project = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const p = store.getCurrent();
    const enemy = p.database.enemies.find((e) => e.name === "가시 자수정 늑대");
    const asset = enemy ? p.assets.uploaded[enemy.monsterResourceId] : undefined;
    return { enemyId: enemy?.id, monsterResourceId: enemy?.monsterResourceId, actions: enemy?.actions.map((a) => a.skillId), meta: asset?.meta.pixelEnemySheet && { ...asset.meta.pixelEnemySheet, recipe: undefined } };
  });
  report.flow1.project = project;
  assert.ok(project.monsterResourceId?.startsWith("authored-monster-") && project.meta, "Flow 1 enemy must link to an authored sheet");
  assert.equal(report.flow1.appliedResourceId, project.monsterResourceId);
  await page.locator('[data-testid="db-enemy-pixel-slot"]').scrollIntoViewIfNeeded();
  await page.locator(".db-enemy-stage-column").first().screenshot({ path: path.join(OUT, "flow1-applied-column.png") });
  await frames(page, "flow1-applied-idle", slotPreview.locator('[data-testid="db-enemy-pixel-stage"]'), 16, 110);
  await page.locator(".database-modal-window").first().screenshot({ path: path.join(OUT, "flow1-database-modal.png") });
  await page.close();
}

// ---------------------------------------------------------------- Flow 2: AI tool → real player battle
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(`[editor2] ${msg.text()}`); });
  page.on("pageerror", (error) => consoleErrors.push(`[editor2] ${error.message}`));
  await bootEditor(page);
  const tool = async (name, toolArgs) => {
    const result = await page.evaluate(([n, a]) => window.__oprnEditorTool(n, a), [name, toolArgs]);
    assert.ok(result.ok, `${name} failed: ${JSON.stringify(result).slice(0, 600)}`);
    return result;
  };
  await tool("set_project_settings", { battle: { uiStyle: "retro2003" } });
  const calls = [
    { name: "자수정 송곳니 늑대", archetype: "beast", primaryColor: "#5b3f8f", secondaryColor: "#d9c6f2", accentColor: "#c77dff", weapon: "fang", cell: 64, motion: "dash", spikes: true, skillSlug: "wolf-grey",
      enemy: { id: "enemy_amethyst_wolf", stats: { maxHp: 220, maxMp: 60, attack: 10, defense: 30, mind: 10, agility: 22 }, rewards: { exp: 30, gold: 18 } } },
    { name: "심연의 해골 마검사", archetype: "humanoid-knight", primaryColor: "#2a2440", secondaryColor: "#d8d0c0", accentColor: "#7a40ff", weapon: "sword", cell: 64, motion: "dash", horns: true, skillSlug: "skeleton-knight",
      enemy: { id: "enemy_abyss_skeleton_blade", stats: { maxHp: 900, maxMp: 80, attack: 10, defense: 30, mind: 10, agility: 18 }, rewards: { exp: 60, gold: 40 } } },
    { name: "태양석 수호 거신", archetype: "golem-construct", primaryColor: "#b08a4a", secondaryColor: "#6a5a4a", accentColor: "#ffd040", weapon: "claw", cell: 96, motion: "stomp", spikes: true, skillSlug: "golem-iron",
      enemy: { id: "enemy_sunstone_colossus", stats: { maxHp: 1600, maxMp: 90, attack: 12, defense: 40, mind: 10, agility: 12 }, rewards: { exp: 200, gold: 150 } } },
  ];
  report.flow2.tools = [];
  for (const call of calls) {
    const result = await tool("author_enemy_pixel_sheet", call);
    report.flow2.tools.push({ summary: result.summary, resourceId: result.data.resourceId, cell: result.data.cell, motion: result.data.motion, colors: result.data.colors, minPairDiff: result.data.minPairDiff, warnings: result.warnings ?? [] });
  }
  const troop = await tool("upsert_troop", { troop: { id: "troop_editor_pixel_trio", name: "공방 몬스터 셋", enemyIds: calls.map((c) => c.enemy.id), previewBackgroundResourceId: "generated-battle-reference-forest" } });
  report.flow2.troop = troop.summary;

  // 시작 맵 주인공 시작 칸 옆에 자동 시작 전투 이벤트를 놓는다(조수가 쓰는 upsert_event 그대로).
  const start = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const p = store.getCurrent();
    return { mapId: p.startMapId, x: p.startPos.x, y: p.startPos.y };
  });
  const event = await tool("upsert_event", {
    mapId: start.mapId,
    event: {
      id: "evt_editor_pixel_trio_battle",
      name: "공방 몬스터 셋 전투",
      x: start.x,
      y: Math.max(0, start.y - 2),
      trigger: { kind: "auto" },
      commands: [{ kind: "battleProcessing", troopId: "troop_editor_pixel_trio", canEscape: false, canLose: true }],
    },
  });
  report.flow2.event = event.summary;

  // 편집기 정본 store 를 그대로 직렬화(=저장 형식)해서 플레이어가 받는다.
  const wire = await page.evaluate(async () => {
    const io = await import("/src/project/io.ts");
    const { store } = await import("/src/project/store.ts");
    return io.serialize(store.getCurrent());
  });
  fs.writeFileSync(path.join(OUT, "flow2-project.json"), wire);
  const roundTrip = JSON.parse(wire);
  report.flow2.serializedAuthoredAssets = Object.values(roundTrip.assets.uploaded).filter((a) => a.meta?.pixelEnemySheet).map((a) => a.id);
  assert.equal(report.flow2.serializedAuthoredAssets.length, 3);
  const wiredEvent = roundTrip.maps[roundTrip.startMapId].events.find((e) => e.id === "evt_editor_pixel_trio_battle");
  report.flow2.serializedEventTrigger = wiredEvent?.pages?.[0]?.trigger ?? wiredEvent?.trigger;
  await page.close();

  const player = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  player.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(`[player] ${msg.text()}`); });
  player.on("pageerror", (error) => consoleErrors.push(`[player] ${error.message}`));
  // Vite 편집기 dev 서버는 vite.player.config.ts 의 별칭을 자동으로 걸지 않으므로 출하 shim 으로 연결한다.
  await player.route("**/src/project/store.ts*", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: 'export * from "/src/player/exportProjectStoreShim.ts";\n' }));
  await player.route("**/src/app/mode.ts*", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: 'export * from "/src/player/exportAppModeShim.ts";\n' }));
  await player.route("**/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: wire }));
  await player.goto(new URL("player.html", BASE).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await player.waitForSelector('[data-testid="title-screen"]', { timeout: 90_000 });
  await player.screenshot({ path: path.join(OUT, "flow2-player-title.png") });
  // 새 게임 → (오프닝이 있으면 넘김) → 시작 맵 자동 시작 이벤트가 전투를 연다.
  const battleEnemy = '[data-testid="battle-scene"] .battle-enemy[data-pixel-enemy]';
  const deadline = Date.now() + 60_000;
  while (!(await player.locator(battleEnemy).count())) {
    if (Date.now() > deadline) {
      await player.screenshot({ path: path.join(OUT, "flow2-player-stuck.png") });
      report.flow2.stuckDom = await player.evaluate(() => ({
        battle: Boolean(document.querySelector('[data-testid="battle-scene"]')),
        enemies: [...document.querySelectorAll(".battle-enemy")].map((n) => ({ pixel: n.dataset.pixelEnemy ?? null, cls: n.className })),
        testids: [...new Set([...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid))].slice(0, 60),
      }));
      fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ...report, consoleErrors }, null, 2));
      assert.fail(`autorun battle never opened: ${JSON.stringify(report.flow2.stuckDom).slice(0, 1500)}`);
    }
    await player.keyboard.press("Enter");
    await player.waitForTimeout(400);
  }
  await player.waitForTimeout(600);
  await player.evaluate(() => {
    window.__poseLog = [];
    const scene = document.querySelector('[data-testid="battle-scene"]');
    new MutationObserver((records) => {
      for (const r of records) {
        const node = r.target;
        if (!(node instanceof HTMLElement) || !node.classList.contains("battle-enemy")) continue;
        window.__poseLog.push({ t: Math.round(performance.now()), sheet: node.querySelector(".battle-enemy-image")?.dataset.pixelSheet, frame: node.dataset.battlePoseFrame ?? "idle" });
      }
    }).observe(scene, { subtree: true, attributes: true, attributeFilter: ["data-battle-pose-frame"] });
  });
  const enemies = await player.evaluate(() => [...document.querySelectorAll(".battle-enemy[data-pixel-enemy]")].map((node) => {
    const image = node.querySelector(".battle-enemy-image");
    return { motion: node.dataset.pixelEnemy, cell: node.dataset.pixelEnemyCell, sheet: image?.dataset.pixelSheet, bg: image ? getComputedStyle(image).backgroundImage.slice(0, 40) : "" };
  }));
  report.flow2.battleEnemies = enemies;
  assert.equal(enemies.length, 3, "three authored enemies must render as pixel sheets in battle");
  const scene = player.locator('[data-testid="battle-scene"]');
  const poses = () => player.evaluate(() => [...document.querySelectorAll(".battle-enemy[data-pixel-enemy]")].map((node) => node.dataset.battlePoseFrame ?? "idle").join(","));
  await scene.screenshot({ path: path.join(OUT, "flow2-battle-start.png") });
  await frames(player, "flow2-battle-idle", scene, 16, 110);
  // 실제 입력: 결정 키로 명령을 고른다(공격 → 대상). 적 행동은 런타임이 스스로 낸다.
  report.flow2.turnFramePoses = await frames(player, "flow2-battle-turns", scene, 140, 110, async (i) => {
    if (i % 6 === 0) await player.keyboard.press("Enter");
    return poses();
  });
  const log = await player.evaluate(() => window.__poseLog);
  const bySheet = {};
  for (const entry of log) (bySheet[entry.sheet] ??= new Set()).add(entry.frame);
  report.flow2.poseFramesBySheet = Object.fromEntries(Object.entries(bySheet).map(([k, v]) => [k, [...v]]));
  await scene.screenshot({ path: path.join(OUT, "flow2-battle-later.png") });
  await player.close();
}

report.consoleErrors = consoleErrors;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
