import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deserialize, serialize } from "../src/project/io";
import { createBlankProject } from "../src/project/defaults";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { spatialStoreFixture } from "./support/spatialStoreFixture";
import { spatialStoreLifecycle } from "./support/spatialStoreLifecycle";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it("adopts insert-only new project authority when its root reload verifies", async () => {
  // Given a flushed existing canonical project and a detached new canonical candidate.
  await using f = await spatialStoreFixture();
  await f.store.load();
  await f.store.flush();
  const original = structuredClone(f.http.state.root);
  const candidate = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  // When the real transaction publishes and reloads a distinct target.
  await f.store.loadNewRemoteProjectTransactionally(candidate, { projectId: "transaction-new" });
  // Then the next edit uses that accepted target/token, never a new create or old target.
  f.store.update(draft => { draft.meta.title = "new project second save"; });
  expect((await f.store.flush()).kind).toBe("saved");
  expect(f.http.state.root).toEqual(original);
  const calls = f.http.trace.filter(call => call.path.endsWith("publish_spatial_project"));
  expect(calls.slice(-2).map(call => call.body)).toMatchObject([
    { p_project_id: "transaction-new", p_operation: "create", p_expected_sha256: null },
    { p_project_id: "transaction-new", p_operation: "update", p_expected_sha256: "1".padStart(64, "0") },
  ]);
}, 60_000);

spatialStoreLifecycle(async own => {
  // Given an accepted old canonical root, before injecting any local commit failure.
  const f = own(await spatialStoreFixture());
  await f.store.load();
  await f.store.flush();
  const originalSHA = f.http.state.sha;
  const before = serialize(f.store.getCurrent());
  const storedConfig = f.browser.localStorage.getItem("oprn:supabase-project-config");
  const candidate = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  return { f, originalSHA, before, storedConfig, candidate };
}, run => {
  it("restores old authority and recovery when local adoption rolls back after remote creation", () => run(async ({ f, originalSHA, before, storedConfig, candidate }) => {
    const setItem = f.browser.localStorage.setItem;
    const failingStorage = vi.spyOn(f.browser.localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "oprn:supabase-selected-project") throw new DOMException("fixture quota", "QuotaExceededError");
      setItem(key, value);
    });
    // When the new root is accepted but local commit fails after adoption began.
    await expect(f.store.loadNewRemoteProjectTransactionally(candidate, { projectId: "rollback-new" })).rejects.toMatchObject({ stage: "commit" });
    failingStorage.mockRestore();
    // Then the old content/config/authority still govern subsequent saves; accepted new root is not deleted.
    expect(serialize(f.store.getCurrent())).toBe(before);
    expect(f.browser.localStorage.getItem("oprn:supabase-project-config")).toBe(storedConfig);
    expect(f.http.targets.get("rollback-new")?.root).not.toBeNull();
    f.store.update(draft => { draft.meta.title = "old target after rollback"; });
    await f.store.flush();
    expect(f.http.trace.filter(call => call.path.endsWith("publish_spatial_project")).at(-1)?.body).toMatchObject({ p_project_id: f.http.config.projectId, p_operation: "update", p_expected_sha256: originalSHA });
  }));
});

it("retains typed collision cause and current project when transactional create hits an existing row", async () => {
  // Given a current loaded root and an already occupied target id.
  await using f = await spatialStoreFixture();
  await f.store.load();
  await f.store.flush();
  const before = serialize(f.store.getCurrent());
  const candidate = structuredClone(f.store.getCurrent());
  candidate.meta.title = "colliding transaction";
  // When create is requested at an existing id.
  await expect(f.store.loadNewRemoteProjectTransactionally(candidate, { projectId: f.http.config.projectId })).rejects.toMatchObject({ stage: "save", cause: { code: "conflict", status: 409 } });
  // Then no local adoption occurred.
  expect(serialize(f.store.getCurrent())).toBe(before);
});

it("strips new and edited event drafts on canonical writes while retaining local working copies", async () => {
  // Given a canonical load containing a committed event plus local new/edit drafts.
  await using f = await spatialStoreFixture();
  await f.store.load();
  const { createEventDraft } = await import("../src/editor/eventDraftActions");
  const mapId = f.store.getCurrent().startMapId;
  const newId = createEventDraft(mapId, 3, 4);
  const original = structuredClone(f.store.getCurrent().maps[mapId].events.find(event => event.id === newId));
  assert(original);
  delete original.draft;
  original.id = "committed-original";
  original.name = "committed name";
  f.store.updateMap(mapId, map => { map.events.push({ ...original, name: "unaccepted working name", draft: { kind: "edit", original } }); });
  // When ordinary publication crosses the event draft projection boundary.
  await f.store.flush();
  // Then the root contains only committed content and the editor keeps both drafts.
  const root = deserialize(JSON.stringify(f.http.state.root));
  expect(root.maps[mapId].events.find(event => event.id === newId)).toBeUndefined();
  expect(root.maps[mapId].events.find(event => event.id === original.id)?.name).toBe("committed name");
  expect(f.store.getCurrent().maps[mapId].events.find(event => event.id === newId)?.draft?.kind).toBe("new");
  expect(f.store.getCurrent().maps[mapId].events.find(event => event.id === original.id)?.name).toBe("unaccepted working name");
});

it("consumes a legacy create intent when later replacement saves the now-existing target", async () => {
  // Given explicit insert-only creation of a new legacy target.
  await using f = await spatialStoreFixture();
  await f.store.loadNewRemoteProject(createBlankProject(), { projectId: "new-legacy" });
  await f.store.flush();
  const replacement = structuredClone(f.store.getCurrent());
  replacement.meta.title = "legacy replacement after creation";
  f.store.replaceProject(replacement);
  // When a later full save has a null editor baseline but the target already exists.
  const saved = await f.store.flush();
  // Then it preserves legacy replacement semantics rather than repeating insert-only create.
  expect(saved.kind).toBe("saved");
  expect(f.http.targets.get("new-legacy")?.root?.meta).toMatchObject({ title: "legacy replacement after creation" });
});
