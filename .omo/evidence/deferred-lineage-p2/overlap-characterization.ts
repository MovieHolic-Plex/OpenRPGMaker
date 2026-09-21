import assert from "node:assert/strict";
import { mock } from "bun:test";

const root = process.argv[2] ?? process.cwd();
process.env.VITE_LEGACY_DB_URL = "http://dbserver:8100";
process.env.VITE_LEGACY_DB_ANON_KEY = "test-anon-key";
process.env.VITE_LEGACY_DB_PROJECT_ID = "audio-description-persistence";
process.env.VITE_LEGACY_DB_USE_PROXY = "0";
globalThis.fetch = (() => { throw new Error("Unexpected network"); }) as typeof fetch;
mock.module(`${root}/src/assets/legacyDbResourceCache.ts`, () => ({ cacheLegacyDbRootResources: async () => ({ skipped: [] }) }));
const { audioDescriptionProject, createAudioDescriptionTransport, AUDIO_PERSISTENCE_CONFIG } =
  await import(`${root}/test/helpers/audioDescriptionPersistenceTransport.ts`);
const { loadProjectFromLegacyDb } = await import(`${root}/src/project/legacyDbProjectSync.ts`);
const { store } = await import(`${root}/src/project/store.ts`);
const base = audioDescriptionProject(undefined);
base.meta.title = "PROJECT_A";
const remote = audioDescriptionProject({ music: { remote_only_A: "REMOTE_PROJECT_A" } }, base);
const transport = createAudioDescriptionTransport(remote, AbortSignal.timeout(30_000));
globalThis.fetch = transport.fetch;
store.replaceProject(structuredClone(base));
store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
store._setPersistedBaselineForTest(structuredClone(base));
store.updateMap(base.startMapId, map => { map.name = "A_EDIT"; });
const held = transport.holdNextPatch();
const commits = transport.waitForCommits(2);
const pending = store.flush();
await held.entered();
const replacement = audioDescriptionProject({ music: { replacement: "PROJECT_B_ONLY" } }, base);
replacement.meta.title = "PROJECT_B";
store.replaceProject(replacement);
try {
  assert.equal((await store.flush()).kind, "saved");
  assert.deepEqual(transport.accepted.map(project => project.meta.title), ["PROJECT_B"]);
} finally { held.release(); }
await pending;
await commits;
const loaded = await loadProjectFromLegacyDb(AUDIO_PERSISTENCE_CONFIG);
console.log(JSON.stringify({
  root, acceptedTitles: transport.accepted.map(project => project.meta.title),
  currentTitle: store.getCurrent().meta.title, remoteTitle: loaded?.meta.title,
  currentMapName: store.getCurrent().maps[base.startMapId]?.name,
  remoteMapName: loaded?.maps[base.startMapId]?.name,
  currentDescriptions: store.getCurrent().audioDescriptions,
  remoteDescriptions: loaded?.audioDescriptions,
  dirty: store.hasUnsavedChanges(), rejectedCas: transport.rejectedCas,
}, null, 2));
assert.equal(store.getCurrent().meta.title, "PROJECT_B");
assert.equal(store.hasUnsavedChanges(), false);
// Characterization only: this is not an approval of overlapping cross-lineage saves.
assert.deepEqual(transport.accepted.map(project => project.meta.title), ["PROJECT_B", "PROJECT_A"]);
assert.equal(loaded?.meta.title, "PROJECT_A");
process.exit(0);
