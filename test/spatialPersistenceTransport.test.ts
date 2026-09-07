import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { deserialize, serialize } from "../src/project/io";
import { convertLegacySpatialSnapshot } from "../src/project/spatial/legacyImport";
import { captureRawLegacySnapshot, publishSpatialProject, readSpatialRootSnapshot, syncSpatialMirrors } from "../src/project/spatial/persistence";
import { emptySpatialDocument, spatialFixture } from "./support/spatialSchemaFixture";
import { legacyRawFixture } from "./support/spatialLegacyImportFixture";
import { createBlankProject } from "../src/project/defaults/defaultProject";
import { loadProjectForPersistenceProof, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { spatialPersistenceHttp } from "./support/spatialPersistenceHttp";

it("retains legacy map overlay semantics when a child differs from the root", async () => {
  // Given a legacy root plus a distinct child body over real loopback HTTP.
  await using http = await spatialPersistenceHttp();
  const root = createBlankProject();
  http.state.root = { ...root };
  http.state.maps = [{ map_id: root.startMapId, map_json: { ...root.maps[root.startMapId], name: "child-only" } }];
  // When the existing legacy proof loader reads it.
  const loaded = await loadProjectForPersistenceProof(http.config);
  // Then map rows override root maps and the original SHA accompanies the hybrid result.
  expect(loaded?.project.maps[root.startMapId].name).toBe("child-only");
  expect(loaded?.sha256).toBe(http.state.sha);
  expect(http.trace.map(call => call.path.split("?")[0])).toEqual(["/rest/v1/projects", "/rest/v1/maps"]);
});

it("characterizes legacy last-writer-wins when a stale full save follows a distinct edit", async () => {
  // Given two copies before the first legacy write, with different root edits.
  await using http = await spatialPersistenceHttp();
  const a = createBlankProject();
  const b = structuredClone(a);
  a.meta.title = "writer A";
  b.meta.title = "stale writer B";
  await saveProjectToSupabase(a, http.config);
  // When the stale copy uses the existing full-save adapter.
  await saveProjectToSupabase(b, http.config);
  // Then legacy POST is an unconditional upsert, not canonical CAS.
  expect(http.state.root?.meta).toEqual(b.meta);
  const roots = http.trace.filter(call => call.path.startsWith("/rest/v1/projects"));
  expect(roots).toHaveLength(2);
  expect(roots.every(call => call.method === "POST" && call.path.includes("on_conflict=project_id") && call.headers.prefer === "resolution=merge-duplicates,return=minimal")).toBe(true);
});

it("accepts an empty canonical library when create uses the RPC and server token", async () => {
  // Given a valid empty canonical project.
  await using http = await spatialPersistenceHttp();
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  // When the transport creates the project.
  const accepted = await publishSpatialProject({ operation: "create", project }, http.config);
  // Then the accepted raw document and server-issued token are returned, without mirror writes.
  expect(accepted).toMatchObject({ kind: "accepted", projectId: http.config.projectId, revision: 1, serverSHA: http.state.sha });
  expect(accepted.project).toEqual(JSON.parse(serialize(project)));
  expect(accepted.serverSHA).not.toBe(createHash("sha256").update(serialize(project)).digest("hex"));
  expect(http.trace).toHaveLength(1);
  expect(http.trace[0]).toMatchObject({ method: "POST", path: "/rest/v1/rpc/publish_spatial_project", headers: { "content-profile": "rpg_zzu" }, body: { p_operation: "create", p_expected_sha256: null, p_legacy_baseline: null } });
});

it("keeps stale B a conflict when A publishes a distinct canonical template", async () => {
  // Given two loaded copies with one original server token.
  await using http = await spatialPersistenceHttp();
  const fixture = spatialFixture();
  http.state.root = { ...fixture.project, spatialAuthoring: fixture.document };
  const a = await readSpatialRootSnapshot(http.config);
  const b = await readSpatialRootSnapshot(http.config);
  assert(a?.serverSHA && b?.serverSHA);
  assert(a.preview.spatialAuthoring && b.preview.spatialAuthoring);
  const edit = (project: typeof a.preview, name: string) => {
    assert(project.spatialAuthoring);
    const document = project.spatialAuthoring;
    const desk = document.library.objects.desk;
    return { ...project, spatialAuthoring: { ...document, library: { ...document.library, objects: { ...document.library.objects, desk: { ...desk, name } } } } };
  };
  const writerA = edit(a.preview, "accepted A");
  const writerB = edit(b.preview, "dirty B");
  await publishSpatialProject({ operation: "update", project: writerA, serverSHA: a.serverSHA }, http.config);
  const count = http.trace.length;
  // When stale B submits its retained baseline.
  const pending = publishSpatialProject({ operation: "update", project: writerB, serverSHA: b.serverSHA }, http.config);
  // Then one 409 remains a conflict; no fresh-token read, retry or upsert occurs.
  await expect(pending).rejects.toMatchObject({ code: "conflict", status: 409 });
  expect(http.trace.slice(count)).toHaveLength(1);
  expect(http.state.root?.spatialAuthoring).toEqual(writerA.spatialAuthoring);
  expect(writerB.spatialAuthoring.library.objects.desk.name).toBe("dirty B");
});

it("rejects a create collision when a root already exists", async () => {
  // Given an existing root and a different create payload.
  await using http = await spatialPersistenceHttp();
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  http.state.root = { ...project, meta: { ...project.meta, title: "existing" } };
  const before = structuredClone(http.state.root);
  // When create collides.
  const result = publishSpatialProject({ operation: "create", project }, http.config);
  // Then the existing root survives with one conflict response.
  await expect(result).rejects.toMatchObject({ code: "conflict", status: 409 });
  expect(http.state.root).toEqual(before);
  expect(http.trace).toHaveLength(1);
});

it("retains accepted root authority when mirror synchronization fails", async () => {
  // Given an accepted root with deliberately stale mirrors.
  await using http = await spatialPersistenceHttp();
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  const accepted = await publishSpatialProject({ operation: "create", project }, http.config);
  http.state.maps = [{ map_id: project.startMapId, map_json: { ...project.maps[project.startMapId], name: "stale mirror" } }];
  http.state.mirrorFailure = true;
  // When only the separate projection fails.
  const mirror = await syncSpatialMirrors(accepted, http.config);
  // Then acceptance remains usable and subsequent root-only read ignores the stale child.
  expect(mirror).toMatchObject({ status: "warning", error: { status: 503 } });
  expect(accepted.kind).toBe("accepted");
  const loaded = await readSpatialRootSnapshot(http.config);
  expect(loaded).toMatchObject({ mode: "canonical", serverSHA: accepted.serverSHA, rawRoot: accepted.project });
  expect(loaded?.preview.maps[project.startMapId].name).toBe(project.maps[project.startMapId].name);
  expect(http.trace.map(call => call.path.split("?")[0])).toEqual(["/rest/v1/rpc/publish_spatial_project", "/rest/v1/rpc/sync_spatial_mirrors", "/rest/v1/projects"]);
});

it("reports synced status when the mirror RPC acknowledges the accepted token", async () => {
  // Given an accepted revision.
  await using http = await spatialPersistenceHttp();
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  const accepted = await publishSpatialProject({ operation: "create", project }, http.config);
  // When the independent projection succeeds.
  const mirror = await syncSpatialMirrors(accepted, http.config);
  // Then only the accepted identity/token was submitted.
  expect(mirror).toEqual({ status: "synced" });
  expect(http.trace.at(-1)?.body).toEqual({ p_project_id: accepted.projectId, p_expected_sha256: accepted.serverSHA });
});

it("surfaces migration-required with zero fallback when the publication RPC is absent", async () => {
  // Given an old HTTP service without the RPC.
  await using http = await spatialPersistenceHttp();
  http.state.missingRpc = true;
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  // When publication is attempted.
  const result = publishSpatialProject({ operation: "create", project }, http.config);
  // Then the migration error is explicit and no legacy mutation follows.
  await expect(result).rejects.toMatchObject({ code: "migration-required", status: 404 });
  expect(http.trace).toHaveLength(1);
  expect(http.state.root).toBeNull();
});

it("captures untouched overlay JSON when normalization changes legacy shops and retired fields", async () => {
  // Given raw root, unknown fields, and newer child data.
  await using http = await spatialPersistenceHttp();
  const raw = legacyRawFixture();
  http.state.root = { ...raw.root, unknownLegacy: { empty: [], explicit: null } };
  http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  // When raw capture precedes normalization.
  const capture = await captureRawLegacySnapshot(http.config);
  // Then raw root, row bodies, and baseline remain independent from the repaired preview.
  assert(capture);
  expect(capture.rawRoot).toEqual(http.state.root);
  expect(capture.rawMapRows).toEqual(http.state.maps);
  expect(capture.baseline).toEqual({ ...raw.baseline, unknownLegacy: { empty: [], explicit: null } });
  expect(capture.preview.maps[raw.overlay.id].events).not.toEqual(raw.overlay.events);
  capture.preview.maps[raw.overlay.id].name = "preview-only";
  expect(capture.baseline).toEqual({ ...raw.baseline, unknownLegacy: { empty: [], explicit: null } });
});

it("uses ordinary JSON for baseline and activation when retired fields must survive", async () => {
  // Given raw legacy data captured before conversion.
  await using http = await spatialPersistenceHttp();
  const raw = legacyRawFixture();
  http.state.root = { ...raw.root, unknownLegacy: { kept: true } };
  http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  const capture = await captureRawLegacySnapshot(http.config);
  assert(capture);
  const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
  // When explicit activation publishes the converter's raw result.
  const accepted = await publishSpatialProject({ operation: "activate", project: conversion.raw, capture }, http.config);
  // Then baseline, raw shops, retired fields, and archive bytes survive the actual wire.
  expect(http.trace.at(-1)?.body).toEqual({ p_project_id: http.config.projectId, p_expected_sha256: capture.serverSHA, p_operation: "activate", p_legacy_baseline: capture.baseline, p_project: conversion.raw });
  expect(accepted.project).toEqual(conversion.raw);
  expect(accepted.preview.spatialAuthoring?.legacyImport.backup.json).toBe(JSON.stringify(capture.baseline));
});

it("conflicts on overlay races when root SHA is unchanged", async () => {
  // Given a capture followed by a map-row-only edit.
  await using http = await spatialPersistenceHttp();
  const raw = legacyRawFixture();
  http.state.root = raw.root;
  http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  const capture = await captureRawLegacySnapshot(http.config);
  assert(capture);
  const conversion = convertLegacySpatialSnapshot(JSON.stringify(capture.baseline));
  http.state.heldPath = "/rest/v1/rpc/publish_spatial_project";
  const received = http.requested();
  // When a map-row-only edit wins after the activation request arrives but before comparison.
  const pending = publishSpatialProject({ operation: "activate", project: conversion.raw, capture }, http.config);
  await received;
  http.state.maps = [{ map_id: raw.overlay.id, map_json: { ...raw.overlay, name: "concurrent overlay" } }];
  http.release();
  // Then baseline mismatch is a conflict, not a normalized force-save.
  await expect(pending).rejects.toMatchObject({ code: "conflict", status: 409 });
  expect(http.state.sha).toBe(capture.serverSHA);
  expect(http.state.root).toEqual(raw.root);
  expect(http.trace).toHaveLength(3);
});

it.each([null, { version: 1 }])("rejects malformed canonical markers on read instead of treating them as legacy: %j", async marker => {
  // Given a present but invalid marker.
  await using http = await spatialPersistenceHttp();
  http.state.root = { ...createBlankProject(), spatialAuthoring: marker };
  // When the root boundary reads it.
  const pending = readSpatialRootSnapshot(http.config);
  // Then no map fallback or implicit activation occurs.
  await expect(pending).rejects.toMatchObject({ code: "invalid-project" });
  expect(http.trace).toHaveLength(1);
});

it.each([[], {}, { project_id: "wrong", revision: 1, sha256: "a".repeat(64), project: {} }].map(response => ({ response })))("rejects malformed acceptance envelopes: $response", async ({ response }) => {
  // Given a malformed RPC success response.
  await using http = await spatialPersistenceHttp();
  http.state.responseOverride = response;
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  // When publication receives it.
  const pending = publishSpatialProject({ operation: "create", project }, http.config);
  // Then no accepted receipt is fabricated.
  await expect(pending).rejects.toMatchObject({ code: "invalid-response" });
  expect(http.trace).toHaveLength(1);
});

it.each(["old-version", "missing-sha"] as const)("surfaces an unsupported activation prerequisite: %s", async fault => {
  // Given raw input that cannot meet SQL activation requirements.
  await using http = await spatialPersistenceHttp();
  http.state.root = { ...createBlankProject(), version: fault === "old-version" ? 3 : 4 };
  if (fault === "missing-sha") http.state.sha = null;
  // When raw capture is requested.
  const pending = captureRawLegacySnapshot(http.config);
  // Then capture refuses before normalization can manufacture a saveable baseline.
  await expect(pending).rejects.toMatchObject({ code: fault === "old-version" ? "unsupported-legacy-version" : "sha-unavailable" });
  expect(http.trace).toHaveLength(1);
});

it("cancels an in-flight root read when the subscribed request barrier is reached", async () => {
  // Given a held HTTP response and subscriptions installed before triggering the read.
  await using http = await spatialPersistenceHttp();
  http.state.heldPath = "/rest/v1/projects";
  const received = http.requested();
  const controller = new AbortController();
  const pending = readSpatialRootSnapshot(http.config, controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await received;
  // When the caller cancels after the request arrived.
  controller.abort();
  // Then cancellation propagates without retry or fallback.
  await rejected;
  http.release();
});

it.each([0, 1.5, Number.MAX_SAFE_INTEGER + 1, null, "1"])("rejects invalid server revisions when the response otherwise matches: %j", async revision => {
  // Given a valid echoed project but an unusable revision.
  await using http = await spatialPersistenceHttp();
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  http.state.responseOverride = { project_id: http.config.projectId, revision, sha256: "a".repeat(64), project };
  // When the response crosses the publication boundary.
  const pending = publishSpatialProject({ operation: "create", project }, http.config);
  // Then the transport refuses an acceptance token it cannot represent exactly.
  await expect(pending).rejects.toMatchObject({ code: "invalid-response" });
});

it("rejects malformed returned canonical data when the receipt envelope is valid", async () => {
  // Given a correct identity, SHA and revision around an invalid marker.
  await using http = await spatialPersistenceHttp();
  const project = deserialize(JSON.stringify({ ...createBlankProject(), spatialAuthoring: emptySpatialDocument() }));
  http.state.responseOverride = { project_id: http.config.projectId, revision: 1, sha256: "a".repeat(64), project: { ...project, spatialAuthoring: null } };
  // When the returned canonical document is parsed.
  const pending = publishSpatialProject({ operation: "create", project }, http.config);
  // Then the transport refuses acceptance instead of returning a legacy preview.
  await expect(pending).rejects.toMatchObject({ code: "invalid-response" });
});

it("rejects invalid submitted references before HTTP when a referenced object was removed", async () => {
  // Given typed project data whose graph became invalid during editing.
  await using http = await spatialPersistenceHttp();
  const fixture = spatialFixture();
  const project = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: fixture.document }));
  assert(project.spatialAuthoring);
  project.spatialAuthoring = { ...project.spatialAuthoring, library: { ...project.spatialAuthoring.library, objects: {} } };
  // When publication validates the actual submitted document.
  const pending = publishSpatialProject({ operation: "create", project }, http.config);
  // Then invalid authoring cannot reach the root RPC.
  await expect(pending).rejects.toMatchObject({ code: "invalid-project" });
  expect(http.trace).toHaveLength(0);
});
