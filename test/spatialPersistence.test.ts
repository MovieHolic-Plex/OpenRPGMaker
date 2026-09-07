import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { publishSpatialProject, readSpatialRootSnapshot } from "../src/project/spatial/persistence";
import { spatialFixture } from "./support/spatialSchemaFixture";
import { spatialPersistenceHttp } from "./support/spatialPersistenceHttp";

beforeEach(() => {
  vi.resetModules();
  // Disable scheduling only; actual HTTP barriers use node events, never elapsed time.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("retains dirty B and rejects its original token when A publishes a distinct template through HTTP", async () => {
  // Given B loaded through the actual store, then A publishes a distinct template.
  await using http = await spatialPersistenceHttp();
  vi.stubEnv("VITE_SUPABASE_URL", http.config.url);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", http.config.anonKey);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", http.config.projectId);
  const fixture = spatialFixture();
  http.state.root = { ...fixture.project, spatialAuthoring: fixture.document };
  const { store } = await import("../src/project/store");
  await store.load();
  const a = await readSpatialRootSnapshot(http.config);
  assert(a?.mode === "canonical" && a.preview.spatialAuthoring);
  const document = a.preview.spatialAuthoring;
  a.preview.spatialAuthoring = { ...document, library: { ...document.library, objects: {
    ...document.library.objects, desk: { ...document.library.objects.desk, name: "accepted A" },
  } } };
  const accepted = await publishSpatialProject({ operation: "update", project: a.preview, serverSHA: a.serverSHA }, http.config);
  store.update(draft => {
    assert(draft.spatialAuthoring);
    const doc = draft.spatialAuthoring;
    draft.spatialAuthoring = { ...doc, library: { ...doc.library, objects: {
      ...doc.library.objects, desk: { ...doc.library.objects.desk, name: "dirty B" },
    } } };
  });
  const count = http.trace.length;
  // When B flushes its stale canonical root, not just a detached transport payload.
  await expect(store.flush()).rejects.toMatchObject({ code: "conflict", status: 409 });
  // Then A survives, B stays dirty, and no latest-token merge or legacy fallback runs.
  expect(http.state.root).toEqual(accepted.project);
  expect(store.getCurrent().spatialAuthoring?.library.objects.desk.name).toBe("dirty B");
  expect(store.hasUnsavedChanges()).toBe(true);
  expect(http.trace.slice(count)).toMatchObject([{ path: "/rest/v1/rpc/publish_spatial_project", status: 409 }]);
}, 60_000);
