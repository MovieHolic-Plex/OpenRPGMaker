import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { firefox } from "@playwright/test";
import { startPlayerQaServer, performObservedAction } from "../../../../../scripts/lib/runtimeQaRun.mjs";
const root = process.cwd(), out = `${root}/.omo/evidence/life-full-20260906/10/date-fix/native-neutral`;
const cache = `${out}/player-cache`;
await mkdir(out, { recursive: true });
process.env.VITE_CACHE_DIR = cache;
const source = await readFile(`${root}/.omo/evidence/life-full-20260906/5/project.json`, "utf8");
const base = JSON.parse(source);
const sha = value => createHash("sha256").update(value).digest("hex");
const report = { cwd: root, head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDiffSha256: sha(execFileSync("git", ["diff"], { encoding: "utf8" })), baseFixtureSha256: sha(source),
  port: 35433, surface: "native Firefox dedicated player.html / exportProjectStoreShim", runs: [], writes: [] };
report.sourceFiles = {};
for (const path of ["src/player/lifeFieldInteraction.ts", "src/player/playSceneMovement.ts", "src/player/playScenePlaceables.ts", "src/player/playSceneMapRuntime.ts", "src/project/fishing.ts", "src/project/seasonalForage.ts", "src/testing/sceneTestRunner.ts"]) report.sourceFiles[path] = sha(await readFile(`${root}/${path}`));
let browser, server;
async function signal(page, kind, trigger = async () => {}) {
  const pending = await page.evaluateHandle(kind => {
    let cancel;
    const promise = new Promise(resolve => {
      const finish = value => { observer.disconnect(); clearTimeout(timer); resolve(value); };
      const check = () => {
        const mirror = document.querySelector('[data-testid="runtime-state-json"]');
        const state = mirror ? JSON.parse(mirror.textContent) : undefined;
        const ok = kind === "title" ? document.querySelector('[data-testid="title-screen"]')
          : kind === "ready" ? mirror && !document.querySelector('[data-testid="play-loading-overlay"]')
          : kind === "day2" ? state?.gameTime?.day === 2 && state.switches?.sw_0001 === true && state.running === false
          : kind === "feedback" ? document.querySelector('[data-testid="zone-feedback-toast"]')?.textContent.length > 0 : false;
        if (ok) finish({ ok: true });
      };
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => finish({ error: `Missing ${kind} signal` }), 120000);
      cancel = () => finish({ error: "cancelled" });
      observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true }); check();
    });
    return { promise, cancel: () => cancel() };
  }, kind);
  try { await trigger(); const result = await pending.evaluate(x => x.promise); assert.equal(result.error, undefined); }
  finally { await pending.evaluate(x => x.cancel()); await pending.dispose(); }
}
const readState = page => page.evaluate(() => window.__oprnDebug.readState());
const withoutReceipt = ({ actionReceipt, ...rest }) => rest;
try {
  server = await startPlayerQaServer({ port: 35433 });
  browser = await firefox.launch({ headless: true }); report.browser = browser.version();
  for (const name of ["catch-energy-refusal", "authored-tool-refusal", "date-forage"]) {
    const project = structuredClone(base), map = project.maps[project.startMapId];
    project.meta.title = `Task10 contract: ${name}`;
    project.session.inventory = {}; project.session.placeables = {}; project.session.chests = {};
    map.events = []; map.farmableArea = []; map.actionCombat = true;
    project.system.actionCombat = { enabled: true, staminaEnabled: true };
    project.system.energy = { max: 3, initial: 3, restorePerDay: 0 };
    project.system.skillSystem = { enabled: false };
    delete project.system.timeSystem;
    const template = project.database.items.find(item => item.id === "qa-hoe"); assert.ok(template);
    for (const [id, label] of [["task10-fish", "Field Trout"], ["task10-berry", "Meadow Berry"]]) {
      const item = { ...template, id, name: label }; delete item.farmTool;
      project.database.items.push(item);
    }
    project.database.fishSpecies = [{ id: "trout", name: "Trout", itemId: "task10-fish", skillXp: 1 }];
    project.system.collections = { enabled: true, trackedItemIds: ["task10-fish", "task10-berry"] };
    project.system.fishing = { enabled: true, energyCost: 3, spots: [{ id: "pond", mapId: map.id,
      area: { x: 2, y: 3, w: 1, h: 1 }, catches: [{ fishId: "trout", weight: 1 }] }] };
    project.system.toolActions = name === "authored-tool-refusal" ? [{ id: "rod", action: "fish", itemId: "qa-hoe" }] : [];
    project.system.seasonalForage = { enabled: true, areas: [{ id: "meadow", mapId: map.id,
      area: { x: 2, y: 3, w: 1, h: 1 }, dailySpawnCount: 1, maxActive: 1, despawnAfterDays: 2,
      entries: [{ id: "berry", itemId: "task10-berry", weight: 1 }] }] };
    if (name === "date-forage") {
      project.system.fishing.spots = [];
      project.system.timeSystem = { enabled: true, minutesPerRealSecond: 0.001, dayStartHour: 12, dayEndHour: 26, daysPerSeason: 28 };
      map.events = [{ id: "sleep", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [{
        id: "sleep-page", name: "Sleep", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" },
        priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "sleepUntilMorning" }, { kind: "setSwitch", switchId: "sw_0001", value: true }],
      }] }];
    }
    const wire = JSON.stringify(project), run = { name, fixtureSha256: sha(wire), actions: [], errors: [], requestFailures: [] };
    report.runs.push(run);
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
    const page = await context.newPage();
    page.on("pageerror", error => run.errors.push(error.message));
    page.on("requestfailed", request => run.requestFailures.push({ url: request.url(), failure: request.failure() }));
    await page.route("**/*", route => {
      const request = route.request();
      if (new URL(request.url()).pathname === "/__task10/project.json") return route.fulfill({ status: 200, contentType: "application/json", body: wire });
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { report.writes.push({ url: request.url(), method: request.method() }); return route.abort(); }
      return route.continue();
    });
    await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: "/__task10/project.json", saveNamespace: "task10-local-proof", qaInstrumentation: true }; });
    try {
      await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
      await signal(page, "title"); await signal(page, "ready", () => page.keyboard.press("Enter"));
      assert.equal(await page.getByTestId("toolbar-database").count(), 0);
      run.initial = await readState(page); assert.equal(run.initial.x, 2); assert.equal(run.initial.y, 2);
      assert.equal(run.initial.inventory["task10-fish"], undefined); assert.equal(run.initial.inventory["task10-berry"], undefined);
      if (name === "date-forage") {
        await signal(page, "day2", async () => run.actions.push(await performObservedAction(page, () => page.keyboard.press("z"))));
        run.generated = await readState(page); assert.equal(run.generated.gameTime.day, 2);
        await page.screenshot({ path: `${out}/forage-generated.png` });
        const picked = await performObservedAction(page, () => page.keyboard.press("z")); run.actions.push(picked);
        assert.equal(picked.receipt.handled, true); assert.equal(picked.state.inventory["task10-berry"], 1);
        assert.equal(picked.state.inventory["task10-fish"], undefined); assert.deepEqual(picked.state.rng, run.generated.rng);
        await page.screenshot({ path: `${out}/forage-picked.png` });
      } else {
        const action = await performObservedAction(page, () => page.keyboard.press("z")); run.actions.push(action);
        assert.equal(action.receipt.handled, true); assert.deepEqual(action.receipt.farmAttempts, []);
        if (name === "catch-energy-refusal") {
          assert.equal(action.state.inventory["task10-fish"], 1); assert.equal(action.state.energy, 0);
          assert.notDeepEqual(action.state.rng, run.initial.rng);
          await page.screenshot({ path: `${out}/fish-caught.png` });
          await signal(page, "feedback", async () => run.actions.push(await performObservedAction(page, () => page.keyboard.press("z"))));
          const refusal = run.actions[1]; assert.equal(refusal.receipt.handled, true);
          assert.deepEqual(withoutReceipt(refusal.state), withoutReceipt(action.state));
        } else {
          assert.deepEqual(withoutReceipt(action.state), withoutReceipt(run.initial));
          await signal(page, "feedback");
        }
        await page.screenshot({ path: `${out}/${name}.png` });
      }
      run.final = await readState(page);
      run.combat = await page.evaluate(() => window.__oprnActionCombat());
      run.audioObserved = await page.evaluate(() => window.__oprnAudioObserved);
      assert.ok(run.combat); assert.equal(run.combat.swingCooldownMs, 0);
      assert.equal(run.audioObserved.includes("easyrpg-sound-attack1"), false);
      assert.deepEqual(run.errors, []); assert.deepEqual(run.requestFailures, []);
      run.pass = true;
    } catch (error) {
      run.failure = String(error.stack ?? error); run.html = await page.content();
      await page.screenshot({ path: `${out}/${name}-failure.png` }); throw error;
    } finally { await context.close(); run.contextClosed = true; }
  }
  assert.deepEqual(report.writes, []); report.pass = true;
} finally {
  await browser?.close(); await server?.close(); await rm(cache, { recursive: true, force: true });
  report.cleanup = { browserClosed: true, contextsClosed: report.runs.every(run => run.contextClosed), serverClosed: true, ownedCacheRemoved: cache };
  await writeFile(`${out}/player.json`, JSON.stringify(report, null, 2) + "\n");
}
