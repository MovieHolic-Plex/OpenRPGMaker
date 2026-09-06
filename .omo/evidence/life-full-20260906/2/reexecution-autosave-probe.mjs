import assert from "node:assert/strict";
import { createServer } from "vite";
import { Window } from "happy-dom";

const server = await createServer({
  configFile: false,
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom",
});
const window = new Window();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
try {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  const [saves, auto, checkpoints, defaults, sessions] = await Promise.all([
    "/src/player/saveSlots.ts", "/src/player/autosave.ts", "/src/player/checkpoints.ts",
    "/src/project/defaults.ts", "/src/project/session.ts",
  ].map(path => server.ssrLoadModule(path)));
  const project = defaults.createBlankProject();
  const session = sessions.startSession(project, 205);
  const storage = window.localStorage;
  for (const namespace of [null, "task2:reexecution"]) {
    storage.clear();
    auto.resetAutosaveDebounce();
    saves.setSaveSlotStorageNamespace(namespace);
    session.gold = 17;
    const legacyKey = `${namespace ?? "oprn"}:save-slot:auto`;
    const legacyRaw = JSON.stringify({ ...saves.createSaveSnapshot(project, session), schemaVersion: 4 }, null, 2) + "\n";
    storage.setItem(legacyKey, legacyRaw);
    assert.equal(auto.maybeAutosave(project, session, "transfer", 10_000), true);
    const priorDisk = storage.getItem(saves.autosaveKey());
    const checkpoint = checkpoints.saveSessionCheckpoint(project, session);
    session.gold = 99;
    session.lifeRecovery = { nextSequence: 0, claims: {} };
    const invalidLive = structuredClone(session);
    assert.equal(auto.maybeAutosave(project, session, "transfer", 20_000), false);
    assert.throws(() => checkpoints.saveSessionCheckpoint(project, session), { name: "LifeReconciliationError" });
    assert.equal(checkpoints.getSessionCheckpoint(session), checkpoint);
    assert.deepEqual(session, invalidLive);
    assert.equal(storage.getItem(saves.autosaveKey()), priorDisk);
    assert.equal(storage.getItem(legacyKey), legacyRaw);
    delete session.lifeRecovery;
    session.switches.uncloneable = () => true;
    const invalidFunction = session.switches.uncloneable;
    assert.throws(() => auto.maybeAutosave(project, session, "transfer", 20_000), { name: "DataCloneError" });
    assert.equal(session.switches.uncloneable, invalidFunction);
    assert.equal(storage.getItem(saves.autosaveKey()), priorDisk);
    delete session.switches.uncloneable;
    assert.equal(auto.maybeAutosave(project, session, "transfer", 20_000), true);
    assert.equal(saves.readAutosave(storage).snapshot.session.gold, 99);
    assert.equal(storage.getItem(legacyKey), legacyRaw);
    console.log(JSON.stringify({ namespace, reconciliationFailure: false, constructionFailure: "DataCloneError", sameTimeRetry: true, resumedGold: 99, legacyBytesPreserved: true, priorCheckpointPreserved: true }));
  }
  auto.resetAutosaveDebounce();
  saves.setSaveSlotStorageNamespace(null);
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
  window.localStorage.clear();
  await window.happyDOM.close();
  await server.close();
  console.log("Teardown: global Storage restored; local Storage cleared; window and middleware Vite closed.");
}

// Boundary fixtures only; no mock of the codec, reconciler, native clone, or autosave.
// This probe does not claim a player.html journey or earned gameplay outcomes.
