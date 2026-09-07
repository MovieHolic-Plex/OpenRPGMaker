import assert from "node:assert/strict";
import { mock } from "bun:test";

const root = process.cwd();
process.env.VITE_SUPABASE_URL = "https://deferred-replay.invalid";
process.env.VITE_SUPABASE_ANON_KEY = "test-only";
process.env.VITE_SUPABASE_PROJECT_ID = "deferred-replay";
process.env.VITE_SUPABASE_USE_PROXY = "0";
process.env.VITE_EDIT_ACTIVITY_DISK_MIRROR = "0";
globalThis.fetch = (() => { throw new Error("Unexpected network"); }) as typeof fetch;
const { createBlankProject } = await import(`${root}/src/project/defaults.ts`);
const { serialize, deserialize } = await import(`${root}/src/project/io.ts`);
type Project = ReturnType<typeof createBlankProject>;
const sync = await import(`${root}/src/project/supabaseProjectSync.ts`);
let wire = serialize(createBlankProject());
const writes: string[] = [];
const save = async (project: Project) => {
  writes.push(project.meta.title);
  wire = serialize(project);
  return { kind: "saved", project: deserialize(wire) };
};
mock.module(`${root}/src/project/supabaseProjectSync.ts`, () => ({ ...sync,
  loadProjectFromSupabase: async () => deserialize(wire),
  recordProjectCommitToSupabase: async () => ({ kind: "saved", commitId: "local-deferred-replay" }),
  saveProjectToSupabase: save,
  saveProjectMapPatchToSupabase: async ({ project }: { project: Project }) => save(project),
}));
mock.module(`${root}/src/assets/supabaseResourceCache.ts`, () => ({ cacheSupabaseRootResources: async () => ({ skipped: [] }) }));
let nextTimer = 0;
const timers = new Map<number, { callback: () => void; ms: number }>();
globalThis.setTimeout = ((callback: () => void, ms: number) => {
  const handle = ++nextTimer;
  timers.set(handle, { callback, ms });
  return handle;
}) as unknown as typeof globalThis.setTimeout;
globalThis.clearTimeout = ((handle: number) => { timers.delete(handle); }) as typeof globalThis.clearTimeout;
const latestAutoSave = () => {
  const timer = [...timers].filter(([, timer]) => timer.ms === 4000).at(-1);
  assert.ok(timer, "Migration/edit must register its real autosave callback");
  return timer;
};
const { store } = await import(`${root}/src/project/store.ts`);
await store.load();
await store.flush();
writes.length = 0;
const clean = structuredClone(store.getCurrent());
clean.meta.title = "Clean replacement B";
const legacy = structuredClone(clean);
legacy.meta.title = "Migrating project A";
legacy.tilesets.easyrpg_chipset_interior.structureKits = [{
  id: "cabinet", kind: "section", name: "캐비닛", width: 1, height: 2,
  rows: [{ tiles: [148] }, { tiles: [178] }], learnedFrom: "interior-catalog",
  ai: { description: "", placementRules: "", snap: "wall-north", themes: ["bedroom", "dining"] },
}];
wire = serialize(legacy);
assert.equal((await store.reloadFromRemote({ force: true })).kind, "reloaded");
assert.equal(store.hasUnsavedChanges(), true);
const [, obsolete] = latestAutoSave();
wire = serialize(clean);
assert.equal((await store.reloadFromRemote({ force: true })).kind, "reloaded");
assert.equal(store.hasUnsavedChanges(), false);
const cleanState = store.getAutoSaveState();
obsolete.callback();
assert.equal(writes.length, 0);
assert.equal(store.getAutoSaveState(), cleanState);
assert.equal(store.hasUnsavedChanges(), false);
store.update((project: Project) => { project.meta.title = "B's explicit edit"; });
const [newHandle] = latestAutoSave();
obsolete.callback();
assert.equal(writes.length, 0);
assert.equal(timers.has(newHandle), true);
assert.equal((await store.flush()).kind, "saved");
assert.equal(timers.has(newHandle), false, "B still owns its cancellable timer");
assert.deepEqual(writes, ["B's explicit edit"]);
assert.equal(store.hasUnsavedChanges(), false);
console.log(JSON.stringify({ migrationScheduled: true, cleanReplacementPreserved: true,
  obsoleteCallbackWrites: 0, newerTimerOwnershipPreserved: true, explicitReplacementWrites: writes,
  finalDirty: store.hasUnsavedChanges() }, null, 2));
