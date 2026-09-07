import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { legacySpatialId } from "../src/project/spatial/legacyImport";
import { legacyRawFixture } from "./support/spatialLegacyImportFixture";
import { spatialStoreFixture } from "./support/spatialStoreFixture";
import type { ConceptBundleRecord } from "../src/project/types";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it.each(["dirty-before", "edit-during", "composition-during"] as const)("blocks unsafe follow-up publication when activation encounters %s", async scenario => {
  // Given B loaded a distinct older root, while A commits different author/map values through HTTP.
  const raw = legacyRawFixture();
  const bundle: ConceptBundleRecord = { id: "repair-hall", label: "Hall", facilities: [], things: [],
    places: [{ id: "hall", label: "Hall", role: "room", size: "m", floor: "wood" }] };
  await using f = await spatialStoreFixture({ ...raw.root, meta: { ...raw.root.meta, author: "initial copper author" },
    tilesets: { ...raw.root.tilesets, [raw.tilesetId]: { ...raw.root.tilesets[raw.tilesetId], scratchConceptBundles: [bundle] } } });
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: { ...raw.overlay, name: "initial copper map" } }];
  f.http.state.enforceFences = true;
  await f.store.load();
  const { createEventDraft } = await import("../src/editor/eventDraftActions");
  const a = await f.sync.loadProjectSnapshotFromSupabase(f.http.config);
  assert(a);
  a.project.meta.author = "accepted indigo author";
  a.project.maps[raw.overlay.id].name = "accepted indigo map";
  await f.sync.saveProjectToSupabase(a.project, f.http.config, a.authority);
  const before = f.http.trace.length;
  const path = "/rest/v1/rpc/publish_spatial_project";
  let eventId: string;
  let outcomes: readonly PromiseSettledResult<unknown>[];
  // When activation starts dirty, or the local generation changes after the exact request arrives.
  switch (scenario) {
    case "dirty-before":
      f.store.update(project => { project.meta.title = "local amber title"; });
      eventId = createEventDraft(raw.overlay.id, 3, 4);
      outcomes = await Promise.allSettled([f.store.activateSpatialAuthoring()]);
      break;
    case "edit-during": case "composition-during": {
      f.http.state.heldPath = path;
      const received = f.http.requested(path);
      const pending = Promise.allSettled([f.store.activateSpatialAuthoring()]);
      await received;
      f.store.update(project => { project.meta.title = "local amber title"; });
      eventId = createEventDraft(raw.overlay.id, 3, 4);
      if (scenario === "composition-during") {
        f.store.update(project => {
          const room = project.tilesets[raw.tilesetId].scratchConceptBundles?.[0]?.places[0];
          assert(room); room.floor = "stone";
        });
      }
      f.http.state.heldPath = "";
      f.http.release();
      outcomes = await pending;
      break;
    }
    default: throw new TypeError(String(scenario satisfies never));
  }
  // Then safe rejection keeps B exportable and blocks all coalesced/later writes, preserving A remotely.
  expect(outcomes).toMatchObject([{ status: "rejected", reason: { code: "activation-stale" } }]);
  const beforeFlush = f.http.trace.length;
  await expect(f.store.flush()).rejects.toMatchObject({ code: "activation-stale" });
  expect(f.http.trace.slice(beforeFlush)).toEqual([]);
  const remote = await f.sync.loadProjectSnapshotFromSupabase(f.http.config);
  assert(remote);
  expect(remote.project.meta.author).toBe("accepted indigo author");
  expect(remote.project.maps[raw.overlay.id].name).toBe("accepted indigo map");
  expect(remote.project.maps[raw.overlay.id].events.some(event => event.id === eventId)).toBe(false);
  expect(f.store.getCurrent().meta.title).toBe("local amber title");
  expect(f.store.getCurrent().maps[raw.overlay.id].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
  expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
  expect(f.store.hasUnsavedChanges()).toBe(true);
  const recovery = f.store.getPersistenceRecovery();
  expect(recovery).toMatchObject({ kind: "blocked", error: { code: "activation-stale" }, actions: ["reload", "export-copy"] });
  assert(recovery.kind === "blocked" && "accepted" in recovery.error);
  await expect(f.store.activateSpatialAuthoring()).rejects.toMatchObject({ code: "activation-stale", accepted: recovery.error.accepted });
  switch (scenario) {
    case "dirty-before":
      expect(f.http.trace.slice(before).filter(call => call.method !== "GET")).toEqual([]);
      expect(remote.project.spatialAuthoring).toBeUndefined();
      break;
    case "edit-during": case "composition-during":
      expect(f.http.trace.slice(before).filter(call => call.path === path)).toHaveLength(1);
      expect(recovery).toMatchObject({ error: { accepted: { projectId: f.http.config.projectId,
        sha256: remote.sha256, serverRevision: 1, mirror: { status: "synced" } } } });
      if (scenario === "composition-during") {
        const spaceId = legacySpatialId([raw.tilesetId, bundle.id, "place", "hall"]);
        expect(f.store.getCurrent().tilesets[raw.tilesetId].scratchConceptBundles?.[0]?.places[0]?.floor).toBe("stone");
        expect(remote.project.spatialAuthoring?.library.spaces[spaceId]?.floor).toBe("wood");
      }
      break;
    default: throw new TypeError(String(scenario satisfies never));
  }
});
