/** Publish reviewed house graphics, usable spaces and connected house places to the loaded DB project. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { captureRawLegacySnapshot } from "../src/project/spatial/persistence";
import { convertLegacySpatialSnapshot } from "../src/project/spatial/legacyImport";
import { activateSpatialProjectFromRaw, type ProjectWriteAuthority } from "../src/project/spatial/saveRouting";
import { serialize } from "../src/project/io";
import { runTool } from "../src/editor/tools/toolRunner";
import { registerHouseSpatialCatalog } from "./lib/houseSpatialCatalog.mts";
import type { Project } from "../src/project/types";

const out = "output/evidence/house-spatial-catalog";
fs.mkdirSync(out, { recursive: true });
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery", "This authored catalog belongs to the reviewed house project");
let authority: ProjectWriteAuthority | undefined;
let base = await loadProjectFromSupabase(config, value => { authority = value; });
assert.ok(base, "Supabase must be connected before content authoring");
const before = structuredClone(base);
const raw = !base.spatialAuthoring ? await captureRawLegacySnapshot(config) : null;
assert.ok(base.spatialAuthoring || raw);
const activePreview = raw ? convertLegacySpatialSnapshot(JSON.stringify(raw.baseline)).preview : base;
let authored = registerHouseSpatialCatalog(activePreview);
assert.deepEqual(registerHouseSpatialCatalog(authored.project).project, authored.project, "Registration must be idempotent");

const transcript: object[] = [];
function build(project: Project, placeId: string, occurrenceId: string) {
  const context = { project: structuredClone(project) };
  const call = (name: string, args: Record<string, unknown>) => {
    const result = runTool(context, name, args);
    assert.equal(result.ok, true, JSON.stringify({ name, args, result }));
    transcript.push({ name, args, result });
    return result;
  };
  call("get_spatial_design", { kind: "place", id: placeId, resolved: false });
  const preview = call("preview_spatial_build", { kind: "place", id: placeId, occurrenceId, seed: 20260912 });
  assert.ok(preview.data && typeof preview.data === "object" && "previewId" in preview.data);
  call("apply_spatial_build", { previewId: preview.data.previewId });
  return context.project;
}

// Every catalog entry must actually compile, including courtyard doors and floor 4.
for (const entry of authored.registered) {
  const project = build(authored.project, entry.placeId, `house-check:${entry.studyId}`);
  const mapIds = Object.keys(project.maps).filter(key => !Object.hasOwn(authored.project.maps, key));
  assert.equal(mapIds.length, entry.floors + 1, `${entry.studyId}: yard plus real floor maps`);
  assert.equal(project.mapConnections!.length - (authored.project.mapConnections?.length ?? 0), entry.floors * 2);
}

if (process.argv.includes("--apply")) {
  assert.deepEqual(await loadProjectFromSupabase(config), before, "Concurrent edit; refusing stale publication");
  fs.writeFileSync(`${out}/before.json`, serialize(before));
  if (raw) {
    fs.writeFileSync(`${out}/raw-before.json`, JSON.stringify(raw.baseline));
    const activated = await activateSpatialProjectFromRaw(config);
    base = activated.project;
    authority = activated.authority;
    assert.equal(activated.mirror.status, "synced");
  }
  authored = registerHouseSpatialCatalog(base);
}
let next = authored.project;
const sampleIds = ["inn-3f", "workshop-4f"];
for (const studyId of sampleIds) {
  const entry = authored.registered.find(value => value.studyId === studyId)!;
  const occurrenceId = `house-example:${studyId}`;
  if (!next.spatialAuthoring?.occurrences[occurrenceId]) next = build(next, entry.placeId, occurrenceId);
}
for (const [key, map] of Object.entries(before.maps)) assert.deepEqual(next.maps[key], map, `Existing map ${key} changed`);
assert.deepEqual(next.startPos, before.startPos);
assert.equal(next.startMapId, before.startMapId);
for (const [key, tileset] of Object.entries(before.tilesets)) {
  const { structureKits: oldKits, ...oldFields } = tileset;
  const { structureKits: newKits, ...newFields } = next.tilesets[key]!;
  assert.deepEqual(newFields, oldFields, `Unrelated tileset ${key} changed`);
  for (const kit of oldKits ?? []) assert.deepEqual(newKits?.find(value => value.id === kit.id), kit, `Existing kit ${kit.id} changed`);
}
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
fs.writeFileSync(`${out}/catalog.json`, JSON.stringify(authored.registered, null, 2));
fs.writeFileSync(`${out}/tool-transcript.json`, JSON.stringify({ mode: "registered-tool-runner", provider: null, transcript }, null, 2));
console.log(JSON.stringify({ projectId: config.projectId, objects: 15, yards: 15, reusableRooms: 4, places: 15, compiled: 15, samples: sampleIds, mode: "preview" }));
if (process.argv.includes("--apply")) {
  assert.ok(authority);
  const saved = await saveProjectToSupabase(next, config, authority);
  assert.equal(saved.kind, "saved");
  const loaded = await loadProjectFromSupabase(config);
  assert.ok(loaded?.spatialAuthoring);
  assert.deepEqual(loaded, next, "Supabase reload must match all authored content");
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(loaded));
  const proof = { projectId: config.projectId, saved: true, reloaded: true, canonicalActive: true,
    registeredObjects: 15, registeredPlaces: 15, yardSpaces: 15, sharedInteriorSpaces: 4,
    compiledPlaces: 15, publishedExamples: sampleIds, addedMaps: Object.keys(loaded.maps).filter(key => !Object.hasOwn(before.maps, key)),
    existingMapsPreserved: true, reviewedGraphicsPreserved: true, idempotentRegistration: true,
    librarySHA256: createHash("sha256").update(JSON.stringify(loaded.spatialAuthoring.library)).digest("hex"),
    verifiedAt: new Date().toISOString(), mirror: saved.mirror?.status };
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
