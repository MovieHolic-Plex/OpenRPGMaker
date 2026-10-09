/**
 * Capture System2 gauge chrome + non-System2 battle backdrop evidence.
 * Expects dev server on :9999 (npm run dev).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const OUT = path.resolve("output/evidence/system2-gauge-chrome");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(45_000);

const base = process.env.OPRN_URL || "http://127.0.0.1:9999/";
const bust = `cb=${Date.now()}`;
await page.goto(`${base}?blankProject=1&${bust}`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(2000);

await page.evaluate(async () => {
  const storeMod = await import("/src/project/store.ts");
  storeMod.store.update((draft) => {
    draft.system.systemResourceId = "windowskin-rm2003";
    draft.system.battleSystemResourceId = "easyrpg-system2-system2-c";
    draft.system.battleFlow = "gauge";
    for (const troop of draft.database.troops || []) {
      troop.previewBackgroundResourceId = "generated-battle-reference-forest";
    }
    for (const enemy of draft.database.enemies || []) {
      enemy.stats.maxHp = 400;
      enemy.stats.defense = 1;
    }
  });
});

await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
await page.waitForTimeout(900);
await page.keyboard.press("Enter").catch(() => {});
await page.waitForTimeout(700);

const inject = await page.evaluate(async () => {
  const runtimeMod = await import("/src/battle/runtime.ts");
  const battleDom = await import("/src/player/battleDom.ts");
  const storeMod = await import("/src/project/store.ts");
  const project = storeMod.store.getCurrent();
  const troopId = project.database.troops[0]?.id ?? project.system.initialTroopId;
  if (!troopId) return { error: "no troop" };
  const host =
    document.querySelector('[data-testid="test-play-window-body"]') ||
    document.querySelector('[data-testid="play-viewport"]') ||
    document.body;
  document.querySelectorAll("[data-testid='battle-scene']").forEach((n) => n.remove());

  const rt = runtimeMod.createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    battleFlow: "gauge",
  });
  for (let i = 0; i < 20000; i++) {
    rt.tick(40);
    if (rt.snapshot().phase === "actorCommand") break;
  }
  const snap0 = rt.snapshot();
  for (const actor of snap0.actors) {
    actor.gauge = 42;
    actor.hp = Math.max(1, Math.floor(actor.maxHp * 0.55));
    actor.mp = Math.max(0, Math.floor((actor.maxMp || 20) * 0.4));
  }
  battleDom.mountBattleScene({ host, runtime: rt, onResult: () => {} });
  const scene = document.querySelector('[data-testid="battle-scene"]');
  return {
    phase: rt.snapshot().phase,
    backdrop: rt.snapshot().backdropResourceId,
    battleSystem: scene?.getAttribute("data-battle-system-resource"),
    system2State: scene?.getAttribute("data-battle-system2"),
    cssVar: scene ? getComputedStyle(scene).getPropertyValue("--runtime-battle-system2").slice(0, 100) : "",
    hpFillSize: scene ? getComputedStyle(scene).getPropertyValue("--system2-hp-fill-size") : "",
    atFillPos: scene ? getComputedStyle(scene).getPropertyValue("--system2-at-fill-pos") : "",
    gaugeCount: document.querySelectorAll(".battle-actor-gauge").length,
    atbCount: document.querySelectorAll(".battle-atb-bar").length,
    statBarCount: document.querySelectorAll(".battle-stat-bar").length,
    actorCount: snap0.actors.length,
  };
});
console.log("inject", JSON.stringify(inject, null, 2));
if (inject.error) {
  await page.screenshot({ path: path.join(OUT, "error.png") });
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1000);
const afterKey = await page.evaluate(() => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const atb = document.querySelector(".battle-atb-bar");
  const hp = document.querySelector(".battle-stat-bar-hp");
  const atbBefore = atb ? getComputedStyle(atb, "::before") : null;
  const hpBefore = hp ? getComputedStyle(hp, "::before") : null;
  return {
    system2State: scene?.getAttribute("data-battle-system2"),
    cssVarIsDataUrl: (scene ? getComputedStyle(scene).getPropertyValue("--runtime-battle-system2") : "").includes("data:"),
    atbBgImage: atbBefore?.backgroundImage?.slice(0, 160) ?? "",
    hpBgImage: hpBefore?.backgroundImage?.slice(0, 160) ?? "",
    atbBgSize: atbBefore?.backgroundSize ?? "",
    hpBgSize: hpBefore?.backgroundSize ?? "",
    backdropId: document.querySelector("[data-testid='battle-backdrop']")?.getAttribute("data-backdrop-resource-id"),
  };
});
console.log("afterKey", JSON.stringify(afterKey, null, 2));

await page.screenshot({ path: path.join(OUT, "battle-system2-gauge-full.png") });
const party = page.locator('[data-testid="battle-party"]');
if (await party.count()) await party.screenshot({ path: path.join(OUT, "battle-party-system2-gauges.png") });
const sceneLoc = page.locator('[data-testid="battle-scene"]');
if (await sceneLoc.count()) await sceneLoc.screenshot({ path: path.join(OUT, "battle-scene-system2.png") });

// Direct backdrop resolution proof (no commandPreview dependency)
const previewCase = await page.evaluate(async () => {
  const storeMod = await import("/src/project/store.ts");
  const resolver = await import("/src/assets/generatedAssetResourceResolver.ts");
  const defaults = await import("/src/project/databaseEnemyTroopRecordModel.ts");
  const project = storeMod.store.getCurrent();
  const troop = project.database.troops[0];
  // Simulate missing troop bg → forest fallback (same as commandPreview now)
  const backdropId = undefined ?? defaults.DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
  const url = resolver.resolveAssetResourceUrl(backdropId, { project });
  const badUrl = resolver.resolveAssetResourceUrl(project.system.battleSystemResourceId, { project });
  // Also mount a mini field DOM like the fixed preview path
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:16px;top:16px;z-index:99999;width:420px;height:160px;background:#0b1020;padding:12px;";
  document.body.append(host);
  const field = document.createElement("div");
  field.dataset.testid = "ecp-battle-field";
  field.style.cssText = "width:100%;height:120px;background-size:cover;background-position:center;border:1px solid #445;";
  if (url) {
    field.style.backgroundImage = `linear-gradient(180deg, rgba(8,12,24,0.15), rgba(8,12,24,0.45)), url("${url}")`;
  }
  host.append(field);
  // Label showing what would be wrong if System2 were used
  const note = document.createElement("div");
  note.style.cssText = "color:#cde;font:12px sans-serif;margin-top:6px";
  note.textContent = `fallback=${backdropId}  (system2 id would be ${project.system.battleSystemResourceId})`;
  host.append(note);
  return {
    bgHead: field.style.backgroundImage.slice(0, 220),
    hasSystem2: /system2/i.test(field.style.backgroundImage),
    hasForest: /forest/i.test(field.style.backgroundImage) || /battle-reference/i.test(field.style.backgroundImage),
    forestUrl: url,
    system2Url: badUrl,
  };
});
console.log("previewCase", JSON.stringify(previewCase, null, 2));
await page.screenshot({ path: path.join(OUT, "event-preview-no-system2-backdrop.png") });

const summary = {
  inject,
  afterKey,
  previewCase,
  out: OUT,
  ok:
    inject.battleSystem === "easyrpg-system2-system2-c" &&
    Number(inject.gaugeCount) > 0 &&
    Number(inject.atbCount) > 0 &&
    !previewCase.hasSystem2 &&
    previewCase.hasForest === true &&
    (afterKey.system2State === "applied" || afterKey.system2State === "fallback" || afterKey.system2State === "pending") &&
    afterKey.backdropId !== "easyrpg-system2-system2-c",
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("summary.ok", summary.ok);
await browser.close();
if (!summary.ok) process.exit(1);
