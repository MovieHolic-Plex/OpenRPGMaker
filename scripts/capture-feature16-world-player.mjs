// Parent-owned full proof: real shipped player, keyboard casts/doors, read-only QA observations.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startPlayerQaServer, runRuntimeQa } from "./lib/runtimeQaRun.mjs";
import scenario, { prepareFeature16WorldFixture } from "./qa/runtime/feature16-world.scenario.mjs";
const out = "verify-shots/runtime-qa/feature16-world";
const server = await startPlayerQaServer();
let browser;
const receipts = [];
try {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const kind of ["melee", "dash", "trap", "projectile"]) {
    await prepareFeature16WorldFixture(kind);
    const page = await browser.newPage();
    const report = await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: `${out}/${kind}` });
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    assert.equal(report.beats.some((beat) => beat.failures.length), false, JSON.stringify(report.beats));
    await page.waitForFunction(() => window.__oprnHooksScene?.weatherLayer?.visible === true && !window.__oprnHooksScene.running);
    const globalWeather = await page.evaluate(() => window.__oprnHooksScene.session.m2Runtime.screen.weather);
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(() => window.__oprnHooksScene.facing === "up");
    await page.keyboard.up("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnHooksScene?.map.id === "map_feature16_indoor" && !window.__oprnHooksScene.running);
    await page.waitForFunction(() => window.__oprnHooksScene.weatherLayer.visible === false);
    assert.equal(await page.evaluate(() => window.__oprnHooksScene.session.m2Runtime.screen.weather), globalWeather);
    await page.screenshot({ path: `${out}/${kind}/indoor.png` });
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(() => window.__oprnHooksScene.facing === "up");
    await page.keyboard.up("ArrowUp"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnHooksScene?.map.id === "map_lantern_village" && !window.__oprnHooksScene.running);
    await page.waitForFunction(() => window.__oprnHooksScene.weatherLayer.visible === true && window.__oprnHooksScene.actionCombatState.enemies.size === 1);
    assert.equal(await page.evaluate(() => window.__oprnHooksScene.session.m2Runtime.screen.weather), globalWeather);
    // Two real steps restore the starting tile with right-facing (no state mutation hook).
    await page.keyboard.down("ArrowLeft");
    await page.waitForFunction(() => window.__oprnHooksScene.moving && window.__oprnHooksScene.movingTo.x === 1);
    await page.keyboard.up("ArrowLeft");
    await page.waitForFunction(() => !window.__oprnHooksScene.moving && window.__oprnHooksScene.tileX === 1);
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => window.__oprnHooksScene.moving && window.__oprnHooksScene.movingTo.x === 2);
    await page.keyboard.up("ArrowRight");
    await page.waitForFunction(() => !window.__oprnHooksScene.moving);
    const before = await page.evaluate(() => {
      const s = window.__oprnHooksScene;
      return { hp: [...s.actionCombatState.enemies.values()][0].hp, mp: s.session.actorVitals[s.session.partyActorIds[0]].mp };
    });
    await page.keyboard.press("q");
    await page.waitForFunction((hp) => [...window.__oprnHooksScene.actionCombatState.enemies.values()][0]?.hp < hp, before.hp);
    if (kind === "dash") await page.waitForFunction(() => !window.__oprnHooksScene.playerRoute && !window.__oprnHooksScene.moving);
    const after = await page.evaluate(() => {
      const s = window.__oprnHooksScene;
      return { hp: [...s.actionCombatState.enemies.values()][0].hp, mp: s.session.actorVitals[s.session.partyActorIds[0]].mp, x: s.tileX };
    });
    assert.equal(after.mp, before.mp - 2);
    if (kind === "dash") assert.equal(after.x, 3);
    await page.screenshot({ path: `${out}/${kind}/cast.png` });
    receipts.push({ kind, globalWeather, before, after });
    await page.close();
  }
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/proof.json`, JSON.stringify(receipts, null, 2));
  await writeFile(`${out}/SUMMARY.md`, "# Feature16 world\n\nReal player keyboard proof passed for melee/dash/trap/projectile and indoor/outdoor weather.\n\n즉시 확인: */indoor.png, */cast.png\n");
} finally { try { await browser?.close(); } finally { await server.close(); } }
