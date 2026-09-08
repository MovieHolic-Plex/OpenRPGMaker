import assert from "node:assert/strict";
import { mock } from "bun:test";

const root = process.cwd();
process.env.VITE_SUPABASE_URL = "http://dbserver:8100";
process.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
process.env.VITE_SUPABASE_PROJECT_ID = "audio-description-persistence";
process.env.VITE_SUPABASE_USE_PROXY = "0";
process.env.VITE_EDIT_ACTIVITY_DISK_MIRROR = "0";
globalThis.fetch = (() => { throw new Error("Unexpected network"); }) as typeof fetch;
mock.module(`${root}/src/assets/supabaseResourceCache.ts`, () => ({ cacheSupabaseRootResources: async () => ({ skipped: [] }) }));
const { audioDescriptionProject, createAudioDescriptionTransport, AUDIO_PERSISTENCE_CONFIG } =
  await import(`${root}/test/helpers/audioDescriptionPersistenceTransport.ts`);
const { loadProjectFromSupabase } = await import(`${root}/src/project/supabaseProjectSync.ts`);
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
const pendingA = store.flush();
await held.entered();
const descriptions = { music: { replacement: "PROJECT_B_ONLY" } };
const replacement = audioDescriptionProject(descriptions, base);
replacement.meta.title = "PROJECT_B";
replacement.maps[base.startMapId]!.name = "PROJECT_B_MAP";
store.replaceProject(replacement);
const states: string[] = [];
const stop = store.subscribeAutoSave(state => { states.push(state.kind); });
const pendingB = store.flush();
try {
  assert.deepEqual(states, [], "B must wait before entering its own saving state");
  assert.deepEqual(transport.accepted, []);
  assert.equal(store.hasUnsavedChanges(), true);
} finally { held.release(); stop(); }
const [resultA, resultB] = await Promise.all([pendingA, pendingB]);
await commits;
const loaded = await loadProjectFromSupabase(AUDIO_PERSISTENCE_CONFIG);
assert.deepEqual(transport.accepted.map(project => project.meta.title), ["PROJECT_A", "PROJECT_B"]);
assert.equal(loaded?.meta.title, "PROJECT_B");
assert.equal(store.getCurrent().meta.title, "PROJECT_B");
assert.equal(loaded?.maps[base.startMapId]?.name, "PROJECT_B_MAP");
assert.equal(store.getCurrent().maps[base.startMapId]?.name, "PROJECT_B_MAP");
assert.deepEqual(loaded?.audioDescriptions, descriptions);
assert.deepEqual(store.getCurrent().audioDescriptions, descriptions);
assert.equal(transport.rejectedCas, 0);
assert.equal(store.hasUnsavedChanges(), false);
assert.equal(resultA.kind, "saved");
assert.equal(resultB.kind, "saved");
if (resultA.kind !== "saved" || !resultA.receipt || resultB.kind !== "saved" || !resultB.receipt) {
  throw new Error("Expected separate A and B accepted receipts");
}
assert.equal(store.isPersistenceReceiptCurrent(resultA.receipt), false);
assert.equal(store.isPersistenceReceiptCurrent(resultB.receipt), true);
console.log(JSON.stringify({ acceptedTitles: transport.accepted.map(project => project.meta.title),
  localTitle: store.getCurrent().meta.title, remoteTitle: loaded?.meta.title,
  localMapName: store.getCurrent().maps[base.startMapId]?.name,
  remoteMapName: loaded?.maps[base.startMapId]?.name,
  descriptions: loaded?.audioDescriptions, rejectedCas: transport.rejectedCas,
  dirty: store.hasUnsavedChanges(), receiptACurrent: false, receiptBCurrent: true }, null, 2));
