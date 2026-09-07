import "./spatial-local-only.mjs";
import assert from "node:assert/strict";
import { runSpatialStoreScenario } from "./spatial-store-scenarios.mts";
import { runSpatialActivationScenario } from "./spatial-activation-scenarios.mts";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { deserialize, serialize } from "../../src/project/io";
import { convertLegacySpatialSnapshot } from "../../src/project/spatial/legacyImport";
import { captureRawLegacySnapshot, publishSpatialProject, readSpatialRootSnapshot, syncSpatialMirrors } from "../../src/project/spatial/persistence";
import { legacyRawFixture } from "../../test/support/spatialLegacyImportFixture";
import { spatialFixture } from "../../test/support/spatialSchemaFixture";
import { spatialPersistenceHttp, type HttpExchange } from "../../test/support/spatialPersistenceHttp";

// No URL/credential flags or environment defaults. Q7/Q8 require explicit local-only consent.
const { values } = parseArgs({ options: { scenario: { type: "string" }, evidence: { type: "string" }, project: { type: "string" }, "local-only": { type: "boolean" } }, strict: true });
assert(values.scenario === "transport" || values.scenario === "stale-writers" || values.scenario === "mirror-failure"
  || values.scenario === "activation-dirty-before" || values.scenario === "activation-edit-during"
  || values.scenario === "activation-composition-during" || values.scenario === "activation-changed-target");
const evidence = resolve(values.evidence ?? "output/evidence/tile-to-world/task-6/transport");
await mkdir(evidence, { recursive: true });
const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (values.scenario !== "transport") {
  assert.equal(values["local-only"], true, "Q7/Q8 are loopback-only: pass --local-only");
  switch (values.scenario) {
    case "stale-writers": case "mirror-failure":
      await runSpatialStoreScenario({ scenario: values.scenario, projectId: values.project ?? "transport-fixture", evidence, sourceSHA });
      break;
    case "activation-dirty-before": case "activation-edit-during": case "activation-composition-during": case "activation-changed-target":
      await runSpatialActivationScenario({ scenario: values.scenario, projectId: values.project ?? "transport-fixture", evidence, sourceSHA });
      break;
    default: throw new TypeError(String(values.scenario satisfies never));
  }
} else {
const traces: { readonly scenario: string; readonly url: string; readonly exchanges: readonly HttpExchange[]; readonly lifecycle: { readonly closed: boolean } }[] = [];
const checks: string[] = [];
const fixture = spatialFixture();
const project = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: fixture.document }));
const fixtureDigest = createHash("sha256").update(serialize(project)).digest("hex");

try {
  {
    // Given two independently loaded copies from a locally created canonical project.
    await using http = await spatialPersistenceHttp();
    traces.push({ scenario: "canonical", url: http.config.url, exchanges: http.trace, lifecycle: http.lifecycle });
    const created = await publishSpatialProject({ operation: "create", project }, http.config);
    assert.notEqual(created.serverSHA, fixtureDigest);
    const a = await readSpatialRootSnapshot(http.config);
    const b = await readSpatialRootSnapshot(http.config);
    assert(a?.serverSHA && b?.serverSHA && a.preview.spatialAuthoring && b.preview.spatialAuthoring);
    a.preview.spatialAuthoring = { ...a.preview.spatialAuthoring, library: { ...a.preview.spatialAuthoring.library,
      objects: { ...a.preview.spatialAuthoring.library.objects, desk: { ...a.preview.spatialAuthoring.library.objects.desk, name: "accepted A" } } } };
    b.preview.spatialAuthoring = { ...b.preview.spatialAuthoring, library: { ...b.preview.spatialAuthoring.library,
      objects: { ...b.preview.spatialAuthoring.library.objects, desk: { ...b.preview.spatialAuthoring.library.objects.desk, name: "dirty B" } } } };
    // When A publishes and stale B submits its distinct edit with the original token.
    const accepted = await publishSpatialProject({ operation: "update", project: a.preview, serverSHA: a.serverSHA }, http.config);
    await assert.rejects(publishSpatialProject({ operation: "update", project: b.preview, serverSHA: b.serverSHA }, http.config), { code: "conflict", status: 409 });
    // Then B remains distinct and no successful root mutation follows A.
    assert.equal(b.preview.spatialAuthoring.library.objects.desk.name, "dirty B");
    assert.deepEqual(http.state.root, accepted.project);
    checks.push("create", "server-issued-token-differs-from-local-serialization", "distinct-stale-writer-conflict");

    // Given the same target already exists. When create collides. Then its root survives.
    await assert.rejects(publishSpatialProject({ operation: "create", project }, http.config), { code: "conflict", status: 409 });
    assert.deepEqual(http.state.root, accepted.project);
    checks.push("create-collision");

    // Given stale map mirrors. When projection fails. Then root-only read still returns A.
    http.state.maps = [{ map_id: project.startMapId, map_json: { ...project.maps[project.startMapId], name: "stale mirror" } }];
    http.state.mirrorFailure = true;
    assert.equal((await syncSpatialMirrors(accepted, http.config)).status, "warning");
    const reloaded = await readSpatialRootSnapshot(http.config);
    assert.equal(reloaded?.mode, "canonical");
    assert.deepEqual(reloaded.rawRoot, accepted.project);
    assert.equal(reloaded.serverSHA, accepted.serverSHA);
    assert.equal(reloaded.preview.maps[project.startMapId].name, project.maps[project.startMapId].name);
    checks.push("mirror-warning-retains-accepted-root", "root-only-read");

    // Given the RPC disappears. When update is attempted. Then no retry or fallback is issued.
    http.state.missingRpc = true;
    const count = http.trace.length;
    await assert.rejects(publishSpatialProject({ operation: "update", project: a.preview, serverSHA: accepted.serverSHA }, http.config), { code: "migration-required" });
    assert.equal(http.trace.length, count + 1);
    assert.deepEqual(http.state.root, accepted.project);
    checks.push("missing-rpc-zero-fallback");
  }
  {
    // Given raw legacy fields and a shop command supplied by a newer child row.
    await using http = await spatialPersistenceHttp();
    traces.push({ scenario: "raw-activation", url: http.config.url, exchanges: http.trace, lifecycle: http.lifecycle });
    const legacy = legacyRawFixture();
    http.state.root = { ...legacy.root, unknownLegacy: { explicitNull: null, empty: [] } };
    http.state.maps = [{ map_id: legacy.overlay.id, map_json: legacy.overlay }];
    const capture = await captureRawLegacySnapshot(http.config);
    assert(capture);
    assert.notDeepEqual(capture.preview.maps[legacy.overlay.id].events, legacy.overlay.events);
    const converted = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
    http.state.heldPath = "/rest/v1/rpc/publish_spatial_project";
    const received = http.requested();
    // When the overlay changes after activation arrives but before the server compares it.
    const activation = publishSpatialProject({ operation: "activate", project: converted.raw, capture }, http.config);
    await received;
    http.state.maps = [{ map_id: legacy.overlay.id, map_json: { ...legacy.overlay, name: "overlay race winner" } }];
    http.release();
    // Then SHA equality alone cannot force activation.
    await assert.rejects(activation, { code: "conflict", status: 409 });
    assert.equal(http.state.sha, capture.serverSHA);
    checks.push("raw-overlay-race-conflict", "normalized-preview-distinct-from-raw");

    // Given an explicit fresh capture/conversion (not an adapter retry).
    http.state.heldPath = "";
    const fresh = await captureRawLegacySnapshot(http.config);
    assert(fresh);
    const conversion = convertLegacySpatialSnapshot(JSON.stringify(fresh.baseline));
    // When the caller explicitly activates the fresh raw conversion.
    const accepted = await publishSpatialProject({ operation: "activate", project: conversion.raw, capture: fresh }, http.config);
    // Then ordinary JSON preserves raw fields and archive bytes on the wire and receipt.
    assert.deepEqual(accepted.project, conversion.raw);
    assert.deepEqual(http.trace.at(-1)?.body, { p_project_id: http.config.projectId, p_expected_sha256: fresh.serverSHA,
      p_operation: "activate", p_project: conversion.raw, p_legacy_baseline: fresh.baseline });
    assert.equal(accepted.preview.spatialAuthoring?.legacyImport.backup.json, JSON.stringify(fresh.baseline));
    checks.push("ordinary-json-activation", "raw-shop-retired-unknown-fields-preserved", "opaque-archive-preserved");
  }
} finally {
  // Both using scopes close all connections and await each owned server's close callback.
  await writeFile(resolve(evidence, "http.json"), JSON.stringify({ sourceSHA, fixtureDigest, localOnly: true,
    sqlAuthorizationOrLockingProven: false, checks, traces }, null, 2));
  await writeFile(resolve(evidence, "cleanup.json"), JSON.stringify({ sourceSHA,
    serversClosed: traces.filter(trace => trace.lifecycle.closed).map(trace => trace.url),
    serversAwaitingClose: traces.filter(trace => !trace.lifecycle.closed).map(trace => trace.url),
    remoteCalls: 0, databaseResourcesCreated: 0, browserResourcesCreated: 0, temporarySandboxesCreated: 0 }, null, 2));
}
process.stdout.write(`${JSON.stringify({ sourceSHA, scenario: "transport", passed: checks, evidence, localOnly: true })}\n`);
}
