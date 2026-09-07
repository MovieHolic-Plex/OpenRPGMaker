import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { deserialize, serialize } from "../../src/project/io";
import { projectWithoutEventDrafts } from "../../src/project/eventDrafts";
import { store } from "../../src/project/store";
import { sameProjectTarget } from "../../src/project/spatial/saveRouting";
import { supabaseProjectConfig } from "../../src/project/supabaseProjectConfig";
import { loadProjectSnapshotFromSupabase, loadProjectForPersistenceProof, loadSupabaseProjectPreview, saveProjectToSupabase } from "../../src/project/supabaseProjectSync";
import { spatialFixture } from "../../test/support/spatialSchemaFixture";
import { spatialPersistenceHttp } from "../../test/support/spatialPersistenceHttp";
import type { Project } from "../../src/project/types";

function namedDesk(project: Project, name: string): Project {
  const document = project.spatialAuthoring;
  assert(document);
  return { ...project, spatialAuthoring: { ...document, library: { ...document.library, objects: {
    ...document.library.objects, desk: { ...document.library.objects.desk, name },
  } } } };
}

/** Literal Q7/Q8 API scenarios; loopback fixture behavior is NOT SQL authorization/deployment proof. */
export async function runSpatialStoreScenario(input: {
  readonly scenario: "stale-writers" | "mirror-failure";
  readonly projectId: string;
  readonly evidence: string;
  readonly sourceSHA: string;
}): Promise<void> {
  await mkdir(input.evidence, { recursive: true });
  const http = await spatialPersistenceHttp();
  const config = { ...http.config, projectId: input.projectId };
  http.targets.set(config.projectId, http.state);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([["oprn:supabase-project-config", JSON.stringify({ ...config, source: "custom" })]]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: new URL(`http://127.0.0.1/?project=${encodeURIComponent(config.projectId)}`),
    localStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } },
  } });
  const checks: string[] = [];
  const fixture = spatialFixture();
  const project = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: fixture.document }));
  http.state.root = JSON.parse(serialize(project));
  http.state.enforceFences = true;
  try {
    // Refuse environment/proxy overrides before any store request can escape the owned server.
    assert(sameProjectTarget(config, supabaseProjectConfig()), "Inherited configuration does not match the local fixture; clear VITE_SUPABASE_URL/ANON_KEY and proxy mode before running QA.");
    const hydrated = http.completed("/rest/v1/project_commits");
    await store.load();
    await hydrated;
    if (store.hasUnsavedChanges()) {
      const audited = http.completed("/rest/v1/project_changes");
      assert.equal((await store.flush()).kind, "saved");
      await audited;
    }
    switch (input.scenario) {
      case "stale-writers": {
        // Given B is loaded in the real store and A independently holds the same target/token.
        const a = await loadProjectSnapshotFromSupabase(config);
        assert(a?.authority.mode === "canonical");
        const acceptedA = namedDesk(a.project, "Q7 accepted template A");
        const savedA = await saveProjectToSupabase(acceptedA, config, a.authority);
        assert.equal(savedA.kind, "saved");
        store.replace(namedDesk(store.getCurrent(), "Q7 dirty template B"));
        const count = http.trace.length;
        // When stale B goes through actual store.flush -> sync -> publication HTTP.
        await assert.rejects(store.flush(), { code: "conflict", status: 409 });
        assert.equal(store.hasUnsavedChanges(), true);
        assert.equal(store.getCurrent().spatialAuthoring?.library.objects.desk.name, "Q7 dirty template B");
        assert.equal(http.trace.length, count + 1);
        assert.equal(http.trace.at(-1)?.status, 409);
        checks.push("A-and-B-distinct-template-values", "store-B-original-token-conflicts-once", "B-retains-dirty-copy");
        const before = structuredClone(http.state.root);
        const legacy = { ...projectWithoutEventDrafts(acceptedA) };
        delete legacy.spatialAuthoring;
        // Actual legacy HTTP surfaces against fixture fences, not a claimed SQL role test.
        const probes = [
          { path: "projects?on_conflict=project_id", method: "POST", body: { project_id: config.projectId, current_json: legacy } },
          { path: `projects?project_id=eq.${config.projectId}`, method: "PATCH", body: { current_json: legacy } },
          { path: `maps?project_id=eq.${config.projectId}`, method: "POST", body: [{ project_id: config.projectId, map_id: project.startMapId, map_json: { overwritten: true } }] },
        ];
        for (const probe of probes) {
          const response = await fetch(`${config.url}/rest/v1/${probe.path}`, { method: probe.method,
            headers: { "Content-Type": "application/json", "Content-Profile": "rpg_zzu" }, body: JSON.stringify(probe.body), signal: AbortSignal.timeout(5000) });
          assert.equal(response.status, 403);
          await response.json();
        }
        const read = await loadProjectForPersistenceProof(config);
        assert(read);
        assert.equal(read.project.spatialAuthoring?.library.objects.desk.name, "Q7 accepted template A");
        assert.deepEqual(http.state.root, before);
        checks.push("local-HTTP-legacy-upsert-rejected", "local-HTTP-marker-removal-rejected", "local-HTTP-mirror-overwrite-rejected", "root-reload-retains-A");
        await writeFile(resolve(input.evidence, "local-dirty-copy.json"), serialize(projectWithoutEventDrafts(store.getCurrent())));
        break;
      }
      case "mirror-failure": {
        // Given stale child rows and a deliberately failing projection RPC.
        const mapId = store.getCurrent().startMapId;
        http.state.maps = [{ map_id: mapId, map_json: { ...store.getCurrent().maps[mapId], name: "Q8 stale child" } }];
        http.state.mirrorFailure = true;
        store.update(draft => { draft.meta.title = "Q8 accepted root"; });
        store.updateMap(mapId, map => { map.name = "Q8 accepted root map"; });
        const audited = http.completed("/rest/v1/project_changes");
        // When the real store accepts a root and separately receives projection failure.
        const saved = await store.flush();
        await audited;
        assert(saved.kind === "saved" && saved.receipt);
        assert.equal(store.hasUnsavedChanges(), false);
        assert.equal(store.getPersistenceRecovery().kind, "ready");
        const recovery = store.getPersistenceRecovery();
        assert(recovery.kind === "ready" && recovery.mirror?.status === "warning");
        assert.equal((await store.verifyPersistedRevision(saved.receipt)).kind, "verified");
        const reloaded = await loadProjectForPersistenceProof(config);
        const preview = await loadSupabaseProjectPreview(config, config.projectId);
        assert(reloaded && preview);
        assert.equal(reloaded.project.meta.title, "Q8 accepted root");
        assert.equal(preview.map.name, "Q8 accepted root map");
        assert.deepEqual(preview.tileset, reloaded.project.tilesets[preview.map.tilesetId]);
        checks.push("store-root-accepted", "mirror-warning-separate", "server-token-and-baseline-retained", "root-only-proof", "picker-materials-from-same-root", "reload-ignores-stale-mirror");
        await writeFile(resolve(input.evidence, "reload.json"), serialize(reloaded.project));
        await writeFile(resolve(input.evidence, "preview.json"), JSON.stringify({ mapId: preview.map.id, name: preview.map.name, tilesetId: preview.tileset.id, image: preview.tileset.image }));
        break;
      }
      default: throw new TypeError(String(input.scenario satisfies never));
    }
  } finally {
    // Clear any scheduled local edits without publishing or changing the accepted remote row.
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    await store.flush();
    await http[Symbol.asyncDispose]();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else assert(Reflect.deleteProperty(globalThis, "window"));
    await writeFile(resolve(input.evidence, "http.json"), JSON.stringify({ sourceSHA: input.sourceSHA, scenario: input.scenario,
      fixtureDigest: createHash("sha256").update(serialize(project)).digest("hex"), projectId: config.projectId, url: config.url,
      localOnly: true, sqlAuthorizationOrDeploymentProven: false, checks, exchanges: http.trace }, null, 2));
    await writeFile(resolve(input.evidence, "cleanup.json"), JSON.stringify({ sourceSHA: input.sourceSHA,
      serversClosed: http.lifecycle.closed, remoteCalls: 0, browserResourcesCreated: 0, databaseResourcesCreated: 0 }, null, 2));
  }
  process.stdout.write(`${JSON.stringify({ scenario: input.scenario, checks, localOnly: true, evidence: input.evidence })}\n`);
}
