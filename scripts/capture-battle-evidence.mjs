/**
 * Capture battle pose / hit-feel / backdrop screenshots into SCRATCH.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SCRATCH = process.env.SCRATCH || "C:\\Users\\hyeon\\AppData\\Local\\Temp\\grok-goal-51c4e6878dd4\\implementer";
fs.mkdirSync(SCRATCH, { recursive: true });

const project = JSON.parse(fs.readFileSync("test/fixtures/projects/battle-v3.json", "utf8"));
project.system.systemResourceId = "windowskin-rm2003";
// Ensure troop uses forest so terrain case can differ when we inject terrain later.
for (const troop of project.database.troops || []) {
  troop.previewBackgroundResourceId = "generated-battle-reference-forest";
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(30_000);

await page.addInitScript((seed) => {
  window.__OPRN_E2E_PROJECT__ = seed;
  window.localStorage.clear();
}, project);

await page.goto("http://127.0.0.1:9173/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(1500);

await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 20_000 });
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);

// Mount battle via dynamic import (same path as shipped modules)
const inject = await page.evaluate(async () => {
  const runtimeMod = await import("/src/battle/runtime.ts");
  const advanceMod = await import("/src/battle/battleRuntimeAdvance.ts");
  const battleDom = await import("/src/player/battleDom.ts");
  const storeMod = await import("/src/project/store.ts");
  const project = storeMod.store.getCurrent();
  for (const e of project.database.enemies) {
    e.stats.maxHp = 500;
    e.stats.defense = 1;
  }
  const troopId = project.database.troops[0]?.id;
  const host =
    document.querySelector('[data-testid="test-play-window-body"]') ||
    document.querySelector('[data-testid="play-viewport"]') ||
    document.body;
  const rt = runtimeMod.createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    battleFlow: "gauge",
  });
  // Charge until command
  for (let i = 0; i < 20000; i++) {
    rt.tick(50);
    if (rt.snapshot().phase === "actorCommand") break;
  }
  window.__EVIDENCE_RT__ = rt;
  window.__EVIDENCE_HOST__ = host;
  advanceMod.advanceBattleRuntime(rt);
  battleDom.mountBattleScene({ host, runtime: rt, onResult: () => {} });
  const snap = rt.snapshot();
  return {
    phase: snap.phase,
    poses: snap.actors.map((a) => a.pose).concat(snap.enemies.map((e) => e.pose)),
    backdrop: snap.backdropResourceId,
  };
});
console.log("inject idle", inject);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SCRATCH, "battle-pose-idle.png") });

// Force attack resolve
const afterAttack = await page.evaluate(async () => {
  const rt = window.__EVIDENCE_RT__;
  const snap = rt.snapshot();
  const enemyId = snap.enemies[0]?.id;
  if (snap.phase === "actorCommand" && enemyId) {
    rt.performActorCommand({ kind: "attack", targetEnemyId: enemyId });
  } else if (snap.phase === "targetSelect" && enemyId) {
    rt.selectTargetEnemy(enemyId);
  }
  // Click attack + target if UI is up
  const attackBtn = document.querySelector('[data-testid="actor-command-attack"]');
  if (attackBtn instanceof HTMLElement) attackBtn.click();
  await new Promise((r) => setTimeout(r, 100));
  const enemyBtn = document.querySelector(".battle-enemy[data-battle-targetable='true']");
  if (enemyBtn instanceof HTMLElement) enemyBtn.click();
  await new Promise((r) => setTimeout(r, 700));
  const after = rt.snapshot();
  const scene = document.querySelector('[data-testid="battle-scene"]');
  return {
    last: after.lastActionResult,
    poses: {
      actors: after.actors.map((a) => ({ id: a.recordId, pose: a.pose, data: document.querySelector(`[data-testid="battle-actor-${a.recordId}"]`)?.getAttribute("data-battle-pose") })),
      enemies: after.enemies.map((e) => ({ id: e.id, pose: e.pose, data: document.querySelector(`[data-testid="${e.id}"]`)?.getAttribute("data-battle-pose") })),
    },
    hitFeel: after.hitFeel,
    hitFeelDom: scene?.getAttribute("data-battle-hit-feel"),
    hitStopClass: scene?.classList.contains("battle-hit-stop"),
    popup: !!document.querySelector('[data-testid="battle-damage-popup"]'),
    backdrop: after.backdropResourceId,
  };
});
console.log("afterAttack", JSON.stringify(afterAttack, null, 2));
await page.screenshot({ path: path.join(SCRATCH, "battle-pose-hit.png") });
await page.screenshot({ path: path.join(SCRATCH, "battle-hit-feel.png") });

// Backdrop forest case
await page.screenshot({ path: path.join(SCRATCH, "battle-backdrop-forest.png") });

// Terrain-mapped backdrop: rebuild runtime with no troop preview + terrain tag
const terrainCase = await page.evaluate(async () => {
  const runtimeMod = await import("/src/battle/runtime.ts");
  const battleDom = await import("/src/player/battleDom.ts");
  const storeMod = await import("/src/project/store.ts");
  const backdropMod = await import("/src/battle/battleBackdrop.ts");
  const project = storeMod.store.getCurrent();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  const tileset = project.tilesets[map.tilesetId];
  const x = project.startPos.x;
  const y = project.startPos.y;
  const tile = map.lowerTiles[y * map.width + x] ?? 0;
  if (!Array.isArray(tileset.terrain)) tileset.terrain = [];
  while (tileset.terrain.length <= tile) tileset.terrain.push(0);
  tileset.terrain[tile] = 1;
  tileset.tileMeta = { ...(tileset.tileMeta || {}), [tile]: { ...(tileset.tileMeta?.[tile] || {}), terrainTag: 1 } };
  project.database.terrains = [
    {
      id: "terrain_grassland",
      name: "초원",
      damage: 0,
      encounterRatePercent: 100,
      battleBackgroundResourceId: "easyrpg-backdrop-dawn1",
      characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true },
    },
  ];
  const troop = project.database.troops[0];
  delete troop.previewBackgroundResourceId;
  const resolved = backdropMod.resolveBattleBackdrop({
    project,
    troopId: troop.id,
    location: { mapId, x, y },
  });
  // Remount battle with terrain location
  document.querySelector('[data-testid="battle-scene"]')?.remove();
  const host = window.__EVIDENCE_HOST__ || document.body;
  const rt = runtimeMod.createBattleRuntime({
    project,
    troopId: troop.id,
    canEscape: true,
    canLose: true,
    captureLocation: { mapId, x, y },
  });
  battleDom.mountBattleScene({ host, runtime: rt, onResult: () => {} });
  await new Promise((r) => setTimeout(r, 300));
  const bd = document.querySelector('[data-testid="battle-backdrop"]');
  return {
    resolved,
    snapBackdrop: rt.snapshot().backdropResourceId,
    domBg: bd ? getComputedStyle(bd).backgroundImage.slice(0, 200) : null,
    resourceAttr: bd?.getAttribute("data-backdrop-resource-id"),
  };
});
console.log("terrainCase", terrainCase);
await page.screenshot({ path: path.join(SCRATCH, "battle-backdrop-terrain.png") });

fs.writeFileSync(
  path.join(SCRATCH, "evidence-summary.json"),
  JSON.stringify({ inject, afterAttack, terrainCase }, null, 2)
);

await browser.close();
console.log("screenshots written to", SCRATCH);
