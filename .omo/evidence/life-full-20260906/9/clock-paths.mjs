import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { Window } from "happy-dom";
const window = new Window();
const prior = new Map();
for (const key of ["window", "document", "Node", "HTMLElement", "HTMLButtonElement", "CustomEvent", "localStorage"]) {
  prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === "window" ? window : window[key] });
}
const root = new URL("./", import.meta.url);
const server = await createServer({ configFile: false, cacheDir: new URL("ssr-cache", root).pathname, resolve: { alias: [{ find: /^@\/project\/store$/, replacement: process.cwd() + "/src/player/exportProjectStoreShim.ts" }, { find: "@", replacement: process.cwd() + "/src" }] }, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom" });
const evidence = { surface: "Actual public clock/maker/save authorities and actual ledger DOM renderer in Happy DOM; not native player.html gameplay", mocks: ["camera render completion endpoint", "scene refresh/sync endpoints"], paths: [] };
try {
  const load = path => server.ssrLoadModule(path);
  const { createBlankProject } = await load("/src/project/defaults.ts");
  const { normalizeItemRecord } = await load("/src/project/databaseRecordModel.ts");
  const { startSession } = await load("/src/project/session.ts");
  const { setExportedProject } = await load("/src/player/exportProjectStoreShim.ts");
  const clock = await load("/src/player/playSceneTime.ts");
  const { createLifeLedgerDetail } = await load("/src/player/lifeLedger.ts");
  const { renderStatusMenuDetailPanel } = await load("/src/player/playerStatusMenuDetailRenderer.ts");
  const save = await load("/src/player/saveSlots.ts");
  const { collectMaker } = await load("/src/project/makers.ts");
  const { ITEM_QUANTITY_MAX } = await load("/src/project/itemQuantities.ts");
  const { runSceneTest } = await load("/src/testing/sceneTestRunner.ts");
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, minutesPerRealSecond: 1, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 40 };
  project.database.items.push(...["clock_input", "clock_output", "clock_bonus"].map(id => normalizeItemRecord({ id, name: id, scope: "none", price: 1 })));
  project.system.makers = [{ id: "clock_maker", inputs: [{ itemId: "clock_input", count: 3 }], outputs: [{ itemId: "clock_output", count: 2 }, { itemId: "clock_bonus", count: 1 }], durationMinutes: 30 }];
  setExportedProject(project);
  for (const path of ["natural", "command", "set-time", "sleep", "load"]) {
    const session = startSession(project, 409);
    // Minimal pre-action test input, never an injected processing/ready/payout result.
    session.inventory.clock_input = 3;
    if (path === "sleep") session.gameTime = { year: 1, season: "winter", day: 40, hour: 25, minute: 30 };
    const stage = document.createElement("div"); stage.className = "play-stage";
    const canvas = document.createElement("canvas"); stage.append(canvas); document.body.append(stage);
    const camera = new EventEmitter();
    camera.fadeOut = () => camera.emit("camerafadeoutcomplete");
    camera.fadeIn = () => camera.emit("camerafadeincomplete");
    const errors = [];
    const scene = { session, game: { canvas }, cameras: { main: camera }, timeFixedAccumulatorMs: 0, timeMinuteAccumulator: 0, timeSleepInProgress: false, clearRuntimeOverlay() {}, showRuntimeOverlay(id, message) { errors.push({ id, message }); }, refreshRuntimeSurfaces() {}, syncRuntimeState() {} };
    scene.sleepUntilMorning = () => clock.sleepUntilMorningScene(scene, async () => {});
    let mutation;
    const draw = () => {
      const before = structuredClone(session);
      const panel = renderStatusMenuDetailPanel(project, createLifeLedgerDetail({ project, session, tab: "makers", onMutation: (ok, message) => { mutation = { ok, message }; } }));
      assert.deepEqual(structuredClone(session), before, "ledger rendering is pure");
      stage.querySelector("section")?.remove(); stage.append(panel);
      return panel.querySelector('[data-testid="life-ledger-maker-clock_maker"]');
    };
    draw().click();
    assert.equal(mutation.ok, true);
    assert.equal(session.inventory.clock_input, undefined);
    const id = "ledger:clock_maker";
    assert.equal(session.makerInstances[id].status, "processing");
    const promise = structuredClone(session.makerInstances[id].contract);
    const beginning = structuredClone(session.gameTime);
    if (path === "natural") {
      clock.updateGameTime(scene, 29000);
      assert.equal(session.gameTime.minute, 29);
      assert.equal(session.makerInstances[id].status, "processing");
      draw();
      const menu = document.createElement("div"); menu.dataset.testid = "main-menu"; stage.append(menu);
      const paused = structuredClone(session); clock.updateGameTime(scene, 600000);
      assert.deepEqual(structuredClone(session), paused);
      menu.remove(); clock.updateGameTime(scene, 1000);
    }
    if (path === "command") {
      await clock.applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 29 });
      assert.equal(session.makerInstances[id].status, "processing");
      await clock.applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes: 1 });
    }
    if (path === "set-time") {
      clock.applySetTimeStep(scene, { kind: "setTime", hour: 6, minute: 29 });
      assert.equal(session.makerInstances[id].status, "processing");
      clock.applySetTimeStep(scene, { kind: "setTime", hour: 6, minute: 30 });
      clock.applySetTimeStep(scene, { kind: "setTime", hour: 6, minute: 0 });
    }
    if (path === "sleep") assert.equal(await scene.sleepUntilMorning(), true);
    let output = session;
    if (path === "load") {
      session.gameTime = { ...session.gameTime, minute: 30 }; // historical unsynchronized processing save
      const before = structuredClone(session);
      assert.equal(save.saveToSlot(window.localStorage, 1, save.createSaveSnapshot(project, session)).ok, true);
      assert.deepEqual(structuredClone(session), before);
      const read = save.readSaveSlot(window.localStorage, 1); assert.equal(read.kind, "present");
      output = save.applySaveSnapshot(project, read.snapshot);
    }
    assert.equal(output.makerInstances[id].status, "ready");
    assert.deepEqual(output.makerInstances[id].contract, promise);
    assert.equal(output.inventory.clock_output, undefined);
    output.inventory.clock_bonus = ITEM_QUANTITY_MAX;
    const full = structuredClone(output);
    assert.equal(collectMaker(project, output, id).ok, false);
    assert.deepEqual(structuredClone(output), full);
    delete output.inventory.clock_bonus;
    if (path === "load") assert.equal(collectMaker(project, output, id).ok, true);
    else { draw().click(); assert.equal(mutation.ok, true); }
    assert.equal(output.inventory.clock_output, 2); assert.equal(output.inventory.clock_bonus, 1);
    const paid = structuredClone(output);
    assert.equal(collectMaker(project, output, id).ok, false);
    assert.deepEqual(structuredClone(output), paid);
    assert.deepEqual(errors, []);
    evidence.paths.push({ path, beginning, ending: output.gameTime, promised: promise, readyBeforeCollection: true, output: output.inventory.clock_output, bonus: output.inventory.clock_bonus, fullInventoryAtomic: true, duplicateAtomic: true, ledgerStart: true, ledgerCollection: path !== "load" });
    stage.remove();
  }
  const runner = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps: [{ kind: "wait", ticks: 1875 }] });
  assert.equal(runner.ok, true); assert.equal(runner.session.gameTime.minute, 30);
  evidence.runner = { realRunSceneTest: true, time: runner.session.gameTime, makerJobJourney: false };
  evidence.ok = true;
} finally {
  window.localStorage.clear(); await window.happyDOM.close(); await server.close();
  for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  evidence.cleanup = { storageCleared: true, windowClosed: true, middlewareServerClosed: true, listenerCreated: false, remoteWrites: 0 };
  await writeFile(new URL("clock-paths.json", root), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
}
