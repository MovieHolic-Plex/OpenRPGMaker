import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deserialize } from "../src/project/io";
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

it("retains accepted mirror warning when transactional creation adopts the new target", async () => {
  // Given a clean existing target and a new canonical copy whose mirror RPC will fail.
  await using f = await spatialStoreFixture();
  await f.store.load(); await f.store.flush();
  const candidate = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  candidate.meta.title = "transaction violet root";
  f.http.state.mirrorFailure = true;
  // When the actual transaction creates, verifies and adopts the new root.
  await f.store.loadNewRemoteProjectTransactionally(candidate, { projectId: "repair-mirror-target" });
  // Then warning and accepted authority survive adoption; the follow-up update uses its original token.
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "ready", mirror: { status: "warning" } });
  expect(f.store.hasUnsavedChanges()).toBe(false);
  expect(f.http.targets.get("repair-mirror-target")?.root?.meta).toMatchObject({ title: "transaction violet root" });
  f.store.update(project => { project.meta.author = "transaction teal author"; });
  await f.store.flush();
  expect(f.http.trace.filter(call => call.path.endsWith("publish_spatial_project")).at(-1)?.body).toMatchObject({
    p_project_id: "repair-mirror-target", p_operation: "update", p_expected_sha256: "1".padStart(64, "0"),
  });
});

it.each(["reload", "reconnect"] as const)("exposes typed parse recovery when %s sees a malformed marker", async operation => {
  // Given an accepted canonical target with a dirty local title and draft, then an invalid remote marker.
  await using f = await spatialStoreFixture();
  await f.store.load(); await f.store.flush();
  const { createEventDraft } = await import("../src/editor/eventDraftActions");
  createEventDraft(f.store.getCurrent().startMapId, 3, 4);
  f.store.update(project => { project.meta.title = "dirty ochre title"; });
  const local = structuredClone(f.store.getCurrent());
  const baseline = f.store._getPersistedBaselineForTest();
  assert(f.http.state.root);
  f.http.state.root = { ...f.http.state.root, spatialAuthoring: { version: 71 } };
  const before = f.http.trace.length;
  // When an explicit read encounters invalid canonical data, not a transport outage.
  const result = operation === "reload" ? await f.store.reloadFromRemote({ force: true }) : await f.store.reconnectRemotePersistence();
  // Then typed recovery blocks the owning lineage without adopting/cleaning the draft or child fallback.
  expect(result.kind).toBe("failed");
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "blocked", error: { code: "invalid-project" }, actions: ["reload", "export-copy"] });
  expect(f.store.getCurrent()).toEqual(local);
  expect(f.store._getPersistedBaselineForTest()).toBe(baseline);
  expect(f.store.hasUnsavedChanges()).toBe(true);
  expect(f.store.getDbPersistenceStatus().kind).toBe("ready");
  expect(f.store.isRemotePersistenceEnabled()).toBe(true);
  expect(f.http.trace.slice(before).map(call => call.path.split("?")[0])).toEqual(["/rest/v1/projects"]);
});

it.each(["reload", "reconnect"] as const)("does not attach a failed %s read to a replacement lineage", async operation => {
  // Given a root read held before its invalid response, with rejection already observed by the API.
  await using f = await spatialStoreFixture();
  await f.store.load(); await f.store.flush();
  assert(f.http.state.root);
  f.http.state.root = { ...f.http.state.root, spatialAuthoring: { version: 72 } };
  const path = "/rest/v1/projects";
  f.http.state.heldPath = path;
  const received = f.http.requested(path);
  const pending = operation === "reload" ? f.store.reloadFromRemote({ force: true }) : f.store.reconnectRemotePersistence();
  await received;
  const replacement = structuredClone(f.store.getCurrent());
  replacement.meta.title = "separate emerald lineage";
  f.store.replaceProject(replacement);
  // When the old read fails after a distinct adoption.
  f.http.state.heldPath = ""; f.http.release();
  const result = await pending;
  // Then the failure is returned only to its caller, not attached to the new lineage.
  expect(result.kind).toBe("failed");
  expect(f.store.getPersistenceRecovery().kind).toBe("ready");
  expect(f.store.getCurrent().meta.title).toBe("separate emerald lineage");
  expect(f.store.hasUnsavedChanges()).toBe(true);
});
