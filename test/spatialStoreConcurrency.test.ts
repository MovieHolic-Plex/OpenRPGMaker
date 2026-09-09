import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deserialize, serialize } from "../src/project/io";
import { publishSpatialProject, readSpatialRootSnapshot } from "../src/project/spatial/persistence";
import { spatialStoreFixture } from "./support/spatialStoreFixture";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
const publicationPath = "/rest/v1/rpc/publish_spatial_project";

it("coalesces concurrent flushes and catches up using the accepted token when a newer edit arrives", async () => {
  // Given one submitted root, with a barrier before server acceptance.
  await using f = await spatialStoreFixture();
  await f.store.load();
  const firstSHA = f.http.state.sha;
  f.store.update(draft => { draft.meta.title = "first generation"; });
  f.http.state.heldPath = publicationPath;
  const received = f.http.requested(publicationPath);
  const first = f.store.flush();
  const second = f.store.flush();
  await received;
  f.store.updateMap(f.store.getCurrent().startMapId, map => { map.name = "newer map"; });
  f.store.update(draft => { draft.meta.title = "newer root"; });
  f.http.state.heldPath = "";
  // When acceptance releases both waiters and performs one catch-up publication.
  f.http.release();
  const results = await Promise.all([first, second]);
  // Then the latest edits are accepted, not adopted from an old response or redundantly submitted.
  expect(results.map(result => result.kind)).toEqual(["saved", "saved"]);
  expect(f.store.hasUnsavedChanges()).toBe(false);
  expect(f.store.getCurrent().meta.title).toBe("newer root");
  const calls = f.http.trace.filter(call => call.path === publicationPath);
  expect(calls).toHaveLength(2);
  expect(calls[0].body).toMatchObject({ p_expected_sha256: firstSHA });
  expect(calls[1].body).toMatchObject({ p_expected_sha256: "1".padStart(64, "0") });
  const root = deserialize(JSON.stringify(f.http.state.root));
  expect(root.maps[root.startMapId].name).toBe("newer map");
  expect(root.meta.title).toBe("newer root");
}, 60_000);

it("returns one shared rejection without a fresh-token retry when concurrent flushes conflict", async () => {
  // Given A's accepted update invalidated B's loaded token.
  await using f = await spatialStoreFixture();
  await f.store.load();
  const a = await readSpatialRootSnapshot(f.http.config);
  assert(a?.mode === "canonical");
  a.preview.meta.title = "accepted A";
  await publishSpatialProject({ operation: "update", project: a.preview, serverSHA: a.serverSHA }, f.http.config);
  f.store.update(draft => { draft.meta.title = "dirty B"; });
  f.http.state.heldPath = publicationPath;
  const received = f.http.requested(publicationPath);
  const results = Promise.allSettled([f.store.flush(), f.store.flush()]);
  await received;
  // When the held conflict is returned to both flush callers.
  f.http.state.heldPath = "";
  f.http.release();
  // Then the same conflict remains dirty; neither waiter retries stale content with A's token.
  expect(await results).toMatchObject([{ status: "rejected", reason: { code: "conflict" } }, { status: "rejected", reason: { code: "conflict" } }]);
  expect(f.http.trace.filter(call => call.path === publicationPath)).toHaveLength(2);
  expect(f.store.hasUnsavedChanges()).toBe(true);
});

it.each(["replacement", "target"] as const)("does not adopt late acceptance or catch up into another %s", async change => {
  // Given the old root was accepted but its mirror response is still held.
  await using f = await spatialStoreFixture();
  await f.store.load();
  f.store.update(draft => { draft.meta.title = "old submitted"; });
  const mirrorPath = "/rest/v1/rpc/sync_spatial_mirrors";
  f.http.state.heldPath = mirrorPath;
  const received = f.http.requested(mirrorPath);
  const pending = f.store.flush();
  await received;
  const replacement = structuredClone(f.store.getCurrent());
  replacement.meta.title = "new lineage";
  switch (change) {
    case "replacement": f.store.replaceProject(replacement); break;
    case "target": f.browser.location.search = "?project=another-target"; break;
    default: throw new TypeError(String(change satisfies never));
  }
  const baseline = f.store._getPersistedBaselineForTest();
  // When the historical publication returns.
  f.http.state.heldPath = "";
  f.http.release();
  const result = await pending;
  // Then historical proof exists, but no authority/baseline/dirty adoption or automatic target write occurs.
  assert(result.kind === "saved" && result.receipt);
  expect(f.store.isPersistenceReceiptCurrent(result.receipt)).toBe(false);
  expect(f.store._getPersistedBaselineForTest()).toBe(baseline);
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.http.trace.filter(call => call.path === publicationPath)).toHaveLength(1);
});

it.each(["reload", "reconnect"] as const)("keeps normalization dirty when %s publication conflicts", async operation => {
  // Given a root requiring bundled-resource normalization, with a second loaded writer.
  await using f = await spatialStoreFixture();
  await f.store.load();
  const project = structuredClone(f.store.getCurrent());
  delete project.tilesets.easyrpg_chipset_world;
  f.http.state.root = JSON.parse(serialize(project));
  const a = await readSpatialRootSnapshot(f.http.config);
  assert(a?.mode === "canonical");
  a.preview.meta.title = "normalization race winner";
  f.http.state.heldPath = publicationPath;
  const received = f.http.requested(publicationPath);
  const pending = operation === "reload" ? f.store.reloadFromRemote({ force: true }) : f.store.reconnectRemotePersistence();
  await received;
  f.http.state.heldPath = "";
  await publishSpatialProject({ operation: "update", project: a.preview, serverSHA: a.serverSHA }, f.http.config);
  // When the normalization save compares the original loaded token after A won.
  f.http.release();
  const result = await pending;
  // Then the final load/reconnect cleanup cannot erase a conflict or reset dirty state.
  expect(result.kind).toBe("failed");
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "blocked", error: { code: "conflict" } });
  expect(f.http.trace.filter(call => call.path === publicationPath).map(call => call.status)).toEqual([200, 409]);
});

it("preserves local edits when a subscribed reload response arrives after a newer generation", async () => {
  // Given a loaded project and a held root read.
  await using f = await spatialStoreFixture();
  await f.store.load();
  f.http.state.heldPath = "/rest/v1/projects";
  const received = f.http.requested("/rest/v1/projects");
  const pending = f.store.reloadFromRemote({ force: true });
  await received;
  f.store.update(draft => { draft.meta.title = "typed during reload"; });
  // When the late read is released.
  f.http.state.heldPath = "";
  f.http.release();
  // Then reload reports failure without adopting remote content over the local generation.
  expect((await pending).kind).toBe("failed");
  expect(f.store.getCurrent().meta.title).toBe("typed during reload");
  expect(f.store.hasUnsavedChanges()).toBe(true);
});
