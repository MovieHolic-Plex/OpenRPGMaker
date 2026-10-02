// 전투 연출 캡처 — 출하 플레이어(player.html)에서 배경 겹·상태 오라·적 쓰러짐·화면 필터를 실제로 그린다.
//
// 두 판을 돈다.
//   aura     : 첫 행동 뒤 전투 이벤트 페이지가 적 셋에 수면·혼란·화상(+마비·매혹·침묵 중 둘)을 건다 → 배경 겹(안개·불티·앞 땅안개)과 함께 찍는다.
//   collapse : 적 HP 1 — 공격만 눌러 셋이 쓰러지는 동안 80ms 마다 찍는다(픽셀 분해·하얀 점멸·보스 가라앉기).
// 스킨은 --skin(기본 retro2003). 화면 필터는 --filter(기본 crt, none 이면 끔).
//
// 사용: node scripts/qa/runtime/battle-fx.capture.mjs --out /tmp/battle-fx [--skin rm2003] [--filter scanlines]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const outDir = resolve(arg("out", "/tmp/battle-fx"));
const skin = arg("skin", "retro2003");
const filter = arg("filter", "crt");

const EXTRA_STATES = [
  ["state_paralysis", "마비"], ["state_confuse", "혼란"], ["state_burn", "화상"],
  ["state_charm", "매혹"], ["state_silence", "침묵"],
];

function m2(commandId, fields) {
  return { kind: "m2Command", commandId, fields };
}

async function buildProject(mode) {
  const project = JSON.parse(await readFile(SOURCE, "utf8"));
  project.system.battleUiStyle = skin;
  if (filter !== "none") project.system.displayFilter = filter;
  const db = project.database;
  for (const [id, name] of EXTRA_STATES) {
    if (!db.states.some((state) => state.id === id)) db.states.push({ id, name });
  }
  const slime = db.enemies.find((enemy) => enemy.id === "enemy_slime");
  const bat = db.enemies.find((enemy) => enemy.id === "enemy_cave_bat");
  const boss = { ...structuredClone(slime), id: "enemy_slime_king", name: "슬라임 왕", battleScalePercent: 140 };
  db.enemies.push(boss);
  slime.collapseEffect = "pixelBreak";
  bat.collapseEffect = "flash";
  boss.collapseEffect = "bossSink";
  const troop = db.troops.find((entry) => entry.id === "troop_forest_hornets");
  troop.enemyIds = ["enemy_slime", "enemy_cave_bat", "enemy_slime_king"];
  troop.members[2].enemyId = "enemy_slime_king";
  troop.backdropLayers = [
    { preset: "fog" },
    { preset: "embers" },
    { preset: "mist", front: true, opacity: 45 },
  ];
  if (mode === "anim") {
    // 전투 이펙트 셀 회전·뒤집기 + 레코드 겹치기(더하기) — 모든 애니메이션에 걸어 첫 공격에서 본다.
    for (const enemy of [slime, bat, boss]) enemy.stats = { ...enemy.stats, maxHp: 9999 };
    for (const animation of db.battleAnimations) {
      animation.blendMode = "add";
      for (const frame of animation.frames ?? []) for (const cell of frame.cells) { cell.rotation = 35; cell.mirror = true; }
    }
  }
  if (mode === "aura") {
    // 전투 이벤트 페이지는 행동 뒤에 검사된다 — 한 명이 한 번 때리게 하므로 적은 버티게 둔다.
    for (const enemy of [slime, bat, boss]) enemy.stats = { ...enemy.stats, maxHp: 9999 };
    troop.battleEventPages = [{
      id: "fx_states", name: "상태 걸기", conditions: [], graphic: {}, trigger: { kind: "auto" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [
        m2("m2-100-change-enemy-state", { target: "enemy-1", operation: "add", value: "state_sleep" }),
        m2("m2-100-change-enemy-state", { target: "enemy-2", operation: "add", value: "state_confuse" }),
        m2("m2-100-change-enemy-state", { target: "enemy-2", operation: "add", value: "state_paralysis" }),
        m2("m2-100-change-enemy-state", { target: "enemy-3", operation: "add", value: "state_burn" }),
        m2("m2-100-change-enemy-state", { target: "enemy-3", operation: "add", value: "state_silence" }),
      ],
    }];
  } else if (mode === "collapse") {
    for (const enemy of [slime, bat, boss]) enemy.stats = { ...enemy.stats, maxHp: 1, defense: 0, agility: 1 };
  }
  // 시작 맵에 자동 전투 이벤트 하나 — 이동·대사 없이 곧장 전투로 들어간다.
  const map = project.maps[project.startMapId];
  map.events.push({
    id: "ev_fx_battle", name: "전투 연출 시험", x: project.startPos.x + 1, y: project.startPos.y, trigger: { kind: "auto" }, commands: [],
    pages: [{
      id: "ev_fx_battle_page", name: "전투", conditions: [], trigger: { kind: "auto" }, graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", overlapForbidden: false,
      commands: [{ kind: "battleProcessing", troopId: "troop_forest_hornets", canEscape: false, canLose: true }, { kind: "wait", ms: 600000 }],
    }],
  });
  return JSON.stringify(project);
}

const STATE_EXPR = `(() => {
  const nodes = [...document.querySelectorAll(".battle-enemy")];
  return {
    enemies: nodes.map((node) => ({ id: node.dataset.testid, defeated: node.classList.contains("defeated"), collapse: node.dataset.collapse ?? null,
      collapseState: node.dataset.collapseState ?? null, aura: node.dataset.battleAura ?? null,
      canvas: Boolean(node.querySelector("[data-testid='battle-enemy-collapse']")),
      debug: (() => { const c = node.querySelector("[data-testid='battle-enemy-collapse']"); const img = node.querySelector(".battle-enemy-image");
        if (!c) return null; const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); const ir = img.getBoundingClientRect();
        return { cTransform: cs.transform, cAnim: cs.animationName, nodeTransform: getComputedStyle(node).transform, imgTransform: getComputedStyle(img).transform,
          cRect: [r.left, r.top, r.width, r.height].map(Math.round), imgRect: [ir.left, ir.top, ir.width, ir.height].map(Math.round), style: c.getAttribute("style"),
          bgPos: getComputedStyle(img).backgroundPosition, bgSize: getComputedStyle(img).backgroundSize, size: [c.width, c.height] }; })() })),
    layers: [...document.querySelectorAll("[data-testid='battle-backdrop-layer']")].map((node) => ({ preset: node.dataset.preset, front: node.dataset.front, pos: node.style.backgroundPosition, blend: node.style.mixBlendMode })),
    filter: document.querySelector("[data-testid='display-filter']")?.dataset.filter ?? null,
    filterIsLast: document.querySelector(".play-stage")?.lastElementChild?.dataset.testid === "display-filter",
  };
})()`;

async function openBattle(browser, mode, report) {
  // 쓰러짐 연출(0.5~1.8초)은 스크린샷(한 장 0.5초 안팎)으로는 못 따라간다 — 그 판은 영상으로 남겨 프레임을 뽑는다.
  const context = await browser.newContext({
    viewport: { width: 960, height: 720 },
    ...(mode !== "aura" ? { recordVideo: { dir: join(outDir, `video-${mode}`), size: { width: 960, height: 720 } } } : {}),
  });
  const page = await context.newPage();
  page.openedAt = Date.now();
  page.on("pageerror", (error) => report.errors.push(`${mode}: ${String(error?.message ?? error)}`));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(`${mode} console.error: ${message.text()}`); });
  const projectJson = await buildProject(mode);
  await page.addInitScript(([projectUrl]) => {
    try { localStorage.clear(); } catch { /* 그대로 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "battle-fx", qaInstrumentation: true };
  }, [PROJECT_URL]);
  await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  for (let tries = 0; tries < 80; tries += 1) {
    if (await page.locator("[data-testid='actor-command-attack']").count()) break;
    await page.waitForTimeout(500);
    if (tries % 4 === 3) await page.keyboard.press("z");
  }
  await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 30_000 });
  return page;
}

await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const report = { skin, filter, aura: [], collapse: [], errors: [] };
try {
  {
    const page = await openBattle(browser, "aura", report);
    await page.keyboard.press("z");
    await page.waitForTimeout(300);
    await page.keyboard.press("z");
    await page.waitForFunction("document.querySelector('.battle-enemy[data-battle-aura]') !== null", null, { timeout: 30_000 });
    await page.waitForTimeout(2200);
    for (let index = 0; index < 3; index += 1) {
      const file = `${skin}-aura-${index}.png`;
      await page.screenshot({ path: join(outDir, file) });
      report.aura.push({ file, state: await page.evaluate(STATE_EXPR) });
      await page.waitForTimeout(450);
    }
    await page.context().close();
  }
  {
    const page = await openBattle(browser, "anim", report);
    await page.keyboard.press("z");
    await page.waitForTimeout(300);
    await page.keyboard.press("z");
    // 도트 측면 스킨의 통상 공격은 도트 모션으로 그려 전투 이펙트가 없다 — 그때는 이 판을 건너뛴다.
    const appeared = await page.waitForSelector("[data-testid='battle-animation-cell']", { timeout: 8_000, state: "attached" }).then(() => true, () => false);
    if (appeared) report.animVideoOffsetMs = Date.now() - page.openedAt;
    report.anim = !appeared ? null : await page.evaluate(`(() => {
      const node = document.querySelector("[data-testid='battle-animation']");
      const cell = node?.querySelector("[data-testid='battle-animation-cell']");
      const layer = document.querySelector("[data-testid='battle-animation-layer']");
      return { id: node?.dataset.animationId, blend: node?.dataset.blend, mix: node && getComputedStyle(node).mixBlendMode, layerMix: layer && getComputedStyle(layer).mixBlendMode,
        rotation: cell?.dataset.rotation, mirror: cell?.dataset.mirror, transform: cell?.style.transform,
        // 섞기가 무대(배경·배틀러)까지 닿는지 — 부모 쪽 첫 스태킹 컨텍스트가 배경을 품어야 한다.
        context: (() => { let el = node?.parentElement; while (el) { const cs = getComputedStyle(el);
          if (cs.isolation === "isolate" || (cs.zIndex !== "auto" && cs.position !== "static") || cs.transform !== "none" || Number(cs.opacity) < 1 || cs.filter !== "none" || cs.mixBlendMode !== "normal")
            return { className: el.className, testid: el.dataset.testid, containsBackdrop: Boolean(el.querySelector("[data-testid='battle-backdrop']")) };
          el = el.parentElement; } return null; })() };
    })()`);
    await page.waitForTimeout(1500);
    const animVideo = page.video();
    await page.context().close();
    if (animVideo) report.animVideo = await animVideo.path();
  }
  {
    const page = await openBattle(browser, "collapse", report);
    const started = Date.now();
    report.videoOffsetMs = started - page.openedAt;
    let index = 0;
    let lastPress = 0;
    while (Date.now() - started < 9000) {
      if (Date.now() - lastPress > 260) {
        await page.keyboard.press("z");
        lastPress = Date.now();
      }
      const state = await page.evaluate(STATE_EXPR);
      const busy = state.enemies.some((enemy) => enemy.collapseState === "playing");
      if (busy) {
        const file = `${skin}-collapse-${String(index).padStart(3, "0")}.png`;
        await page.screenshot({ path: join(outDir, file) });
        report.collapse.push({ file, atMs: Date.now() - started, state });
        index += 1;
      }
      if (state.enemies.length && state.enemies.every((enemy) => enemy.collapseState === "done")) break;
      await page.waitForTimeout(40);
    }
    const video = page.video();
    await page.context().close();
    if (video) report.video = await video.path();
  }
  await writeFile(join(outDir, `${skin}-report.json`), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ skin, aura: report.aura.map((entry) => entry.state), collapseFrames: report.collapse.length, last: report.collapse.at(-1)?.state, errors: report.errors }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
