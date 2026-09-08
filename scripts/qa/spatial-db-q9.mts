import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serialize, deserialize } from "../../src/project/io";
import { createProjectPackage, readProjectPackage } from "../../src/project/package";
import { convertLegacySpatialSnapshot } from "../../src/project/spatial/legacyImport";
import { captureRawLegacySnapshot, publishSpatialProject, readSpatialRootSnapshot } from "../../src/project/spatial/persistence";
import { rawObject } from "../../src/project/spatial/persistenceWire";
import { legacyRawFixture } from "../../test/support/spatialLegacyImportFixture";
import { literal, SqlSession } from "./spatial-db-session.mts";
import { guards, proveGuard, requireStatus } from "./spatial-db-guards.mts";
import { rawRequest, type DatabaseSurface } from "./spatial-db-q7.mts";
import { resumeHttp } from "./spatial-http-lock.mts";
import { postgrest } from "./spatial-postgrest.mts";

async function seed(id: string, json: string) {
  const raw = rawObject(JSON.parse(json));
  const fixture = legacyRawFixture();
  const map = fixture.overlay;
  await using sql = new SqlSession();
  await sql.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
  await sql.query(`INSERT INTO rpg_zzu.projects(project_id,title,schema_version,current_json,current_sha256,map_count,tileset_count,terrain_template_count)
    VALUES(${literal(id)},'raw legacy',4,${literal(raw)}::jsonb,${literal("1".repeat(64))},${Object.keys(rawObject(raw.maps)).length},${Object.keys(rawObject(raw.tilesets)).length},1);
    INSERT INTO rpg_zzu.maps(project_id,map_id,name,width,height,tileset_id,lower_sha256,upper_sha256,lower_tile_count,upper_tile_count,map_json)
    VALUES(${literal(id)},${literal(map.id)},${literal(map.name)},${map.width},${map.height},${literal(map.tilesetId)},'lower','upper',${map.lowerTiles.length},${map.upperTiles.length},${literal(map)}::jsonb);`);
}
export async function activateMatrix(cases: readonly { readonly name: string; readonly json: string }[], evidence: string) {
  await using http = await postgrest(evidence);
  const receipts = [];
  for (const item of cases) {
    const config = { ...http.config, projectId: `task20-matrix-${item.name}` };
    await seed(config.projectId, item.json);
    // Given raw HTTP capture, separate normalized preview, scoped IDs and retained retired fields.
    const capture = await captureRawLegacySnapshot(config); assert(capture);
    assert.deepEqual(capture.baseline, JSON.parse(item.json));
    const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
    // When the actual activation RPC accepts the raw conversion.
    const accepted = await publishSpatialProject({ operation: "activate", project: conversion.raw, capture }, config);
    // Then exact raw data, archive bytes, package/save/reload and canonical idempotence survive.
    assert.deepEqual(accepted.project, conversion.raw);
    const { spatialAuthoring, ...rawFields } = conversion.raw;
    assert.deepEqual(rawFields, capture.baseline);
    assert.equal(spatialAuthoring.legacyImport.backup.json, JSON.stringify(capture.baseline));
    const reloaded = await readSpatialRootSnapshot(config); assert(reloaded);
    assert.deepEqual(reloaded.rawRoot, conversion.raw);
    assert.deepEqual(convertLegacySpatialSnapshot(JSON.stringify(reloaded.rawRoot)).raw, conversion.raw);
    assert.deepEqual(deserialize(serialize(reloaded.preview)).spatialAuthoring, spatialAuthoring);
    assert.deepEqual((await readProjectPackage(createProjectPackage(reloaded.preview))).spatialAuthoring, spatialAuthoring);
    assert(reloaded.mode === "canonical");
    const saved = await publishSpatialProject({ operation: "update", project: reloaded.preview, serverSHA: reloaded.serverSHA }, config);
    const savedReload = await readSpatialRootSnapshot(config); assert(savedReload);
    assert.deepEqual(savedReload.preview.spatialAuthoring?.legacyImport.backup, spatialAuthoring.legacyImport.backup);
    assert.deepEqual(convertLegacySpatialSnapshot(JSON.stringify(saved.project)).raw, saved.project);
    receipts.push({ name: item.name, capture, accepted, saved, rawDiff: [], archiveSHA: spatialAuthoring.legacyImport.backup.sha256 });
  }
  await writeFile(resolve(evidence, "activation-receipts.json"), JSON.stringify(receipts, null, 2));
  await conversionRaces(http, evidence);
}
async function conversionRaces(http: DatabaseSurface, evidence: string) {
  const fixture = legacyRawFixture();
  await proveGuard({ evidence, mutation: guards.baseline }, async phase => {
    const config = { ...http.config, projectId: `task20-map-race-${phase}` };
    await seed(config.projectId, fixture.json);
    const capture = await captureRawLegacySnapshot(config); assert(capture);
    const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
    await using holder = new SqlSession();
    await holder.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
    // Given a pre-existing converter plus legacy map-only writer holding the same parent lock.
    await holder.query(`BEGIN; UPDATE rpg_zzu.maps SET map_json=jsonb_set(map_json,'{name}','"newer map B"') WHERE project_id=${literal(config.projectId)};`);
    // When HTTP activation blocks, then resumes the SAME query after the writer commits.
    const { result, proof } = await resumeHttp(holder, http.pid, () => rawRequest(http, "rpc/publish_spatial_project", {
      p_project_id: config.projectId, p_expected_sha256: capture.serverSHA, p_operation: "activate",
      p_project: conversion.raw, p_legacy_baseline: capture.baseline }));
    assert(result.kind === "accepted");
    await writeFile(resolve(evidence, `map-first-${phase}-overlap.json`), JSON.stringify(proof, null, 2));
    requireStatus(result.value.status, 409);
    assert.equal((await readSpatialRootSnapshot(config))?.mode, "legacy");
    assert.equal((await captureRawLegacySnapshot(config))?.preview.maps[fixture.overlay.id].name, "newer map B");
  });
  {
    const config = { ...http.config, projectId: "task20-root-first" };
    await seed(config.projectId, fixture.json);
    const capture = await captureRawLegacySnapshot(config); assert(capture);
    const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
    await using holder = new SqlSession();
    await holder.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
    await holder.query(`BEGIN; UPDATE rpg_zzu.projects SET current_sha256=${literal("2".repeat(64))},current_json=current_json || '{"authored":"newer root B"}' WHERE project_id=${literal(config.projectId)};`);
    const { result, proof } = await resumeHttp(holder, http.pid, () => rawRequest(http, "rpc/publish_spatial_project", {
      p_project_id: config.projectId, p_expected_sha256: capture.serverSHA, p_operation: "activate",
      p_project: conversion.raw, p_legacy_baseline: capture.baseline }));
    assert(result.kind === "accepted"); requireStatus(result.value.status, 409);
    assert.equal((await readSpatialRootSnapshot(config))?.rawRoot.authored, "newer root B");
    await writeFile(resolve(evidence, "root-first-overlap.json"), JSON.stringify(proof, null, 2));
  }
  {
    const config = { ...http.config, projectId: "task20-activation-first" };
    await seed(config.projectId, fixture.json);
    const capture = await captureRawLegacySnapshot(config); assert(capture);
    const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
    await using holder = new SqlSession();
    await holder.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
    await holder.query(`BEGIN; SELECT rpg_zzu.publish_spatial_project(${literal(config.projectId)},${literal(capture.serverSHA)},${literal(conversion.raw)}::jsonb,'activate',${literal(capture.baseline)}::jsonb);`);
    const { result, proof } = await resumeHttp(holder, http.pid, () => rawRequest(http,
      { path: `maps?project_id=eq.${config.projectId}`, method: "PATCH" }, { map_json: { overwritten: true } }));
    assert(result.kind === "accepted"); requireStatus(result.value.status, 401);
    assert.deepEqual((await readSpatialRootSnapshot(config))?.rawRoot, conversion.raw);
    await writeFile(resolve(evidence, "activation-first-overlap.json"), JSON.stringify(proof, null, 2));
  }
}
