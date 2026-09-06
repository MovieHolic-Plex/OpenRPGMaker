import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { firefox } from "@playwright/test";
import { startPlayerQaServer, performObservedAction } from "../../../../scripts/lib/runtimeQaRun.mjs";

const out = `${process.cwd()}/.omo/evidence/life-full-20260906/11/native`;
const cache = `${out}/cache`;
await mkdir(out, { recursive: true });
process.env.VITE_CACHE_DIR = cache;
const project = JSON.parse(await readFile(".omo/evidence/life-full-20260906/5/project.json", "utf8"));
project.meta.title = "Task11 local engine housing probe";
project.session.inventory = { item_potion: 20 };
project.session.gold = 40;
project.session.placeables = {}; project.session.chests = {};
project.session.farmAnimals = ["a", "b", "c", "d", "e", "f"].map(instanceId => ({ instanceId, speciesId: "chicken", name: instanceId }));
project.session.farmAnimals.push({ instanceId: "cow", speciesId: "cow", name: "Cow" });
project.database.farmAnimalSpecies = ["chicken", "cow"].map(id => ({ id, name: id, feedItemId: "item_potion", productItemId: "item_ether", productCount: 1, productEveryDays: 1, petFriendship: 10 }));
project.system.farmAnimalBuildings = [];
project.database.farmBuildingTypes = [{ id: "shed", name: "Explicit linked shed", animalHousing: { allowedSpeciesIds: ["chicken"] }, levels: [
  { level: 1, footprint: { width: 1, height: 1 }, capacity: 99, animalCapacity: 2, cost: { gold: 10, items: [{ itemId: "item_potion", count: 2 }] }, graphicResourceId: "easyrpg-picture-cloud" },
  { level: 2, footprint: { width: 2, height: 1 }, capacity: 99, animalCapacity: 5, cost: { gold: 20, items: [{ itemId: "item_potion", count: 3 }] }, graphicResourceId: "easyrpg-picture-cloud" },
] }];
project.system.timeSystem = { enabled: true, minutesPerRealSecond: 0.001, dayStartHour: 12, dayEndHour: 26, daysPerSeason: 28 };
const map = project.maps[project.startMapId];
map.farmableArea = [];
map.events = [{ id: "sleep", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [{
  id: "sleep-page", name: "Sleep", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" },
  priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
  commands: [{ kind: "sleepUntilMorning" }, { kind: "setSwitch", switchId: "sw_0001", value: true }],
}] }];
const wire = JSON.stringify(project);
const report = { cwd: process.cwd(), head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  diffSha256: createHash("sha256").update(execFileSync("git", ["diff"])).digest("hex"),
  fixtureSha256: createHash("sha256").update(wire).digest("hex"),
  surface: "Native Firefox player.html/exportProjectStoreShim. Public imported transactions on the actual PlayScene session; native Z sleep. Local fixture GET substituted; no action endpoints mocked, no ready state injected.", errors: [], writes: [] };
let server, browser, context;
async function signal(page, kind, trigger = async () => {}) {
  const pending = await page.evaluateHandle(kind => {
    let cancel;
    const promise = new Promise(resolve => {
      const finish = value => { observer.disconnect(); clearTimeout(timer); resolve(value); };
      const check = () => {
        const mirror = document.querySelector('[data-testid="runtime-state-json"]');
        const state = mirror ? JSON.parse(mirror.textContent) : undefined;
        const ready = kind === "title" ? document.querySelector('[data-testid="title-screen"]')
          : kind === "ready" ? mirror && !document.querySelector('[data-testid="play-loading-overlay"]')
          : state?.gameTime?.day === 2 && state.switches?.sw_0001 === true && state.running === false;
        if (ready) finish({ ok: true });
      };
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => finish({ error: `Missing ${kind}` }), 120000);
      cancel = () => finish({ error: "cancelled" });
      observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true }); check();
    });
    return { promise, cancel: () => cancel() };
  }, kind);
  try { await trigger(); assert.equal((await pending.evaluate(x => x.promise)).error, undefined); }
  finally { await pending.evaluate(x => x.cancel()); await pending.dispose(); }
}
try {
  server = await startPlayerQaServer(); report.port = server.port;
  browser = await firefox.launch({ headless: true }); report.browser = browser.version();
  context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request();
    if (new URL(request.url()).pathname === "/__task11/project.json") return route.fulfill({ status: 200, contentType: "application/json", body: wire });
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { report.writes.push({ url: request.url(), method: request.method() }); return route.abort(); }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__task11/project.json", saveNamespace: "task11-local-proof", qaInstrumentation: true };
    // Test-owned handle only: construct the real Phaser Game unchanged, recording its instance.
    let phaser;
    Object.defineProperty(window, "Phaser", { configurable: true, get: () => phaser, set: value => {
      phaser = value;
      value.Game = new Proxy(value.Game, { construct(target, args, newTarget) {
        const game = Reflect.construct(target, args, newTarget);
        window.__task11Game = game;
        return game;
      } });
    } });
  });
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await signal(page, "title"); await signal(page, "ready", () => page.keyboard.press("Enter"));
  assert.equal(await page.getByTestId("toolbar-database").count(), 0);
  report.beforeSleep = await page.evaluate(async () => {
    const { store } = await import("/src/player/exportProjectStoreShim.ts");
    const spatial = await import("/src/project/spatialPlacementTransactions.ts");
    const animals = await import("/src/project/farmAnimals.ts");
    const { resolveAnimalHome } = await import("/src/project/animalHousing.ts");
    const { refreshRuntimeEntities } = await import("/src/player/playSceneMapRuntime.ts");
    const scene = window.__task11Game?.scene.getScene("PlayScene");
    if (!scene) throw new Error("No actual PlayScene");
    const project = store.getCurrent(), session = scene.session, actions = [];
    const check = (condition, label) => { if (!condition) throw new Error(label); };
    const run = (name, action, ok, reason) => {
      const before = structuredClone(session), result = action(), after = structuredClone(session);
      check(result.ok === ok && (!reason || result.reason === reason), `${name}: ${JSON.stringify(result)}`);
      if (!ok) check(JSON.stringify(before) === JSON.stringify(after), `${name} mutated state`);
      actions.push({ name, result, before, after });
    };
    const input = (instanceId, x) => ({ instanceId, typeId: "shed", mapId: project.startMapId, x, y: 5, orientation: "down" });
    run("build-home1", () => spatial.placeFarmBuilding(project, session, input("home1", 5)), true);
    run("build-home2", () => spatial.placeFarmBuilding(project, session, input("home2", 9)), true);
    for (const id of ["a", "b"]) run(`assign-${id}`, () => animals.assignFarmAnimalToHousingPlacement(project, session, id, "home1"), true);
    run("assign-c-home2", () => animals.assignFarmAnimalToHousingPlacement(project, session, "c", "home2"), true);
    run("full", () => animals.assignFarmAnimalToHousingPlacement(project, session, "d", "home1"), false, "building-full");
    run("wrong-species", () => animals.assignFarmAnimalToHousingPlacement(project, session, "cow", "home1"), false, "species-not-allowed");
    run("collision", () => spatial.moveFarmBuilding(project, session, "home1", project.startMapId, 9, 5), false, "blocked");
    run("upgrade-2-to-5", () => spatial.upgradeFarmBuilding(project, session, "home1"), true);
    run("cost-refusal", () => spatial.placeFarmBuilding(project, session, input("unpaid", 12)), false, "insufficient");
    run("assign-d", () => animals.assignFarmAnimalToHousingPlacement(project, session, "d", "home1"), true);
    run("feed", () => animals.feedFarmAnimal(project, session, "a", "1:spring:1"), true);
    run("pet", () => animals.petFarmAnimal(project, session, "a", "1:spring:1"), true);
    run("reassign-same", () => animals.assignFarmAnimalToHousingPlacement(project, session, "a", "home1"), true);
    run("duplicate-feed", () => animals.feedFarmAnimal(project, session, "a", "1:spring:1"), false, "already-fed");
    const beforeMove = JSON.stringify(session.farmAnimals);
    run("move-identity", () => spatial.moveFarmBuilding(project, session, "home1", project.startMapId, 5, 8), true);
    check(JSON.stringify(session.farmAnimals) === beforeMove, "move lost animal identity");
    check(resolveAnimalHome(project, session, session.farmAnimals.a).y === 8, "derived home did not move");
    check(session.farmAnimals.a.readyProductCount === 0, "product appeared without day progression");
    refreshRuntimeEntities(scene);
    return { actions, state: structuredClone(session) };
  });
  await signal(page, "day2", async () => { report.nativeSleep = await performObservedAction(page, () => page.keyboard.press("z")); });
  report.afterSleep = await page.evaluate(() => window.__oprnDebug.readState());
  await page.screenshot({ path: `${out}/earned-product.png` });
  report.lifecycle = await page.evaluate(async () => {
    const { store } = await import("/src/player/exportProjectStoreShim.ts");
    const { removeFarmBuilding } = await import("/src/project/spatialPlacementTransactions.ts");
    const animals = await import("/src/project/farmAnimals.ts");
    const saves = await import("/src/player/saveSlots.ts");
    const { refreshRuntimeEntities } = await import("/src/player/playSceneMapRuntime.ts");
    const scene = window.__task11Game?.scene.getScene("PlayScene");
    const project = store.getCurrent(), session = scene.session, actions = [];
    const check = (condition, label) => { if (!condition) throw new Error(label); };
    check(session.farmAnimals.a.readyProductCount === 1 && session.farmAnimals.a.lastAdvancedDayKey === "1:spring:1", "native sleep did not produce");
    const animal = structuredClone(session.farmAnimals.a);
    const before = structuredClone(session);
    const removed = removeFarmBuilding(session, "home1"); check(removed.ok, "demolition refused");
    actions.push({ name: "demolish", result: removed, before, after: structuredClone(session) });
    const { housingPlacementId, ...unassigned } = animal;
    check(JSON.stringify(session.farmAnimals.a) === JSON.stringify(unassigned), "demolition changed progression");
    const rejectedBefore = structuredClone(session);
    const rejected = animals.feedFarmAnimal(project, session, "a", "1:spring:2");
    check(!rejected.ok && rejected.reason === "unassigned", "unassigned care succeeded");
    check(JSON.stringify(session) === JSON.stringify(rejectedBefore), "rejected care mutated state");
    actions.push({ name: "unassigned-care", result: rejected, before: rejectedBefore, after: structuredClone(session) });
    const collection = animals.collectFarmAnimalProduct(project, session, "a"); check(collection.ok && collection.count === 1, "unassigned product lost");
    actions.push({ name: "unassigned-collection", result: collection, after: structuredClone(session) });
    const beforeSave = structuredClone(session);
    const snapshot = saves.createSaveSnapshot(project, session);
    check(snapshot.schemaVersion === 5, "save version");
    check(saves.saveToSlot(localStorage, 1, snapshot).ok, "native Storage write failed");
    const read = saves.readSaveSlot(localStorage, 1); check(read.kind === "present", "native Storage read failed");
    const restored = saves.applySaveSnapshot(project, read.snapshot);
    check(JSON.stringify(restored.farmAnimals) === JSON.stringify(session.farmAnimals), "resume changed animals");
    check(JSON.stringify(restored.lifeRecovery) === JSON.stringify(session.lifeRecovery), "resume lost paid evidence");
    check(JSON.stringify(session) === JSON.stringify(beforeSave), "save mutated live state");
    scene.session = restored; refreshRuntimeEntities(scene);
    const key = saves.saveSlotKey(1), goodRaw = localStorage.getItem(key);
    const invalid = JSON.parse(goodRaw); Object.assign(invalid.session.farmAnimals.a, { buildingId: "legacy", housingPlacementId: "removed-home" });
    const invalidRaw = JSON.stringify(invalid); localStorage.setItem(key, invalidRaw);
    check(saves.readSaveSlot(localStorage, 1).kind === "corrupt", "dual refs accepted");
    check(localStorage.getItem(key) === invalidRaw, "invalid raw overwritten");
    let refused = false; try { saves.applySaveSnapshot(project, invalid); } catch { refused = true; }
    check(refused, "invalid apply accepted");
    check(JSON.stringify(scene.session) === JSON.stringify(restored), "failed load changed live scene");
    localStorage.removeItem(key);
    return { actions, restored, save: { schemaVersion: snapshot.schemaVersion, key, goodRaw, invalidRaw, corruptRead: true, failedApply: refused, cleaned: localStorage.getItem(key) === null } };
  });
  await page.screenshot({ path: `${out}/resumed-unassigned.png` });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.writes, []);
  report.pass = true;
} catch (error) { report.failure = String(error.stack ?? error); throw error; }
finally {
  await context?.close(); await browser?.close(); await server?.close(); await rm(cache, { recursive: true, force: true });
  report.cleanup = { contextClosed: true, browserClosed: true, serverClosed: true, ownedCacheRemoved: cache, fixtureNotShipped: true };
  await writeFile(`${out}/public-lifecycle.json`, JSON.stringify(report, null, 2) + "\n");
}
