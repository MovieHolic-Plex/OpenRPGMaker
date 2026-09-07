import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { legacyRawFixture } from "./support/spatialLegacyImportFixture";
import { spatialStoreFixture } from "./support/spatialStoreFixture";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it("activates untouched raw shops and archive when the editor has loaded through the legacy reader", async () => {
  // Given raw legacy rows loaded through the ordinary repaired hybrid reader.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  await f.store.load();
  const count = f.http.trace.length;
  // When the explicit store operation activates, not a load/render or ordinary save.
  const accepted = await f.store.activateSpatialAuthoring();
  // Then ordinary JSON preserved raw values while the canonical editor uses its normalized copy.
  expect(accepted.kind).toBe("saved");
  const publication = f.http.trace.slice(count).find(call => call.path.endsWith("publish_spatial_project"));
  assert(publication && typeof publication.body === "object");
  expect(publication.body).toMatchObject({ p_operation: "activate", p_legacy_baseline: JSON.parse(raw.json) });
  expect(f.store.getCurrent().spatialAuthoring?.legacyImport.backup.json).toBe(raw.json);
  expect(f.http.state.root?.maps).toEqual(JSON.parse(raw.json).maps);
}, 60_000);

it("preserves dirty drafts and reports remote acceptance when activation adoption becomes stale", async () => {
  // Given a legacy load and a held activation request subscribed before triggering it.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  await f.store.load();
  const { createEventDraft } = await import("../src/editor/eventDraftActions");
  const path = "/rest/v1/rpc/publish_spatial_project";
  f.http.state.heldPath = path;
  const received = f.http.requested(path);
  const pending = expect(f.store.activateSpatialAuthoring()).rejects.toMatchObject({ code: "activation-stale", accepted: { serverRevision: 1 } });
  await received;
  const mapId = f.store.getCurrent().startMapId;
  const eventId = createEventDraft(mapId, 3, 4);
  f.store.update(draft => { draft.meta.title = "typed during activation"; });
  f.http.state.heldPath = "";
  // When activation accepts only its untouched raw baseline.
  f.http.release();
  await pending;
  // Then newer local content stays dirty and the archived raw baseline is not rewritten.
  expect(f.store.getCurrent().meta.title).toBe("typed during activation");
  expect(f.store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
  expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
  expect(f.http.state.root?.spatialAuthoring).toMatchObject({ legacyImport: { backup: { json: raw.json } } });
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.http.state.root?.meta).toEqual(raw.root.meta);
});

it("rejects activation on a raw overlay race without normalizing or force-saving the changed baseline", async () => {
  // Given an untouched raw capture and a request held before baseline comparison.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  await f.store.load();
  const path = "/rest/v1/rpc/publish_spatial_project";
  f.http.state.heldPath = path;
  const received = f.http.requested(path);
  const pending = f.store.activateSpatialAuthoring();
  const rejected = expect(pending).rejects.toMatchObject({ code: "conflict", status: 409 });
  await received;
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: { ...raw.overlay, name: "concurrent child" } }];
  // When the server compares the now-stale independent raw baseline.
  f.http.state.heldPath = "";
  f.http.release();
  await rejected;
  // Then no marker was adopted and no retry can silently rewrite raw content.
  expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
  expect(f.http.trace.filter(call => call.path === path)).toHaveLength(1);
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "blocked", error: { code: "conflict" } });
});

it.each(["old-version", "missing-sha"] as const)("keeps raw activation limitations explicit when %s prevents publication", async fault => {
  // Given a loadable legacy project without a legal activation prerequisite.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture({ ...raw.root, version: fault === "old-version" ? 3 : 4 });
  if (fault === "missing-sha") f.http.state.sha = null;
  await f.store.load();
  // When explicit activation captures raw state, not the normalized Project version.
  await expect(f.store.activateSpatialAuthoring()).rejects.toMatchObject({ code: fault === "old-version" ? "unsupported-legacy-version" : "sha-unavailable" });
  // Then the limitation is exposed before any write, without inferred activation/upsert.
  expect(f.http.trace.filter(call => call.method !== "GET")).toEqual([]);
});

it("does not adopt an activation response into a replacement lineage", async () => {
  // Given an activation accepted remotely but held during mirror synchronization.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  await f.store.load();
  const path = "/rest/v1/rpc/sync_spatial_mirrors";
  f.http.state.heldPath = path;
  const received = f.http.requested(path);
  const pending = f.store.activateSpatialAuthoring();
  await received;
  const replacement = structuredClone(f.store.getCurrent());
  replacement.meta.title = "separate imported lineage";
  f.store.replaceProject(replacement);
  // When the old activation returns.
  f.http.state.heldPath = "";
  f.http.release();
  await pending;
  // Then it cannot graft the old converted library into new local content; the sticky target blocks legacy saves.
  expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
  expect(f.store.getCurrent().meta.title).toBe("separate imported lineage");
  await expect(f.store.flush()).rejects.toMatchObject({ code: "canonical-replacement" });
});

it("blocks a coalesced flush when an edit makes raw activation adoption stale", async () => {
  // Given raw activation in flight and a local edit made after its request was submitted.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  await f.store.load();
  const path = "/rest/v1/rpc/publish_spatial_project";
  f.http.state.heldPath = path;
  const received = f.http.requested(path);
  const activation = expect(f.store.activateSpatialAuthoring()).rejects.toMatchObject({ code: "activation-stale" });
  await received;
  f.store.update(draft => { draft.meta.title = "coalesced newer root"; });
  const flush = expect(f.store.flush()).rejects.toMatchObject({ code: "activation-stale" });
  f.http.state.heldPath = "";
  // When the raw root is accepted but the waiting flush owns a different local generation.
  f.http.release();
  await Promise.all([activation, flush]);
  // Then no stale-root catch-up uses the fresh token; local edits stay dirty/exportable.
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.store.getCurrent().meta.title).toBe("coalesced newer root");
  expect(f.http.state.root?.meta).toEqual(raw.root.meta);
  expect(f.http.trace.filter(call => call.path === path).map(call => call.body)).toMatchObject([
    { p_operation: "activate" },
  ]);
});
