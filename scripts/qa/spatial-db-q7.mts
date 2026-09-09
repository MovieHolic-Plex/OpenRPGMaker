import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deserialize, serialize } from "../../src/project/io";
import { captureRawLegacySnapshot, publishSpatialProject, readSpatialRootSnapshot } from "../../src/project/spatial/persistence";
import { convertLegacySpatialSnapshot } from "../../src/project/spatial/legacyImport";
import { proveMissingRpcGuard } from "./spatial-http-guard.mts";
import { spatialFixture } from "../../test/support/spatialSchemaFixture";
import { literal, SqlSession } from "./spatial-db-session.mts";
import { resumeHttp } from "./spatial-http-lock.mts";
import { guards, proveGuard, requireStatus } from "./spatial-db-guards.mts";
import type { postgrest } from "./spatial-postgrest.mts";

export type DatabaseSurface = Awaited<ReturnType<typeof postgrest>>;
export async function rawRequest(http: DatabaseSurface, target: string | { readonly path: string; readonly method: "PATCH" }, body: unknown) {
  const path = typeof target === "string" ? target : target.path;
  const method = typeof target === "string" ? "POST" : target.method;
  const response = await fetch(`${http.config.url}/rest/v1/${path}`, { method,
    headers: { Authorization: `Bearer ${http.config.anonKey}`, "Content-Profile": "rpg_zzu", "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  return { status: response.status, text };
}
export async function q7Guards(http: DatabaseSurface, evidence: string) {
  const fixture = spatialFixture();
  const project = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: fixture.document }));
  for (const [name, mutation] of Object.entries({ ...guards,
    "root-upsert": { ...guards.root, name: "pre-existing-upsert" } })) {
    if (name === "baseline") continue; // Q9 owns raw conversion.
    await proveGuard({ evidence, mutation }, async phase => {
      const id = `task20-${name}-${phase}`;
      const config = { ...http.config, projectId: id };
      const accepted = await publishSpatialProject({ operation: "create", project }, config);
      let response: { readonly status: number; readonly text: string };
      let expected: number;
      // Given a distinct canonical row per phase; When the forbidden operation is sent over HTTP.
      switch (name) {
        case "stale":
          response = await rawRequest(http, "rpc/publish_spatial_project", { p_project_id: id, p_operation: "update",
            p_expected_sha256: "0".repeat(64), p_project: { ...accepted.project, meta: { title: "stale B" } } });
          expected = 409; break;
        case "version":
          response = await rawRequest(http, "rpc/publish_spatial_project", { p_project_id: id, p_operation: "update",
            p_expected_sha256: accepted.serverSHA, p_project: { ...accepted.project, spatialAuthoring: { ...fixture.document, version: 2 } } });
          expected = 400; break;
        case "create":
          response = await rawRequest(http, "rpc/publish_spatial_project", { p_project_id: id, p_operation: "create",
            p_expected_sha256: null, p_project: { ...accepted.project, meta: { title: "duplicate B" } } });
          expected = 409; break;
        case "root": {
          const { spatialAuthoring: _marker, ...markerless } = accepted.project;
          response = await rawRequest(http, { path: `projects?project_id=eq.${id}`, method: "PATCH" }, { current_json: markerless });
          expected = 401; break;
        }
        case "root-upsert":
          response = await rawRequest(http, "projects?on_conflict=project_id", { project_id: id,
            title: "stale legacy upsert", schema_version: 4, current_json: fixture.project, current_sha256: "old-token",
            map_count: Object.keys(project.maps).length, tileset_count: Object.keys(project.tilesets).length, terrain_template_count: 0 });
          expected = 401; break;
        case "mirror":
          response = await rawRequest(http, "maps?on_conflict=project_id,map_id", { project_id: id, map_id: "m",
            name: "forbidden mirror", width: 1, height: 1, tileset_id: "t", lower_sha256: "x", upper_sha256: "y",
            lower_tile_count: 1, upper_tile_count: 1, map_json: { overwritten: true } });
          expected = 401; break;
        default: throw new TypeError(`Unknown guard ${name}`);
      }
      // Then rejection plus exact accepted root preservation, unchanged in RED and GREEN.
      requireStatus(response.status, expected);
      const reloaded = await readSpatialRootSnapshot(config);
      assert.deepEqual(reloaded?.rawRoot, accepted.project);
      assert.equal(reloaded.serverSHA, accepted.serverSHA);
      await writeFile(resolve(evidence, `${name}-reload.json`), JSON.stringify(reloaded.rawRoot));
    });
  }
  // Given a browser retained a pre-activation row. When it uses its original legacy upsert.
  const config = { ...http.config, projectId: "task20-pre-existing-client" };
  const oldClientRow = { project_id: config.projectId, title: "old client", schema_version: 4,
    current_json: fixture.project, current_sha256: "1".repeat(64), map_count: Object.keys(project.maps).length,
    tileset_count: Object.keys(project.tilesets).length, terrain_template_count: 0 };
  requireStatus((await rawRequest(http, "projects?on_conflict=project_id", oldClientRow)).status, 201);
  const oldClient = await readSpatialRootSnapshot(config); assert.equal(oldClient?.mode, "legacy");
  const capture = await captureRawLegacySnapshot(config); assert(capture);
  const converted = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
  const accepted = await publishSpatialProject({ operation: "activate", project: converted.raw, capture }, config);
  const stale = await rawRequest(http, "projects?on_conflict=project_id", oldClientRow);
  requireStatus(stale.status, 401);
  assert.deepEqual((await readSpatialRootSnapshot(config))?.rawRoot, accepted.project);
  // An unrelated legacy project still uses the actual legacy table API normally.
  const legacyId = "task20-unaffected-legacy";
  requireStatus((await rawRequest(http, "projects?on_conflict=project_id", { project_id: legacyId,
    title: "legacy before", schema_version: 4, current_json: fixture.project, current_sha256: "legacy-before",
    map_count: Object.keys(project.maps).length, tileset_count: Object.keys(project.tilesets).length, terrain_template_count: 0 })).status, 201);
  requireStatus((await rawRequest(http, { path: `projects?project_id=eq.${legacyId}`, method: "PATCH" }, { current_json: { ...fixture.project,
    meta: { ...fixture.project.meta, title: "legacy after" } }, current_sha256: "legacy-after" })).status, 200);
  await using sql = new SqlSession();
  assert.deepEqual(await sql.query(`SELECT current_json#>>'{meta,title}' FROM rpg_zzu.projects WHERE project_id=${literal(legacyId)};`), ["legacy after"]);
  // Given A has reserved a new ID; When B's HTTP create blocks on the same uniqueness lock.
  const duplicateId = "task20-http-duplicate";
  await sql.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
  await sql.query(`BEGIN; SELECT rpg_zzu.publish_spatial_project(${literal(duplicateId)},NULL,${literal(accepted.project)}::jsonb,'create');`);
  const duplicate = await resumeHttp(sql, http.pid, () => rawRequest(http, "rpc/publish_spatial_project", {
    p_project_id: duplicateId, p_operation: "create", p_expected_sha256: null, p_project: accepted.project }));
  assert(duplicate.result.kind === "accepted"); requireStatus(duplicate.result.value.status, 409);
  assert.deepEqual((await readSpatialRootSnapshot({ ...config, projectId: duplicateId }))?.rawRoot, accepted.project);
  await writeFile(resolve(evidence, "duplicate-create-overlap.json"), JSON.stringify(duplicate.proof, null, 2));
  // Given the RPC really disappears from this disposable schema, while the client's loaded root remains valid.
  await using admin = new SqlSession();
  await admin.query("ALTER FUNCTION rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb) RENAME TO task20_missing_publication;");
  try {
    const count = http.trace.length;
    await assert.rejects(publishSpatialProject({ operation: "update", project, serverSHA: accepted.serverSHA }, config), { code: "migration-required" });
    assert.equal(http.trace.length, count + 1, "Missing RPC must issue no direct-write fallback");
    assert.deepEqual((await readSpatialRootSnapshot(config))?.rawRoot, accepted.project);
    await proveMissingRpcGuard(http, evidence);
  } finally {
    await admin.query("ALTER FUNCTION rpg_zzu.task20_missing_publication(text,text,jsonb,text,jsonb) RENAME TO publish_spatial_project;");
  }
  await writeFile(resolve(evidence, "fixture.json"), serialize(project));
}
