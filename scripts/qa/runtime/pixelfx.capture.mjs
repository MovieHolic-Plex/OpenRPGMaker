// pixelfx 코드 효과 캡처 — 출하 플레이어(player.html)에서 필드 상시 효과·한 번 효과와 전투 기술 효과를 실제로 그린다.
//
//   field  : 새솔마을(examples/saesol-red) 시작 지점 둘레에 횃불·모닥불·반딧불(앞 층)·폭포 상시 효과 이벤트를 놓고,
//            병렬 이벤트가 「애니메이션 표시」로 주인공 회복 빛·칸 폭발을 번갈아 튼다. 녹화 + 틱 비용(__oprnPixelFxStats).
//   stress : 같은 맵에 상시 효과 이벤트를 --stress 개(기본 16) 더 놓고 틱 비용·rAF 간격을 잰다.
//   battle : editor-authored-demo-v3 + 도트 측면(retro2003) — 주인공 기술 「서리 폭발」(ice/frost-nova)과 통상 공격(melee/sword-slash).
//
// 사용: node scripts/qa/runtime/pixelfx.capture.mjs --out /tmp/pixelfx-qa [--mode field,stress,battle] [--stress 16]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const outDir = resolve(arg("out", "/tmp/pixelfx-qa"));
const modes = arg("mode", "field,stress,battle").split(",");
const stressCount = Number(arg("stress", "16"));

const pfx = (effectId, extra = {}) => ({
  id: `anim_pfx_${effectId.replace(/[/-]/g, "_")}`, name: `pixelfx ${effectId}`, scope: "singleTarget", position: "feet",
  pixelFx: { effectId, ...extra },
});

function ambientEvent(id, x, y, pixelFx) {
  return {
    id, name: id, x, y, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: `${id}_page`, name: "효과", conditions: [], trigger: { kind: "action" }, graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", overlapForbidden: false, commands: [], pixelFx,
    }],
  };
}

async function fieldProject(stress) {
  const project = JSON.parse(gunzipSync(await readFile(join(REPO_ROOT, "examples/saesol-red/project.json.gz"))).toString("utf8"));
  const db = project.database;
  db.battleAnimations.push(pfx("holy/heal"), pfx("explosions/small-explosion"), pfx("arcane/magic-circle-cast"));
  const map = project.maps[project.startMapId];
  const { x, y } = project.startPos;
  map.events.push(
    ambientEvent("ev_pfx_torch", x - 3, y - 2, { effectId: "fire/torch" }),
    ambientEvent("ev_pfx_campfire", x + 3, y - 2, { effectId: "fire/campfire" }),
    ambientEvent("ev_pfx_blue", x - 3, y + 1, { effectId: "fire/torch", palette: ["#102040", "#1a3a8a", "#2f6fe0", "#5aa8ff", "#a8e0ff", "#ffffff"], seed: 7 }),
    ambientEvent("ev_pfx_fireflies", x, y - 3, { effectId: "weather/fireflies", layer: "front" }),
  );
  if (stress) {
    for (let i = 0; i < stress; i += 1) {
      const effectId = ["fire/torch", "fire/candle", "fire/brazier", "water/fountain"][i % 4];
      map.events.push(ambientEvent(`ev_pfx_stress_${i}`, (x - 8 + (i % 8) * 2 + map.width) % map.width, Math.max(1, y - 6 + Math.floor(i / 8) * 9), { effectId, seed: i }));
    }
  }
  map.events.push({
    id: "ev_pfx_show", name: "한 번 효과", x: x + 1, y: y + 3, trigger: { kind: "parallel" }, commands: [],
    pages: [{
      id: "ev_pfx_show_page", name: "반복", conditions: [], trigger: { kind: "parallel" }, graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", overlapForbidden: false,
      commands: [
        { kind: "wait", ms: 900 },
        { kind: "showAnimation", target: "player", animationId: "anim_pfx_holy_heal", wait: true },
        { kind: "wait", ms: 300 },
        { kind: "showAnimation", target: { x: x + 2, y: y - 1 }, animationId: "anim_pfx_explosions_small_explosion", wait: true },
        { kind: "wait", ms: 300 },
        { kind: "showAnimation", target: { x: x - 1, y: y - 1 }, animationId: "anim_pfx_arcane_magic_circle_cast", wait: true },
        { kind: "wait", ms: 600 },
      ],
    }],
  });
  return JSON.stringify(project);
}

async function battleProject() {
  const project = JSON.parse(await readFile(join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json"), "utf8"));
  project.system.battleUiStyle = "retro2003";
  const db = project.database;
  db.battleAnimations.push(pfx("ice/frost-nova"), pfx("melee/sword-slash", { position: "center" }), pfx("impacts/hit-flash"));
  const base = structuredClone(db.skills.find((skill) => skill.scope && skill.effect) ?? db.skills[0]);
  db.skills.push({ ...base, id: "skill_pfx_frost", name: "서리 폭발", animationId: "anim_pfx_ice_frost_nova", mpCost: 0, tpCost: 0, scope: "allEnemies", retroChoreographyId: undefined });
  for (const cls of db.classes) {
    cls.skillIds = ["skill_pfx_frost", ...(cls.skillIds ?? [])];
    cls.animationId = "anim_pfx_melee_sword_slash";
  }
  for (const enemy of db.enemies) enemy.stats = { ...enemy.stats, maxHp: 9999 };
  const map = project.maps[project.startMapId];
  map.events.push({
    id: "ev_pfx_battle", name: "전투", x: project.startPos.x + 1, y: project.startPos.y, trigger: { kind: "auto" }, commands: [],
    pages: [{
      id: "ev_pfx_battle_page", name: "전투", conditions: [], trigger: { kind: "auto" }, graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", overlapForbidden: false,
      commands: [{ kind: "battleProcessing", troopId: "troop_forest_hornets", canEscape: false, canLose: true }, { kind: "wait", ms: 600000 }],
    }],
  });
  return JSON.stringify(project);
}

async function open(browser, name, projectJson, report, video = true) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 720 },
    ...(video ? { recordVideo: { dir: join(outDir, `video-${name}`), size: { width: 960, height: 720 } } } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(`${name}: ${String(error?.message ?? error)}`));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(`${name} console.error: ${message.text()}`); });
  await page.addInitScript(([projectUrl, ns]) => {
    try { localStorage.clear(); } catch { /* 그대로 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true };
  }, [PROJECT_URL, `pixelfx-${name}`]);
  await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector("[data-testid='title-screen'], [data-testid='runtime-state-json']", { timeout: 240_000 });
  } catch (error) {
    await page.screenshot({ path: join(outDir, `${name}-boot-fail.png`) }).catch(() => {});
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 600) ?? "").catch(() => "");
    report.errors.push(`${name}: boot timeout — body: ${body}`);
    await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    throw error;
  }
  page.openedAt = Date.now();
  if (await page.locator("[data-testid='title-screen']").count()) await page.keyboard.press("Enter");
  return page;
}

/** rAF 간격과 updatePixelFx 비용을 ms 동안 모은다. */
async function sample(page, ms) {
  return page.evaluate(async (duration) => {
    const frames = [];
    const fx = [];
    const end = performance.now() + duration;
    let last = performance.now();
    await new Promise((done) => {
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        const stats = window.__oprnPixelFxStats;
        if (stats) fx.push({ ms: stats.ms, draws: stats.draws, visible: stats.visible, ambient: stats.ambient, oneShots: stats.oneShots, shared: stats.sharedLoops, deferred: stats.deferred });
        if (now < end) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * p)] ?? 0;
    const fxMs = fx.map((s) => s.ms);
    return {
      frames: frames.length, frameAvgMs: avg(frames), frameP95Ms: pct(frames, 0.95),
      fxAvgMs: avg(fxMs), fxP95Ms: pct(fxMs, 0.95), fxMaxMs: Math.max(0, ...fxMs),
      drawsAvg: avg(fx.map((s) => s.draws)), last: fx.at(-1) ?? null,
    };
  }, ms);
}

await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const report = { errors: [], field: null, stress: null, battle: null };
try {
  if (modes.includes("field")) {
    const page = await open(browser, "field", await fieldProject(0), report);
    await page.waitForFunction("window.__oprnPixelFxStats && window.__oprnPixelFxStats.ambient >= 4", null, { timeout: 60_000 });
    const warm = await sample(page, 2500);
    await page.screenshot({ path: join(outDir, "field-0.png") });
    const steady = await sample(page, 4000);
    for (let i = 1; i <= 4; i += 1) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(outDir, `field-${i}.png`) });
    }
    report.field = { warm, steady, videoStartMs: Date.now() - page.openedAt };
    const video = page.video();
    await page.context().close();
    if (video) report.field.video = await video.path();
  }
  if (modes.includes("stress")) {
    const page = await open(browser, "stress", await fieldProject(stressCount), report, false);
    await page.waitForFunction(`window.__oprnPixelFxStats && window.__oprnPixelFxStats.ambient >= ${4 + stressCount}`, null, { timeout: 60_000 });
    const warm = await sample(page, 3000);
    const steady = await sample(page, 5000);
    await page.screenshot({ path: join(outDir, "stress.png") });
    report.stress = { count: 4 + stressCount, warm, steady };
    await page.context().close();
  }
  if (modes.includes("battle")) {
    const page = await open(browser, "battle", await battleProject(), report);
    for (let tries = 0; tries < 80; tries += 1) {
      if (await page.locator("[data-testid='actor-command-attack']").count()) break;
      await page.waitForTimeout(500);
      if (tries % 4 === 3) await page.keyboard.press("z");
    }
    await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 30_000 });
    await page.screenshot({ path: join(outDir, "battle-0-menu.png") });
    const commands = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='actor-command']")].map((n) => n.dataset.testid));
    report.battle = { commands, shots: [] };
    // 기술 → 서리 폭발(전체기). 명령 칸은 격자가 포인터를 가로채므로 DOM click 으로 누른다.
    await page.evaluate(() => document.querySelector("[data-testid='actor-command-skill']")?.click());
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(outDir, "battle-1-skills.png") });
    report.battle.skillList = await page.evaluate(() => [...document.querySelectorAll("button, [role='option'], li")].map((n) => n.textContent?.trim()).filter((t) => t && t.length < 40).slice(0, 30));
    report.battle.frostClicked = await page.evaluate(() => {
      const hit = [...document.querySelectorAll("button, [role='option'], li, [data-testid]")].find((n) => n.textContent?.includes("서리 폭발") && n.children.length < 6);
      if (!hit) return false;
      hit.click();
      return true;
    });
    await page.waitForTimeout(300);
    if (!report.battle.frostClicked) await page.keyboard.press("z");
    await page.waitForTimeout(300);
    await page.keyboard.press("z");
    const appeared = await page.waitForSelector(".battle-animation[data-pixel-fx]", { timeout: 15_000, state: "attached" }).then(() => true, () => false);
    report.battle.appeared = appeared;
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(160);
      const file = `battle-fx-${i}.png`;
      await page.screenshot({ path: join(outDir, file) });
      report.battle.shots.push({
        file,
        node: await page.evaluate(() => {
          const node = document.querySelector(".battle-animation[data-pixel-fx]");
          return node ? { fx: node.dataset.pixelFx, ready: node.dataset.pixelFxReady, anchor: node.dataset.animationAnchor, size: node.querySelector(".pixel-fx")?.dataset.pixelFxSize } : null;
        }),
      });
    }
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(outDir, "battle-9-after.png") });
    const video = page.video();
    await page.context().close();
    if (video) report.battle.video = await video.path();
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
