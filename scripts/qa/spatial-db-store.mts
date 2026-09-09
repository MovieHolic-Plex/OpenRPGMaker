import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deserialize, serialize } from "../../src/project/io";
import { projectWithoutEventDrafts } from "../../src/project/eventDrafts";
import { store } from "../../src/project/store";
import { publishSpatialProject, readSpatialRootSnapshot, syncSpatialMirrors } from "../../src/project/spatial/persistence";
import { sameProjectTarget } from "../../src/project/spatial/saveRouting";
import { supabaseProjectConfig } from "../../src/project/supabaseProjectConfig";
import { loadProjectForPersistenceProof, loadSupabaseProjectPreview } from "../../src/project/supabaseProjectSync";
import { spatialFixture } from "../../test/support/spatialSchemaFixture";
import { literal, SqlSession } from "./spatial-db-session.mts";
import { resumeHttp } from "./spatial-http-lock.mts";
import type { DatabaseSurface } from "./spatial-db-q7.mts";

export async function storeProof(http: DatabaseSurface, scenario: "stale-writers" | "mirror-failure", evidence: string) {
  const config = { ...http.config, projectId: `task20-store-${scenario}` };
  const fixture = spatialFixture();
  const project = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: fixture.document }));
  const created = await publishSpatialProject({ operation: "create", project }, config);
  assert.equal((await syncSpatialMirrors(created, config)).status, "synced");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([["oprn:supabase-project-config", JSON.stringify({ ...config, source: "custom" })]]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: new URL(`http://127.0.0.1/?project=${config.projectId}`),
    localStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } },
  } });
  await using sql = new SqlSession();
  try {
    assert(sameProjectTarget(config, supabaseProjectConfig()), "Inherited application configuration is forbidden");
    const hydrated = http.completed("/project_commits");
    await store.load(); await hydrated;
    if (store.hasUnsavedChanges()) {
      const audited = http.completed("/project_commits");
      assert.equal((await store.flush()).kind, "saved"); await audited;
    }
    switch (scenario) {
      case "stale-writers": {
        // Given independent A and store B hold the same loaded token, A locks an accepted distinct root.
        const a = await readSpatialRootSnapshot(config); assert(a?.mode === "canonical");
        const acceptedA = structuredClone(a.rawRoot);
        const projectA = { ...acceptedA, meta: { ...project.meta, title: "Q7 accepted A" } };
        await sql.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
        await sql.query(`BEGIN; SELECT rpg_zzu.publish_spatial_project(${literal(config.projectId)},${literal(a.serverSHA)},${literal(projectA)}::jsonb,'update');`);
        const count = http.trace.length;
        // When actual B flush starts once, while A's publication remains uncommitted.
        const { result, proof } = await resumeHttp(sql, http.pid, () => {
          store.update(draft => { draft.meta.title = "Q7 local dirty B"; });
          return store.flush(); // Synchronously cancels autosave; no timer controls the race.
        });
        assert.equal(result.kind, "rejected");
        assert(result.kind === "rejected");
        assert(result.error instanceof Error && "code" in result.error && "status" in result.error);
        assert.equal(result.error.code, "conflict"); assert.equal(result.error.status, 409);
        assert.equal(http.trace.length, count + 1, "No retry, mirror call, or legacy fallback");
        assert.equal(store.hasUnsavedChanges(), true);
        assert.equal(store.getCurrent().meta.title, "Q7 local dirty B");
        const reload = await readSpatialRootSnapshot(config);
        assert.deepEqual(reload?.rawRoot, projectA);
        await writeFile(resolve(evidence, "same-query-overlap.json"), JSON.stringify(proof, null, 2));
        await writeFile(resolve(evidence, "local-dirty-copy.json"), serialize(projectWithoutEventDrafts(store.getCurrent())));
        await writeFile(resolve(evidence, "reload.json"), JSON.stringify(reload.rawRoot));
        break;
      }
      case "mirror-failure": {
        // Given actual stale child rows; the NOT VALID fault allows them but rejects future mirror INSERT.
        await sql.query(`ALTER TABLE rpg_zzu.maps ADD CONSTRAINT task20_projection_failure CHECK(project_id<>${literal(config.projectId)}) NOT VALID;`);
        try {
          const mapId = store.getCurrent().startMapId;
          const audited = http.completed("/project_commits");
          store.update(draft => { draft.meta.title = "Q8 accepted root"; draft.maps[mapId].name = "Q8 accepted root map"; });
          // When the root RPC commits and the independent real SQL mirror transaction fails.
          const saved = await store.flush(); await audited;
          assert(saved.kind === "saved" && saved.receipt);
          assert.equal(store.hasUnsavedChanges(), false);
          const recovery = store.getPersistenceRecovery();
          assert(recovery.kind === "ready" && recovery.mirror?.status === "warning");
          assert.equal((await store.verifyPersistedRevision(saved.receipt)).kind, "verified");
          const reloaded = await loadProjectForPersistenceProof(config);
          const preview = await loadSupabaseProjectPreview(config, config.projectId);
          assert(reloaded && preview);
          assert.equal(reloaded.project.meta.title, "Q8 accepted root");
          assert.equal(preview.map.name, "Q8 accepted root map");
          assert.deepEqual(preview.tileset, reloaded.project.tilesets[preview.map.tilesetId]);
          const [mirrorName] = await sql.query(`SELECT map_json->>'name' FROM rpg_zzu.maps WHERE project_id=${literal(config.projectId)} AND map_id=${literal(mapId)};`);
          assert.equal(mirrorName, project.maps[mapId].name);
          await writeFile(resolve(evidence, "reload.json"), serialize(reloaded.project));
          await writeFile(resolve(evidence, "preview.json"), JSON.stringify(preview));
          await writeFile(resolve(evidence, "mirror-warning.json"), JSON.stringify({ accepted: saved, recovery,
            staleMirrorName: mirrorName, previewAndReloadCoherent: true }, null, 2));
        } finally { await sql.query("ALTER TABLE rpg_zzu.maps DROP CONSTRAINT task20_projection_failure;"); }
        break;
      }
      default: throw new TypeError(String(scenario satisfies never));
    }
  } finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    await store.flush();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else assert(Reflect.deleteProperty(globalThis, "window"));
  }
}
