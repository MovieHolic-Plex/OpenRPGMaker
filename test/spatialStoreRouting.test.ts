import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deserialize, serialize } from "../src/project/io";
import { createBlankProject } from "../src/project/defaults";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { spatialStoreFixture } from "./support/spatialStoreFixture";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it("keeps an empty library canonical when load and preview encounter stale mirrors", async () => {
  // Given an empty canonical root and a different child map.
  const root = { ...createBlankProject(), spatialAuthoring: emptySpatialDocument() };
  await using f = await spatialStoreFixture(root);
  f.http.state.maps = [{ map_id: root.startMapId, map_json: { ...root.maps[root.startMapId], name: "stale mirror" } }];
  // When the real store loads and the picker adapter reads its cover materials.
  await f.store.load();
  const preview = await f.sync.loadSupabaseProjectPreview(f.http.config, f.http.config.projectId);
  // Then both consume the root; zero map-row reads or implicit activation.
  expect(f.store.getCurrent().maps[root.startMapId].name).toBe(root.maps[root.startMapId].name);
  expect(preview?.map.name).toBe(root.maps[root.startMapId].name);
  expect(f.http.trace.filter(call => call.path.startsWith("/rest/v1/maps"))).toEqual([]);
  expect(f.http.trace.filter(call => call.method !== "GET")).toEqual([]);
}, 60_000);

it("retains root edits and proof when map-only saving succeeds but mirror projection fails", async () => {
  // Given a loaded canonical root edited at the database and map seams.
  await using f = await spatialStoreFixture();
  await f.store.load();
  f.store.update(draft => { draft.meta.title = "root edit retained"; });
  const mapId = f.store.getCurrent().startMapId;
  f.store.updateMap(mapId, map => { map.name = "accepted map"; });
  f.http.state.maps = [{ map_id: mapId, map_json: { ...f.store.getCurrent().maps[mapId], name: "stale mirror" } }];
  f.http.state.mirrorFailure = true;
  // When flush publishes the complete root.
  const saved = await f.store.flush();
  // Then failed projection is a separate warning; root, proof, picker and ordinary export agree.
  assert(saved.kind === "saved" && saved.receipt);
  expect(saved.receipt.serverRevision).toBe(1);
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "ready", mirror: { status: "warning" } });
  expect(f.store.hasUnsavedChanges()).toBe(false);
  expect(await f.store.verifyPersistedRevision(saved.receipt)).toMatchObject({ kind: "verified", isCurrent: true });
  const preview = await f.sync.loadSupabaseProjectPreview(f.http.config, f.http.config.projectId);
  const reloaded = await f.sync.loadProjectFromSupabase(f.http.config);
  expect(preview?.map.name).toBe("accepted map");
  expect(reloaded?.meta.title).toBe("root edit retained");
  expect(deserialize(serialize(f.store.getCurrent())).maps[mapId].name).toBe("accepted map");
  expect(f.http.trace.filter(call => call.path.endsWith("publish_spatial_project"))).toHaveLength(1);
});

it("rejects insert-only create when the requested project id already exists", async () => {
  // Given an existing remote canonical root and a new local candidate.
  await using f = await spatialStoreFixture();
  const before = structuredClone(f.http.state.root);
  const candidate = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  candidate.meta.title = "colliding create";
  await f.store.loadNewRemoteProject(candidate, { projectId: f.http.config.projectId });
  // When the explicit new-project workflow flushes.
  await expect(f.store.flush()).rejects.toMatchObject({ code: "conflict", status: 409 });
  // Then collision never becomes an update or upsert.
  expect(f.http.state.root).toEqual(before);
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.http.trace.filter(call => call.method !== "GET")).toMatchObject([{ body: { p_operation: "create", p_expected_sha256: null }, status: 409 }]);
});

it("keeps the original update token when project replacement clears the editor baseline", async () => {
  // Given a loaded canonical target and detached replacement including its canonical marker.
  await using f = await spatialStoreFixture();
  await f.store.load();
  const originalSHA = f.http.state.sha;
  const candidate = structuredClone(f.store.getCurrent());
  candidate.meta.title = "import replacement";
  f.store.replaceProject(candidate);
  expect(f.store._getPersistedBaselineForTest()).toBeNull();
  // When replacement is flushed through the full-save route.
  const result = await f.store.flush();
  // Then null baseline did not imply create/upsert.
  expect(result.kind).toBe("saved");
  expect(f.http.trace.find(call => call.path.endsWith("publish_spatial_project"))?.body).toMatchObject({ p_operation: "update", p_expected_sha256: originalSHA });
});

it.each(["reset", "import", "mutation"] as const)("rejects marker removal before local state changes when %s targets a canonical project", async operation => {
  // Given a canonical target, including its drafts and accepted baseline.
  await using f = await spatialStoreFixture();
  await f.store.load();
  const before = serialize(f.store.getCurrent());
  const count = f.http.trace.length;
  // When a replacement/reset tries to silently erase its remote fence.
  switch (operation) {
    case "reset": await expect(f.store.clearAll()).rejects.toMatchObject({ code: "canonical-replacement" }); break;
    case "import": expect(() => f.store.replaceProject(createBlankProject())).toThrow(expect.objectContaining({ code: "canonical-replacement" })); break;
    case "mutation": expect(() => f.store.update(draft => { delete draft.spatialAuthoring; })).toThrow(expect.objectContaining({ code: "canonical-replacement" })); break;
    default: throw new TypeError(String(operation satisfies never));
  }
  // Then neither the editor nor transport was altered.
  expect(serialize(f.store.getCurrent())).toBe(before);
  expect(f.http.trace.length).toBe(count);
});

it("keeps dirty state and typed recovery when the RPC is missing with zero legacy fallback", async () => {
  // Given canonical data edited through the real store.
  await using f = await spatialStoreFixture();
  await f.store.load();
  f.store.update(draft => { draft.meta.title = "unpublished edit"; });
  f.http.state.missingRpc = true;
  const count = f.http.trace.length;
  // When flush reaches a deployment without the publication RPC.
  await expect(f.store.flush()).rejects.toMatchObject({ code: "migration-required", status: 404 });
  // Then no maps or unconditional root writes run; recovery is not a fake map conflict.
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "blocked", error: { code: "migration-required" }, actions: ["reload", "export-copy"] });
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.http.trace.slice(count).filter(call => !call.path.startsWith("/rest/v1/project_commits"))).toMatchObject([{ path: "/rest/v1/rpc/publish_spatial_project", status: 404 }]);
});

it("rejects load-free canonical full saves and remembered-target marker removal", async () => {
  // Given canonical content plus sync-level sticky target knowledge (not a token registry).
  await using f = await spatialStoreFixture();
  const snapshot = await f.sync.loadProjectSnapshotFromSupabase(f.http.config);
  assert(snapshot);
  // When detached callers omit authority or try a legacy replacement on that known target.
  const outcomes = await Promise.allSettled([
    f.sync.saveProjectToSupabase(snapshot.project, f.http.config),
    f.sync.saveProjectToSupabase(createBlankProject(), f.http.config),
  ]);
  // Then both reject without granting a newly read token to old content.
  expect(outcomes).toMatchObject([{ status: "rejected", reason: { code: "authority-required" } }, { status: "rejected", reason: { code: "canonical-replacement" } }]);
  expect(f.http.trace.filter(call => call.method !== "GET")).toEqual([]);
});

it.each([null, { version: 99 }, { version: 1 }])("fails malformed present markers without child fallback: %j", async marker => {
  // Given a malformed canonical root that must not become legacy.
  await using f = await spatialStoreFixture({ ...createBlankProject(), spatialAuthoring: marker });
  // When the public load and preview adapters read it.
  const results = await Promise.allSettled([f.sync.loadProjectFromSupabase(f.http.config), f.sync.loadSupabaseProjectPreview(f.http.config, f.http.config.projectId)]);
  // Then both fail at the root and no mirror read occurs.
  expect(results).toMatchObject([{ status: "rejected", reason: { code: "invalid-project" } }, { status: "rejected", reason: { code: "invalid-project" } }]);
  expect(f.http.trace.every(call => call.path.startsWith("/rest/v1/projects"))).toBe(true);
});

it("returns canonical acceptance and propagates stale authority when using the compatibility facade", async () => {
  // Given a facade-loaded snapshot and explicitly retained authority, independent of Project identity.
  await using f = await spatialStoreFixture();
  const facade = await import("../src/project/tileMetadataDb");
  const loaded = await facade.loadProjectFromCanonicalStore();
  assert(loaded.project && loaded.authority);
  const a = structuredClone(loaded.project);
  a.meta.title = "facade A";
  const accepted = await facade.saveProjectToCanonicalStore(a, loaded.authority);
  assert(accepted.kind === "saved" && accepted.authority);
  const b = structuredClone(loaded.project);
  b.meta.title = "facade stale B";
  // When the facade receives an old token; it must not discard the publication error.
  await expect(facade.saveProjectToCanonicalStore(b, loaded.authority)).rejects.toMatchObject({ code: "conflict", status: 409 });
  // Then A remains canonical and its returned server authority was not recomputed from B.
  expect(f.http.state.root?.meta).toEqual(a.meta);
  expect(accepted.authority).toMatchObject({ mode: "canonical", revision: 1, serverSHA: f.http.state.sha });
});

it("keeps legacy preview independent of strict root parsing when child cover materials are usable", async () => {
  // Given legacy raw data requiring repair plus valid standalone mirror materials.
  await using f = await spatialStoreFixture({ legacyOpaqueField: true });
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  f.http.state.maps = [{ map_id: map.id, map_json: map }];
  f.http.state.previewTilesets = [{ tileset_id: map.tilesetId, tileset_json: project.tilesets[map.tilesetId] }];
  // When the existing legacy picker path reads the root only to discriminate canonical mode.
  const preview = await f.sync.loadSupabaseProjectPreview(f.http.config, f.http.config.projectId);
  // Then the raw legacy root was not forced through the stricter canonical reader.
  expect(preview?.map).toEqual(map);
  expect(preview?.tileset).toEqual(JSON.parse(JSON.stringify(project.tilesets[map.tilesetId])));
});
