// Records the same Fallen Star encounter under each `system.enemyStillMotion` mode, one run per
// variant, and captures the DOM state that decides whether the engine animator took the picture over.
//
//   node mmeng_record.mjs <worktree> <fixturesDir> <outDir> <runsJson>
//
// runsJson: [{ key, enemyId, mapId, mode, kind, troop?, stripSheet?, reducedMotion? }]
//   mode        : "all" | "stillOnly" | "off"  → system.enemyStillMotion
//   kind        : "sheet"  keep the authored multi-frame sheet
//                 "still"  drop the sheet metadata so the enemy is a single uploaded frame
//   troop       : [{ enemyId, x, y }] for a multi-enemy fight (defaults to the single enemy)
//   stripSheet  : true → also drop the idle strip so nothing but one <img> remains
//   reducedMotion: true → the browser reports prefers-reduced-motion: reduce
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { battleQaOp } from "../../lib/runtimeQaBattle.mjs";

const [, , repoRoot, fixtureDir, outDir, runsPath] = process.argv;
if (!repoRoot || !fixtureDir || !outDir || !runsPath) throw new Error("usage: <worktree> <fixturesDir> <outDir> <runsJson>");

process.env.VITE_CACHE_DIR = join(resolve(repoRoot), ".omo/monster-motion-engine/vite-cache");
process.env.VITE_BGM_CDN_BASE = "";
const out = resolve(outDir);
mkdirSync(out, { recursive: true });
const runs = JSON.parse(readFileSync(runsPath, "utf8"));
const base = JSON.parse(readFileSync(join(fixtureDir, "base.play.json"), "utf8"));

function fixtureServer() {
  const body = new Map();
  const http = createServer((req, res) => {
    const name = (req.url ?? "/").replace(/^\//, "").split("?")[0];
    const payload = body.get(name);
    if (!payload) {
      res.writeHead(404, { "access-control-allow-origin": "*" });
      res.end("missing");
      return;
    }
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    });
    res.end(payload);
  });
  return new Promise((done) => {
    http.listen(0, "127.0.0.1", () => done({ http, port: http.address().port, put: (name, json) => body.set(name, json) }));
  });
}

const EVENT = "qa_fight_mmeng";
const TROOP = "qa_troop_mmeng";
const log = (step, extra = {}) => console.log(JSON.stringify({ t: new Date().toISOString().slice(11, 19), step, ...extra }));

function enemyLuma(png, box) {
  try {
    const crop = `${Math.max(1, Math.round(box.w))}x${Math.max(1, Math.round(box.h))}+${Math.max(0, Math.round(box.x))}+${Math.max(0, Math.round(box.y))}`;
    return Number(execFileSync("convert", [png, "-crop", crop, "+repage", "-colorspace", "Gray", "-format", "%[fx:mean]", "info:"], { encoding: "utf8" }).trim());
  } catch {
    return null;
  }
}

/** 초상 자산에서 시트 표식을 떼어 「그림 한 장」으로 만든다(번들 시트·idle 스트립도 함께 걷는다). */
function makeStill(project, monster, stripSheet) {
  const portrait = project.assets.uploaded[monster];
  if (portrait?.meta?.pixelEnemySheet) {
    const { pixelEnemySheet, ...meta } = portrait.meta;
    portrait.meta = meta;
  }
  if (stripSheet && portrait?.meta) {
    const sheetId = portrait.meta.pixelEnemySheet?.sheetResourceId;
    if (sheetId) delete project.assets.uploaded[sheetId];
  }
}

function withFight(project, run) {
  const map = project.maps[run.mapId];
  if (!map) throw new Error(`map ${run.mapId} missing`);
  project.system = { ...project.system, enemyStillMotion: run.mode };
  const enemyIds = (run.troop ?? [{ enemyId: run.enemyId }]).map((member) => member.enemyId);
  for (const id of new Set(enemyIds)) {
    const enemy = project.database.enemies.find((row) => row.id === id);
    if (!enemy) throw new Error(`enemy ${id} missing`);
    enemy.stats = { ...enemy.stats, maxHp: 480, attack: 20, defense: 2, mind: 20, agility: 20 };
    enemy.actions = [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }];
    if (run.kind === "still") makeStill(project, enemy.monsterResourceId, run.stripSheet);
  }

  const troops = Array.isArray(project.database.troops) ? project.database.troops : Object.values(project.database.troops);
  const members = (run.troop ?? [{ enemyId: run.enemyId, x: 120, y: 104 }]).map((member, index) => ({
    enemyId: member.enemyId,
    x: member.x ?? 120 + index * 56,
    y: member.y ?? 104,
    hidden: false,
  }));
  const troop = { id: TROOP, name: "qa", enemyIds: members.map((m) => m.enemyId), members, autoAlign: true, uncapturable: false, battleEventPages: [] };
  const at = troops.findIndex((row) => row.id === TROOP);
  if (at >= 0) troops[at] = troop; else troops.push(troop);
  project.database.troops = Array.isArray(project.database.troops) ? troops : Object.fromEntries(troops.map((row) => [row.id, row]));

  const events = Array.isArray(map.events) ? map.events : Object.values(map.events ?? {});
  const page = {
    id: `${EVENT}_page`, name: EVENT, conditions: [], graphic: { transparent: true },
    trigger: { kind: "action" }, priority: "below", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true }],
  };
  const event = { id: EVENT, x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [page] };
  const existing = events.findIndex((row) => row.id === EVENT);
  if (existing >= 0) events[existing] = event; else events.push(event);
  map.events = Array.isArray(map.events) ? events : Object.fromEntries(events.map((row) => [row.id, row]));
  map.encounterRate = 0;
}

/** 한 적 노드의 그림 상태 — 엔진이 실제로 무엇을 바꿨는지 이 값들로만 판정한다. */
const PROBE = () => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  return [...document.querySelectorAll(".battle-enemy")].map((node) => {
    const image = node.querySelector(".battle-enemy-image");
    const style = image ? getComputedStyle(image) : null;
    const animation = image?.getAnimations?.()[0];
    return {
      enemy: node.dataset.testid ?? null,
      pixelEnemy: node.dataset.pixelEnemy ?? null,
      pixelCell: node.dataset.retroPixelCell ?? null,
      cell: node.dataset.pixelEnemyCell ?? null,
      animMarker: image?.hasAttribute("data-enemy-anim") ?? null,
      animBeat: node.dataset.enemyAnimBeat ?? null,
      translate: style?.translate ?? null,
      rotate: style?.rotate ?? null,
      filter: style?.filter ?? null,
      scale: style?.scale ?? null,
      opacity: style?.opacity ?? null,
      backgroundPosition: style?.backgroundPosition ?? null,
      running: Boolean(animation && animation.playState === "running"),
      animationName: animation?.animationName ?? animation?.transitionProperty ?? null,
    };
  }).map((row) => ({ ...row, scene: { bigBoss: scene?.dataset.battleBigBoss ?? null, director: scene?.dataset.battleDirectorStep ?? null, phase: scene?.dataset.battlePhase ?? null } }));
};

const server = await startPlayerQaServer();
const fixtures = await fixtureServer();
log("server-up", { url: server.url });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const results = [];
try {
  for (const run of runs) {
    const existing = join(out, `record-${run.key}.json`);
    if (run.force !== true && existsSync(existing)) {
      log("skip-recorded", { key: run.key });
      continue;
    }
    const project = structuredClone(base);
    withFight(project, run);
    const fixtureJson = JSON.stringify(project);
    writeFileSync(join(out, `fixture-${run.key}.json`), fixtureJson);
    fixtures.put(`fixture-${run.key}.json`, fixtureJson);

    const frames = [];
    const errors = [];
    const frameDir = join(out, "frames", run.key);
    mkdirSync(frameDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: run.reducedMotion ? "reduce" : "no-preference" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
    const startedAt = Date.now();
    try {
      await page.addInitScript((payload) => { window.__OPENRPG_BOOT__ = payload; }, {
        projectUrl: `http://127.0.0.1:${fixtures.port}/fixture-${run.key}.json`,
        saveNamespace: `mmeng-${run.key}`,
        qaInstrumentation: true,
        qaCheckpoint: {
          id: `mmeng-${run.key}`, mapId: run.mapId, x: 3, y: 4, facing: "up",
          switches: { sw_fs_main_started: true, sw_fs_valen_marched: true },
          party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
          startEventId: EVENT,
        },
      });
      const boot = async () => {
        await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
        await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 420000 });
        await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 180000 });
      };
      try {
        await boot();
      } catch (error) {
        log("boot-retry", { key: run.key, error: String(error?.message ?? error).slice(0, 90) });
        await boot();
      }
      log("battle-scene", { key: run.key, ms: Date.now() - startedAt });

      const shoot = async (label, phase) => {
        const state = await page.evaluate(PROBE);
        await page.screenshot({ path: join(frameDir, `${label}.png`) });
        frames.push({ phase, file: `${label}.png`, at: Date.now() - startedAt, enemies: state });
      };

      await page.waitForTimeout(600);
      const settleEnemy = async () => {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const box = await page.evaluate(() => {
            const image = document.querySelector(".battle-enemy-image");
            if (!image) return null;
            const rect = image.getBoundingClientRect();
            return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
          });
          if (!box || box.w < 4 || box.h < 4) { await page.waitForTimeout(400); continue; }
          const probe = `/tmp/mmeng-probe-luma.png`;
          await page.screenshot({ path: probe });
          const luma = enemyLuma(probe, box);
          if (luma !== null && luma > 0.06) {
            log("enemy-settled", { key: run.key, luma: Math.round(luma * 1000) / 1000, attempt });
            return;
          }
          await page.waitForTimeout(400);
        }
        log("enemy-still-dark", { key: run.key });
      };
      await settleEnemy();
      await shoot("01-idle", "idle");

      const burst = async (phase, trigger, everyMs = 130) => {
        let running = true;
        const done = trigger().finally(() => { running = false; });
        let index = 0;
        while (running) {
          index += 1;
          await shoot(`${phase}-${String(index).padStart(2, "0")}`, phase);
          await page.waitForTimeout(everyMs);
          if (index > 90) break;
        }
        await done.catch((error) => log("op-error", { key: run.key, phase, error: String(error?.message ?? error).slice(0, 140) }));
      };

      await burst("02-attackturn", () => battleQaOp(page, {
        plan: { actor_hero: ["defend"], actor_fs_elena: ["defend"] }, commands: 2, timeoutMs: 180000, fallback: "defend",
      }));
      await burst("03-ourattack", () => battleQaOp(page, {
        plan: { actor_hero: ["attack@enemy-1"], actor_fs_elena: ["attack@enemy-1"] }, commands: 1, timeoutMs: 180000, fallback: "attack",
      }), 110);
      await burst("04-finish", () => battleQaOp(page, {
        plan: { actor_hero: ["attack@enemy-1"], actor_fs_elena: ["attack@enemy-1"] }, commands: 20, timeoutMs: 300000, fallback: "attack", untilEnd: true,
      }), 130);

      results.push({ key: run.key, mode: run.mode, kind: run.kind, ok: errors.length === 0, totalMs: Date.now() - startedAt, errors, frameCount: frames.length, frames });
      writeFileSync(join(out, `record-${run.key}.json`), JSON.stringify(results.at(-1), null, 2));
      log("run-done", { key: run.key, frames: frames.length, errors: errors.length });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
  fixtures.http.close();
}
writeFileSync(join(out, "record.json"), JSON.stringify(results.map(({ frames, ...rest }) => rest), null, 2));
log("all-done", { runs: results.map((row) => row.key) });
