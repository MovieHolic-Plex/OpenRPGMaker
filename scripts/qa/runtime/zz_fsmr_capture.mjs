// fs-monster-regen copy of fs-monster-check capture (read/capture only, not committed): for one Fallen Star monster, boot the SHIPPED
// player (dist/export-player via packagedPlayerQaServer) into a solo battle against it and capture
// clip screenshots of the enemy with the sheet cell the engine actually painted (from background-position).
//
//   node zz_fsmc_capture.mjs <play.json> <resourceId> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPackagedPlayerQaServer } from "../../lib/packagedPlayerQaServer.mjs";
import { battleQaOp } from "../../lib/runtimeQaBattle.mjs";

const [, , playJson, RID, outDir] = process.argv;
const out = resolve(outDir);
mkdirSync(join(out, "frames"), { recursive: true });
const log = (step, extra = {}) => console.log(JSON.stringify({ t: new Date().toISOString().slice(11, 19), rid: RID, step, ...extra }));
const EVENT = "qa_fsmc_fight", TROOP = "qa_fsmc_troop", MAP = "fs_forest_edge";

const project = JSON.parse(readFileSync(playJson, "utf8"));
const enemy = project.database.enemies.find((row) => row.monsterResourceId === RID);
if (!enemy) throw new Error(`no enemy row uses ${RID}`);
const meta = project.assets.uploaded[RID]?.meta?.pixelEnemySheet;
if (!meta) throw new Error(`${RID} has no pixelEnemySheet`);
enemy.stats = { ...enemy.stats, maxHp: 260, attack: 14, defense: 1, mind: 10, agility: 200 };
enemy.actions = [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }];
const troops = Array.isArray(project.database.troops) ? project.database.troops : Object.values(project.database.troops);
troops.push({ id: TROOP, name: enemy.name, enemyIds: [enemy.id], members: [{ enemyId: enemy.id, x: 120, y: 104, hidden: false }], autoAlign: true, uncapturable: false, battleEventPages: [] });
project.database.troops = Array.isArray(project.database.troops) ? troops : Object.fromEntries(troops.map((row) => [row.id, row]));
const map = project.maps[MAP];
const events = Array.isArray(map.events) ? map.events : Object.values(map.events ?? {});
events.push({ id: EVENT, x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [{
  id: `${EVENT}_page`, name: EVENT, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below",
  overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
  commands: [{ kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true }] }] });
map.events = Array.isArray(map.events) ? events : Object.fromEntries(events.map((row) => [row.id, row]));
map.encounterRate = 0;

const server = await startPackagedPlayerQaServer({ projectJson: JSON.stringify(project) });
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--disable-gpu"] });
const frames = [], errors = []; let cellLog = [];
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e).slice(0, 200)));
  await page.addInitScript((payload) => { window.__OPENRPG_BOOT__ = payload; }, {
    projectUrl: "/__runtime-qa/project.json", saveNamespace: `fsmc-${RID}`, qaInstrumentation: true,
    qaCheckpoint: { id: `fsmc-${RID}`, mapId: MAP, x: 3, y: 4, facing: "up",
      switches: { sw_fs_main_started: true, sw_fs_valen_marched: true },
      party: [{ actorId: "actor_hero", level: 8 }, { actorId: "actor_fs_elena", level: 8 }], startEventId: EVENT },
  });
  const t0 = Date.now();
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 400000 });
  log("battle-scene", { ms: Date.now() - t0 });
  await page.evaluate(() => { const log = (window.__cellLog = []); let last = "";
    setInterval(() => { const n = document.querySelector(".battle-enemy"); const i = n?.querySelector(".battle-enemy-image"); if (!i) return;
      const k = getComputedStyle(i).backgroundPosition + "|" + (n.dataset.retroBeat ?? ""); if (k !== last) { last = k; log.push([Math.round(performance.now()), k]); } }, 8); });
  await page.waitForTimeout(800);

  let n = 0;
  const shoot = async (phase) => {
    const st = await page.evaluate(() => {
      const node = document.querySelector(".battle-enemy");
      const img = node?.querySelector(".battle-enemy-image");
      const r = img?.getBoundingClientRect();
      const cs = img ? getComputedStyle(img) : null;
      return { pos: cs?.backgroundPosition ?? null, size: cs?.backgroundSize ?? null, opacity: node ? getComputedStyle(node).opacity : null,
        rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null, transient: node?.dataset.retroTransient ?? null,
        retroCell: node?.dataset.retroPixelCell ?? null, defeated: node?.classList.contains("defeated") ?? null,
        grid: node?.dataset.pixelGrid ?? null, cell: node?.dataset.pixelEnemyCell ?? null, beat: node?.dataset.retroBeat ?? null, t: performance.now() };
    });
    if (!st.rect) return;
    n += 1;
    const file = `${phase}-${String(n).padStart(3, "0")}.png`;
    const pad = 48;
    const clip = { x: Math.max(0, st.rect.x - pad), y: Math.max(0, st.rect.y - pad), width: Math.min(960, st.rect.w + pad * 2), height: Math.min(540, st.rect.h + pad * 2) };
    clip.width = Math.min(clip.width, 960 - clip.x); clip.height = Math.min(clip.height, 540 - clip.y);
    await page.screenshot({ path: join(out, "frames", file), clip });
    frames.push({ phase, file, ...st });
  };
  await page.screenshot({ path: join(out, "full-idle.png") });
  for (let i = 0; i < 14; i++) { await shoot("idle"); await page.waitForTimeout(90); }
  const burst = async (phase, op, every = 40) => {
    let running = true;
    const done = op().finally(() => { running = false; });
    let k = 0;
    while (running && k < 400) { k += 1; await shoot(phase); await page.waitForTimeout(every); }
    await done.catch((e) => log("op-error", { phase, e: String(e?.message ?? e).slice(0, 160) }));
  };
  await burst("enemyturn", () => battleQaOp(page, { plan: { actor_hero: ["defend"], actor_fs_elena: ["defend"] }, commands: 2, timeoutMs: 120000, fallback: "defend" }));
  await burst("finish", () => battleQaOp(page, { plan: { actor_hero: ["attack@enemy-1"], actor_fs_elena: ["attack@enemy-1"] }, commands: 30, timeoutMs: 240000, fallback: "attack", untilEnd: true }));
  cellLog = await page.evaluate(() => window.__cellLog);
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
writeFileSync(join(out, "record.json"), JSON.stringify({ rid: RID, name: enemy.name, meta: { cell: meta.cell, grid: meta.grid, motion: meta.motion, sheetResourceId: meta.sheetResourceId }, errors, cellLog, frames }, null, 1));
log("done", { frames: frames.length, errors: errors.length });
