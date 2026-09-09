import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mock } from "node:test";
import { createEventDraft } from "../../src/editor/eventDraftActions";
import { store } from "../../src/project/store";
import { projectWithoutEventDrafts } from "../../src/project/eventDrafts";
import { serialize } from "../../src/project/io";
import { legacySpatialId } from "../../src/project/spatial/legacyImport";
import { sameProjectTarget } from "../../src/project/spatial/saveRouting";
import { supabaseProjectConfig } from "../../src/project/supabaseProjectConfig";
import { loadProjectSnapshotFromSupabase, saveProjectToSupabase } from "../../src/project/supabaseProjectSync";
import { legacyRawFixture } from "../../test/support/spatialLegacyImportFixture";
import { spatialPersistenceHttp } from "../../test/support/spatialPersistenceHttp";
import type { ConceptBundleRecord, Project } from "../../src/project/types";

/** Real HTTP/store recovery scenarios. Acceptance is remote history, not permission to publish local B. */
export async function runSpatialActivationScenario(input: {
  readonly scenario: "activation-dirty-before" | "activation-edit-during" | "activation-composition-during" | "activation-changed-target";
  readonly projectId: string;
  readonly evidence: string;
  readonly sourceSHA: string;
}): Promise<void> {
  const http = await spatialPersistenceHttp();
  const config = { ...http.config, projectId: input.projectId };
  http.targets.set(config.projectId, http.state);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const entries = new Map([["oprn:supabase-project-config", JSON.stringify({ ...config, source: "custom" })]]);
  const location = new URL(`http://127.0.0.1/?project=${encodeURIComponent(config.projectId)}`);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location,
    history: { state: null, replaceState: (_state: unknown, _title: string, url: string | URL) => { location.href = new URL(url, location).href; } },
    localStorage: { getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } },
  } });
  const raw = legacyRawFixture();
  const bundle: ConceptBundleRecord = { id: "cli-cabin", label: "Cabin", facilities: [], things: [],
    places: [{ id: "cabin", label: "Cabin", role: "room", size: "m", floor: "wood" }] };
  http.state.root = { ...raw.root, meta: { ...raw.root.meta, author: "CLI initial bronze author", title: "CLI initial bronze title" },
    tilesets: { ...raw.root.tilesets, [raw.tilesetId]: { ...raw.root.tilesets[raw.tilesetId], scratchConceptBundles: [bundle] } } };
  http.state.maps = [{ map_id: raw.overlay.id, map_json: { ...raw.overlay, name: "CLI initial bronze map" } }];
  http.state.enforceFences = true;
  const fixtureDigest = createHash("sha256").update(JSON.stringify(http.state.root)).digest("hex");
  const spaceId = legacySpatialId([raw.tilesetId, bundle.id, "place", "cabin"]);
  const path = "/rest/v1/rpc/publish_spatial_project";
  const observed: Record<string, unknown> = {};
  let draftId = "";
  function content(project: Project) {
    return { title: project.meta.title, author: project.meta.author, mapName: project.maps[raw.overlay.id]?.name,
      canonicalFloor: project.spatialAuthoring?.library.spaces[spaceId]?.floor,
      legacyFloor: project.tilesets[raw.tilesetId]?.scratchConceptBundles?.[0]?.places[0]?.floor,
      draftPresent: project.maps[raw.overlay.id]?.events.some(event => event.id === draftId && event.draft?.kind === "new") };
  }
  function editLocal(): void {
    store.update(project => { project.meta.title = "CLI local silver title"; });
    draftId = createEventDraft(raw.overlay.id, 3, 4);
    assert(draftId);
  }
  // Disable unrelated autosave scheduling only. HTTP barriers use native bounded event subscriptions.
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    assert(sameProjectTarget(config, supabaseProjectConfig()));
    const hydrated = http.completed("/rest/v1/project_commits");
    await store.load(); await hydrated;
    const a = await loadProjectSnapshotFromSupabase(config);
    assert(a?.authority.mode === "legacy");
    a.project.meta.author = "CLI remote cobalt author";
    a.project.maps[raw.overlay.id].name = "CLI remote cobalt map";
    await saveProjectToSupabase(a.project, config, a.authority);
    const before = http.trace.length;
    let outcomes: readonly PromiseSettledResult<unknown>[];
    // Given B's old load and A's independently saved author/map; when activation races with B.
    switch (input.scenario) {
      case "activation-dirty-before":
        editLocal();
        outcomes = await Promise.allSettled([store.activateSpatialAuthoring()]);
        break;
      case "activation-edit-during": case "activation-composition-during": case "activation-changed-target": {
        const heldPath = input.scenario === "activation-changed-target" ? "/rest/v1/rpc/sync_spatial_mirrors" : path;
        http.state.heldPath = heldPath;
        const received = http.requested(heldPath);
        const pending = Promise.allSettled([store.activateSpatialAuthoring()]);
        await received;
        editLocal();
        switch (input.scenario) {
          case "activation-edit-during": break;
          case "activation-composition-during":
            store.update(project => {
              const room = project.tilesets[raw.tilesetId].scratchConceptBundles?.[0]?.places[0];
              assert(room); room.floor = "stone";
            });
            break;
          case "activation-changed-target": location.search = "?project=cli-unrelated-target"; break;
          default: throw new TypeError(String(input.scenario satisfies never));
        }
        http.state.heldPath = ""; http.release();
        outcomes = await pending;
        break;
      }
      default: throw new TypeError(String(input.scenario satisfies never));
    }
    observed.activation = outcomes;
    observed.localAfterActivation = content(store.getCurrent());
    observed.recovery = store.getPersistenceRecovery();
    const beforeFlush = http.trace.length;
    const flush = await Promise.allSettled([store.flush(), store.flush()]);
    observed.flush = flush;
    assert.deepEqual(flush.map(result => result.status), ["rejected", "rejected"]);
    assert.equal(http.trace.length, beforeFlush);
    const remote = await loadProjectSnapshotFromSupabase(config);
    assert(remote);
    observed.remoteAfterFlush = content(remote.project);
    observed.remoteSHA = remote.sha256;
    // Then real follow-up HTTP reload preserves A and B remains dirty, draft-bearing, exportable.
    assert.equal(remote.project.meta.author, "CLI remote cobalt author");
    assert.equal(remote.project.maps[raw.overlay.id].name, "CLI remote cobalt map");
    assert.equal(remote.project.maps[raw.overlay.id].events.some(event => event.id === draftId), false);
    assert.equal(store.hasUnsavedChanges(), true);
    assert.equal(content(store.getCurrent()).draftPresent, true);
    assert.equal(store.getCurrent().spatialAuthoring, undefined);
    switch (input.scenario) {
      case "activation-dirty-before":
        assert.deepEqual(outcomes.map(result => result.status), ["rejected"]);
        assert.equal(http.trace.slice(before).filter(call => call.method !== "GET").length, 0);
        assert.equal(remote.project.spatialAuthoring, undefined);
        break;
      case "activation-edit-during": case "activation-composition-during": {
        assert.deepEqual(outcomes.map(result => result.status), ["rejected"]);
        const recovery = store.getPersistenceRecovery();
        assert(recovery.kind === "blocked" && recovery.error.code === "activation-stale" && "accepted" in recovery.error);
        assert.equal(recovery.error.accepted?.sha256, remote.sha256);
        assert.equal(recovery.error.accepted?.projectId, config.projectId);
        assert.equal(recovery.error.accepted?.serverRevision, 1);
        assert.equal(http.trace.slice(before).filter(call => call.path === path).length, 1);
        if (input.scenario === "activation-composition-during") {
          assert.equal(content(store.getCurrent()).legacyFloor, "stone");
          assert.equal(content(remote.project).canonicalFloor, "wood");
        }
        break;
      }
      case "activation-changed-target":
        assert.deepEqual(outcomes.map(result => result.status), ["fulfilled"]);
        assert.equal(remote.authority.mode, "canonical");
        assert.equal(http.targets.has("cli-unrelated-target"), false);
        break;
      default: throw new TypeError(String(input.scenario satisfies never));
    }
    await writeFile(resolve(input.evidence, "local-dirty-copy.json"), serialize(projectWithoutEventDrafts(store.getCurrent())));
    await writeFile(resolve(input.evidence, "local-draft.json"), JSON.stringify(store.getCurrent()));
    await writeFile(resolve(input.evidence, "reload.json"), serialize(remote.project));
  } finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    await store.flush();
    http.release(); await http[Symbol.asyncDispose]();
    mock.timers.reset();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else assert(Reflect.deleteProperty(globalThis, "window"));
    await writeFile(resolve(input.evidence, "http.json"), JSON.stringify({ ...input, url: config.url, fixtureDigest, observed,
      localOnly: true, sqlAuthorizationOrDeploymentProven: false, exchanges: http.trace }, null, 2));
    await writeFile(resolve(input.evidence, "cleanup.json"), JSON.stringify({ sourceSHA: input.sourceSHA,
      serverClosed: http.lifecycle.closed, timersRestored: true, windowRestored: true, remoteCalls: 0, databaseResourcesCreated: 0 }, null, 2));
  }
  process.stdout.write(`${JSON.stringify({ scenario: input.scenario, status: "passed", localOnly: true, evidence: input.evidence })}\n`);
}
