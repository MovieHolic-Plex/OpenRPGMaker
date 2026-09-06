import assert from "node:assert/strict";
import { createServer } from "vite";
import { Window } from "happy-dom";

const server = await createServer({
  configFile: false,
  cacheDir: ".omo/evidence/life-full-20260906/2/vite-cache",
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom",
});
const window = new Window();
const storage = window.localStorage;
try {
  const saves = await server.ssrLoadModule("/src/player/saveSlots.ts");
  const old = await server.ssrLoadModule("/test/fixtures/life-full/saveSlots.phase1.ts");
  const auto = await server.ssrLoadModule("/src/player/autosave.ts");
  const checkpoints = await server.ssrLoadModule("/src/player/checkpoints.ts");
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { startSession } = await server.ssrLoadModule("/src/project/session.ts");
  const { serialize, deserialize } = await server.ssrLoadModule("/src/project/io.ts");
  const project = deserialize(serialize(createBlankProject()));
  assert.equal(project.version, 4);
  const session = startSession(project, 205);
  session.gold = 27;
  const raw = JSON.stringify(old.createSaveSnapshot(project, session), null, 2) + "\n";
  const results = [];
  for (const namespace of [null, "runtime-qa:task2"]) {
    storage.clear();
    saves.setSaveSlotStorageNamespace(namespace);
    old.setSaveSlotStorageNamespace(namespace);
    storage.setItem(old.saveSlotKey(1), raw);
    storage.setItem(old.autosaveKey(), raw);
    const migrated = saves.readSaveSlot(storage, 1);
    assert.equal(migrated.kind, "present");
    assert.equal(migrated.snapshot.schemaVersion, 5);
    assert.equal(storage.length, 2);
    const resumed = saves.applySaveSnapshot(project, migrated.snapshot);
    assert.equal(resumed.gold, 27);
    resumed.gold = 81;
    const before = structuredClone(resumed);
    assert.equal(saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, resumed)).ok, true);
    assert.equal(auto.performAutosave(project, resumed, storage, "transfer").schemaVersion, 5);
    assert.deepEqual(resumed, before);
    assert.equal(saves.readSaveSlot(storage, 1).snapshot.session.gold, 81);
    assert.equal(saves.readAutosave(storage).snapshot.session.gold, 81);
    assert.equal(storage.getItem(old.saveSlotKey(1)), raw);
    assert.equal(storage.getItem(old.autosaveKey()), raw);
    // Feed exact new writer bytes through the real old storage reader in isolated storage.
    const oldWindow = new Window();
    try {
      oldWindow.localStorage.setItem(old.saveSlotKey(1), storage.getItem(saves.saveSlotKey(1)));
      assert.equal(old.readSaveSlot(oldWindow.localStorage, 1).kind, "corrupt");
    } finally { await oldWindow.happyDOM.close(); }
    for (const broken of ["", "{bad", '{"schemaVersion":6}']) {
      storage.setItem(saves.saveSlotKey(1), broken);
      storage.setItem(saves.autosaveKey(), broken);
      assert.equal(saves.readSaveSlot(storage, 1).kind, "corrupt");
      assert.equal(saves.readAutosave(storage).kind, "corrupt");
      assert.equal(storage.getItem(old.saveSlotKey(1)), raw);
    }
    const checkpoint = checkpoints.saveSessionCheckpoint(project, resumed);
    assert.equal(checkpoint.schemaVersion, 5);
    resumed.gold = 99;
    assert.equal(checkpoints.restoreSessionCheckpoint(project, resumed).gold, 81);
    assert.equal(resumed.gold, 99);
    // Actual unsupported clone input, no mocked writer/reconciler or successful-result injection.
    resumed.switches.invalid = () => true;
    const manualBefore = storage.getItem(saves.saveSlotKey(1));
    const autoBefore = storage.getItem(saves.autosaveKey());
    assert.throws(() => auto.performAutosave(project, resumed, storage, "transfer"), { name: "DataCloneError" });
    assert.throws(() => checkpoints.saveSessionCheckpoint(project, resumed), { name: "DataCloneError" });
    assert.equal(checkpoints.getSessionCheckpoint(resumed), checkpoint);
    assert.equal(storage.getItem(saves.saveSlotKey(1)), manualBefore);
    assert.equal(storage.getItem(saves.autosaveKey()), autoBefore);
    delete resumed.switches.invalid;
    assert.equal(auto.performAutosave(project, resumed, storage, "transfer").schemaVersion, 5);
    results.push({ namespace, manualKey: saves.saveSlotKey(1), autoKey: saves.autosaveKey(), migrated: 5, resumedGold: 81, legacyUnchanged: true, corruptFallback: false, constructionFailure: "DataCloneError", checkpoint: "memory-only Save5" });
  }
  console.log(JSON.stringify({ surface: "real Vite SSR public imports + happy-dom Storage (not player.html UI)", results }, null, 2));
} finally {
  storage.clear();
  await window.happyDOM.close();
  await server.close();
  console.log("Teardown: local test storage cleared; happy-dom windows and Vite SSR server closed; no HTTP listener or remote writes.");
}
