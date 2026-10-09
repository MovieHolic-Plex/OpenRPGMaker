/**
 * Smoke-capture approach / impact / recover motion classes during a real attack.
 * Uses the shipped battleDom path so sequencer.onActionMotion actually runs.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const OUT = process.env.SCRATCH || "output/evidence/battle-action-beats";
fs.mkdirSync(OUT, { recursive: true });

const project = JSON.parse(fs.readFileSync("test/fixtures/projects/battle-v3.json", "utf8"));
project.system.systemResourceId = "windowskin-rm2003";
// Prefer classic side-view for readable lunge offsets; pokemon still covered by CSS.
if (project.system) {
  project.system.battleUiStyle = project.system.battleUiStyle || "retro2003";
}
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

const base = process.env.OPRN_DEV_URL || "http://127.0.0.1:9999/";
await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(1200);

await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 20_000 });
await page.keyboard.press("Enter");
await page.waitForTimeout(1000);

const inject = await page.evaluate(async () => {
  const runtimeMod = await import("/src/battle/runtime.ts");
  const battleDom = await import("/src/player/battleDom.ts");
  const storeMod = await import("/src/project/store.ts");
  const project = storeMod.store.getCurrent();
  for (const e of project.database.enemies) {
    e.stats.maxHp = 500;
    e.stats.defense = 1;
  }
  for (const a of project.database.actors) {
    if (a.stats) a.stats.attack = Math.max(a.stats.attack ?? 10, 40);
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
  for (let i = 0; i < 20_000; i++) {
    rt.tick(50);
    if (rt.snapshot().phase === "actorCommand") break;
  }
  window.__BEAT_RT__ = rt;
  battleDom.mountBattleScene({ host, runtime: rt, onResult: () => {} });
  const snap = rt.snapshot();
  return {
    phase: snap.phase,
    style: document.querySelector('[data-testid="battle-scene"]')?.getAttribute("data-battle-ui-style"),
    actors: snap.actors.map((a) => a.recordId),
    enemies: snap.enemies.map((e) => e.id),
  };
});
console.log("inject", inject);

// Wait out intro hold so sequenceBusy clears and command panel is live.
await page.waitForFunction(() => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  if (!scene) return false;
  return scene.getAttribute("data-battle-sequence-busy") !== "true"
    && scene.getAttribute("data-battle-director-step") === "command";
}, { timeout: 8_000 });
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUT, "00-idle-command.png") });

// Drive attack through the real UI so runActorCommand → sequencer → onActionMotion.
const attackStart = await page.evaluate(async () => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const before = {
    busy: scene?.getAttribute("data-battle-sequence-busy"),
    director: scene?.getAttribute("data-battle-director-step"),
    phase: window.__BEAT_RT__?.snapshot()?.phase,
  };
  const attackBtn = document.querySelector('[data-testid="actor-command-attack"]');
  if (attackBtn instanceof HTMLElement) attackBtn.click();
  await new Promise((r) => setTimeout(r, 180));
  let enemyBtn =
    document.querySelector(".battle-enemy[data-battle-targetable='true']")
    || document.querySelector(".battle-enemy[data-testid]")
    || document.querySelector(".battle-enemy");
  if (enemyBtn instanceof HTMLElement) enemyBtn.click();
  await new Promise((r) => setTimeout(r, 40));
  const snap = window.__BEAT_RT__?.snapshot?.();
  if (snap?.phase === "targetSelect" && snap.enemies?.[0]?.id) {
    const still = document.querySelector(".battle-enemy[data-battle-targetable='true']");
    if (still instanceof HTMLElement) still.click();
  }
  return {
    before,
    clickedAttack: Boolean(attackBtn),
    clickedEnemy: Boolean(enemyBtn),
    afterPhase: window.__BEAT_RT__?.snapshot()?.phase,
    afterBusy: scene?.getAttribute("data-battle-sequence-busy"),
    afterDirector: scene?.getAttribute("data-battle-director-step"),
  };
});
console.log("attackStart", attackStart);

// Poll motion classes across the approach window (~550ms acting).
const samples = [];
for (let t = 0; t < 14; t++) {
  await page.waitForTimeout(70);
  const sample = await page.evaluate(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const actors = [...document.querySelectorAll(".battle-actor-group .battle-actor")].map((n) => ({
      id: n.getAttribute("data-testid") || n.getAttribute("data-record-id"),
      classes: [...n.classList].filter((c) => c.startsWith("battle-motion-")),
      pose: n.getAttribute("data-battle-pose"),
      transform: getComputedStyle(n).transform,
    }));
    const enemies = [...document.querySelectorAll(".battle-enemy-group .battle-enemy")].map((n) => ({
      id: n.getAttribute("data-testid") || n.getAttribute("data-record-id"),
      classes: [...n.classList].filter((c) => c.startsWith("battle-motion-")),
      pose: n.getAttribute("data-battle-pose"),
      transform: getComputedStyle(n).transform,
    }));
    return {
      t: performance.now(),
      hitFeel: scene?.getAttribute("data-battle-hit-feel"),
      hitStop: scene?.classList.contains("battle-hit-stop"),
      busy: scene?.getAttribute("data-battle-sequence-busy"),
      director: scene?.getAttribute("data-battle-director-step"),
      popup: Boolean(document.querySelector('[data-testid="battle-damage-popup"]')),
      actors,
      enemies,
    };
  });
  samples.push(sample);
  const tag = String(t).padStart(2, "0");
  const hasLunge = sample.actors.some((a) => a.classes.includes("battle-motion-lunge"))
    || sample.enemies.some((e) => e.classes.includes("battle-motion-lunge"));
  const hasKnock = sample.actors.some((a) => a.classes.includes("battle-motion-knockback"))
    || sample.enemies.some((e) => e.classes.includes("battle-motion-knockback"));
  const hasReturn = sample.actors.some((a) => a.classes.includes("battle-motion-return"))
    || sample.enemies.some((e) => e.classes.includes("battle-motion-return"));
  if (hasLunge && !hasKnock) {
    await page.screenshot({ path: path.join(OUT, `${tag}-approach-lunge.png`) });
  } else if (hasKnock || sample.hitStop) {
    await page.screenshot({ path: path.join(OUT, `${tag}-impact-knockback.png`) });
  } else if (hasReturn) {
    await page.screenshot({ path: path.join(OUT, `${tag}-recover-return.png`) });
  } else if (t === 0 || t === 6 || t === 13) {
    await page.screenshot({ path: path.join(OUT, `${tag}-sample.png`) });
  }
}

const summary = {
  inject,
  attackStart,
  samples: samples.map((s) => ({
    hitFeel: s.hitFeel,
    hitStop: s.hitStop,
    busy: s.busy,
    director: s.director,
    popup: s.popup,
    actorMotion: s.actors.flatMap((a) => a.classes),
    enemyMotion: s.enemies.flatMap((e) => e.classes),
  })),
  sawLunge: samples.some((s) =>
    s.actors.some((a) => a.classes.includes("battle-motion-lunge"))
    || s.enemies.some((e) => e.classes.includes("battle-motion-lunge"))
  ),
  sawKnockback: samples.some((s) =>
    s.actors.some((a) => a.classes.includes("battle-motion-knockback"))
    || s.enemies.some((e) => e.classes.includes("battle-motion-knockback"))
  ),
  sawReturn: samples.some((s) =>
    s.actors.some((a) => a.classes.includes("battle-motion-return"))
    || s.enemies.some((e) => e.classes.includes("battle-motion-return"))
  ),
  sawHitStop: samples.some((s) => s.hitStop || s.hitFeel === "true"),
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "99-settle.png") });

await browser.close();

if (!summary.sawLunge) {
  console.error("FAIL: never observed battle-motion-lunge during attack");
  process.exit(1);
}
if (!summary.sawKnockback && !summary.sawHitStop) {
  console.error("FAIL: never observed knockback or hit-stop on connect");
  process.exit(1);
}
console.log("PASS: approach/impact motion classes observed");
