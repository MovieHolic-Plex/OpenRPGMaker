import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { firefox } from "@playwright/test";
import { performObservedAction } from "../../../../../scripts/lib/runtimeQaRun.mjs";
import { createServer } from "vite";

const out = `${process.cwd()}/.omo/evidence/life-full-20260906/11/receipt-correction/native`;
const cache = "/dev/shm/st_01a0786a-receipt-qa/native-cache";
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
const paidRows = Array.from({ length: 65 }, (_, i) => ({ itemId: `receipt-paid-${i}`, count: 1 }));
project.database.items.push(...paidRows.map(({itemId}) => ({ ...structuredClone(project.database.items[0]), id: itemId, name: itemId })));
Object.assign(project.session.inventory, Object.fromEntries(paidRows.map(({itemId}) => [itemId, 3])));
for (const [id, costs] of [["cumulative", [paidRows.slice(0,32), paidRows.slice(32)]], ["repeated", [paidRows.slice(0,64), paidRows.slice(0,1)]]]) {
  project.database.farmBuildingTypes.push({ id, name: id, levels: costs.map((items, i) => ({ level: i + 1, footprint: {width:1,height:1}, capacity:1, cost:{items}, graphicResourceId:"easyrpg-picture-cloud" })) });
}
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
  const vite = await createServer({ root: process.cwd(), configFile: `${process.cwd()}/vite.player-qa.config.ts`, configLoader: "runner", server: {port:39921, strictPort:true, host:"127.0.0.1"}, logLevel:"warn" });
  await vite.listen();
  server = { port:39921, url:"http://127.0.0.1:39921", close:() => vite.close() }; report.port = server.port;
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
    for (const [typeId, x] of [["cumulative",12],["repeated",14]]) {
      run(`build-${typeId}`, () => spatial.placeFarmBuilding(project, session, { ...input(typeId,x), typeId, y:8 }), true);
      run(`upgrade-${typeId}`, () => spatial.upgradeFarmBuilding(project, session, typeId), true);
    }
    check(session.farmBuildingPlacements.cumulative.paymentReceipt.items.length === 65, "lost cumulative rows");
    check(session.farmBuildingPlacements.repeated.paymentReceipt.items.length === 64 && session.farmBuildingPlacements.repeated.paymentReceipt.items[0].count === 2, "lost repeated payment");
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
    const before = structuredClone(session);
    check(before.farmBuildingPlacements.home1.paymentReceipt.gold === 30, "active paid gold evidence lost");
    check(before.farmBuildingPlacements.home1.paymentReceipt.items[0].count === 5, "active paid items evidence lost");
    const expected = structuredClone(before);
    delete expected.farmBuildingPlacements.home1;
    for (const [id, animal] of Object.entries(expected.farmAnimals)) {
      if (animal.housingPlacementId !== "home1") continue;
      const { housingPlacementId, ...unassigned } = animal;
      expected.farmAnimals[id] = unassigned;
    }
    const removed = removeFarmBuilding(session, "home1"); check(removed.ok, "demolition refused");
    actions.push({ name: "demolish", result: removed, before, after: structuredClone(session) });
    check(JSON.stringify(session) === JSON.stringify(expected), "demolition changed more than placement and housing links");
    check(session.lifeRecovery === undefined, "voluntary demolition created recovery clutter");
    check(session.gold === before.gold && JSON.stringify(session.inventory) === JSON.stringify(before.inventory), "voluntary demolition refunded costs");
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
    check(restored.lifeRecovery === undefined, "resume invented a demolition claim");
    check(JSON.stringify(restored.farmBuildingPlacements) === JSON.stringify(session.farmBuildingPlacements), "resume lost remaining active placement/payment evidence");
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
  report.receiptRecovery = await page.evaluate(async () => {
    const { store, setExportedProject } = await import("/src/player/exportProjectStoreShim.ts");
    const saves = await import("/src/player/saveSlots.ts");
    const recovery = await import("/src/project/lifeRecovery.ts");
    const { refreshRuntimeEntities } = await import("/src/player/playSceneMapRuntime.ts");
    const scene = window.__task11Game.scene.getScene("PlayScene");
    const check = (ok,label) => { if (!ok) throw new Error(label); };
    const session = scene.session, before = structuredClone(session);
    const compatible = saves.createSaveSnapshot(store.getCurrent(),session);
    const project = structuredClone(store.getCurrent());
    project.database.farmBuildingTypes = project.database.farmBuildingTypes.filter(type => type.id !== "cumulative");
    const restored = saves.applySaveSnapshot(project,compatible);
    check(JSON.stringify(session) === JSON.stringify(before), "content-change apply mutated original");
    setExportedProject(project); scene.session = restored;
    const claims = Object.values(restored.lifeRecovery.claims);
    check(JSON.stringify(claims.map(claim=>claim.items.length)) === "[64,1]", "65 did not split into two claims");
    check(claims.flatMap(claim=>claim.items).length === 65, "lost paid rows");
    for (const claim of claims) check(JSON.stringify(claim.unresolved.record) === JSON.stringify(before.farmBuildingPlacements.cumulative), "lost original payment evidence");
    check(JSON.stringify(restored.inventory) === JSON.stringify(before.inventory) && restored.gold === before.gold, "apply paid resources");
    const beforeSave = structuredClone(restored);
    const snapshot = saves.createSaveSnapshot(project, restored);
    check(saves.saveToSlot(localStorage,1,snapshot).ok,"claim save failed");
    const key = saves.saveSlotKey(1), claimsRaw = localStorage.getItem(key);
    const read = saves.readSaveSlot(localStorage,1); check(read.kind === "present","claim read failed");
    scene.session = saves.applySaveSnapshot(project,read.snapshot);
    check(JSON.stringify(scene.session.lifeRecovery) === JSON.stringify(beforeSave.lifeRecovery),"claim resume changed owners");
    check(JSON.stringify(restored) === JSON.stringify(beforeSave),"claim writer mutated state");
    const actions=[];
    for (const claim of claims) {
      const before = structuredClone(scene.session);
      const result = recovery.collectLifeRecoveryClaim(project,scene.session,claim.id);
      check(result.ok,"claim collection refused");
      const after=structuredClone(scene.session);
      const duplicate=recovery.collectLifeRecoveryClaim(project,scene.session,claim.id);
      check(!duplicate.ok && duplicate.reason === "missing-claim", "duplicate claim paid");
      check(JSON.stringify(scene.session) === JSON.stringify(after),"duplicate mutated entire session");
      actions.push({before,result,after,duplicate});
    }
    for (let i=0;i<65;i++) check(scene.session.inventory[`receipt-paid-${i}`] === before.inventory[`receipt-paid-${i}`]+1,`lost/gained item ${i}`);
    check(scene.session.gold === before.gold,"invented gold refund");
    check(Object.keys(scene.session.lifeRecovery.claims).length === 0 && scene.session.lifeRecovery.nextSequence === 3,"claims not consumed monotonically");
    const finalSnapshot=saves.createSaveSnapshot(project,scene.session);
    check(saves.saveToSlot(localStorage,1,finalSnapshot).ok,"final save failed");
    const finalRaw=localStorage.getItem(key);
    const invalidCases=[];
    for (const receipt of [
      {gold: Number.MAX_SAFE_INTEGER+1,items:[]},
      {gold:0,items:[{itemId:"receipt-paid-0",count:Number.MAX_SAFE_INTEGER+1}]},
      {gold:0,items:[{itemId:"receipt-paid-0",count:1},{itemId:"receipt-paid-0",count:1}]},
    ]) {
      const invalid=JSON.parse(finalRaw); invalid.session.farmBuildingPlacements.repeated.paymentReceipt=receipt;
      const raw=JSON.stringify(invalid); localStorage.setItem(key,raw);
      const live=structuredClone(scene.session);
      check(saves.readSaveSlot(localStorage,1).kind === "corrupt","unsafe receipt read accepted");
      let failure; try { saves.applySaveSnapshot(project,invalid); } catch(error) { if (!(error instanceof recovery.LifeReconciliationError)) throw error; failure={name:error.name,reason:error.reason}; }
      check(failure?.reason === "invalid-payment-receipt","unsafe receipt apply accepted");
      check(localStorage.getItem(key) === raw,"raw overwritten");
      check(JSON.stringify(scene.session) === JSON.stringify(live),"refused apply changed live scene");
      invalidCases.push({raw,failure,rawPreserved:true,entireStatePreserved:true});
    }
    localStorage.setItem(key,finalRaw);
    const finalRead=saves.readSaveSlot(localStorage,1);check(finalRead.kind === "present","final read");
    scene.session=saves.applySaveSnapshot(project,finalRead.snapshot);refreshRuntimeEntities(scene);
    check(Object.keys(scene.session.lifeRecovery.claims).length === 0,"resumed claims reissued");
    localStorage.removeItem(key);
    return {before,claims,claimsRaw,actions,finalRaw,invalidCases,final:structuredClone(scene.session),cleaned:localStorage.getItem(key)===null};
  });
  await page.screenshot({path:`${out}/cumulative-recovered.png`});
  assert.deepEqual(report.errors, []); assert.deepEqual(report.writes, []);
  report.pass = true;
} catch (error) { report.failure = String(error.stack ?? error); throw error; }
finally {
  await context?.close(); await browser?.close(); await server?.close(); await rm(cache, { recursive: true, force: true });
  report.cleanup = { contextClosed: true, browserClosed: true, serverClosed: true, ownedCacheRemoved: cache, fixtureNotShipped: true };
  await writeFile(`${out}/public-lifecycle.json`, JSON.stringify(report, null, 2) + "\n");
}
