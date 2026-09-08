import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { CONCEPT_FLOOR_TILES, conceptFacilityLevels, layoutConceptFacility } from "../../src/editor/conceptBundleResolve";
import { CONCEPT_FACILITY_TEMPLATES } from "../../src/project/defaults/conceptFacilityTemplates";
import { INTERIOR_OBJECT_CATALOG } from "../../src/project/defaults/interiorObjectCatalog";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../../src/project/io";
import { createProjectPackage, readProjectPackage } from "../../src/project/package";
import { resolveSpatialGraphic } from "../../src/project/spatial/assets";
import { convertLegacySpatialSnapshot, legacySpatialId } from "../../src/project/spatial/legacyImport";
import type { ConceptBundleRecord } from "../../src/project/types";
import { customLegacyBundle, customLegacyKit, customLegacyRaw } from "../../test/fixtures/spatial/legacyImportMatrix";
import { legacyRawFixture } from "../../test/support/spatialLegacyImportFixture";
import { collisionBundle, malformedKits, regressionRaw } from "../../test/fixtures/spatial/legacyImportRegressions";
import { canonicalGraphicRaw, canonicalKitFaults, liveGraphicOwners, retiredGraphicRaw } from "../../test/fixtures/spatial/legacyCanonicalReentry";

const { values } = parseArgs({ options: { scenario: { type: "string" }, evidence: { type: "string", default: "output/evidence/tile-to-world/task-4/implementation-v4" } } });
assert.equal(values.scenario, "legacy-matrix");
const output = resolve(values.evidence);
await mkdir(output, { recursive: true });
const raw = legacyRawFixture();
const custom = customLegacyRaw();
const empty = { ...raw.baseline, tilesets: { ...raw.baseline.tilesets, [raw.tilesetId]: { ...raw.baseline.tilesets[raw.tilesetId], scratchConceptBundles: [], interiorRoomKinds: [] } } };
const cases = [
  { name: "missing", json: raw.json, bundles: CONCEPT_FACILITY_TEMPLATES },
  { name: "empty", json: JSON.stringify(empty), bundles: [] },
  { name: "custom", json: JSON.stringify(custom), bundles: [customLegacyBundle] },
  { name: "collision", json: JSON.stringify(regressionRaw({ scratchConceptBundles: [collisionBundle] })), bundles: [collisionBundle] },
];
const reports = [];
for (const scenario of cases) {
  // Given: raw bytes are captured before any repair/normalization.
  const baseline = JSON.parse(scenario.json);
  // When: explicit conversion is the only activation boundary exercised here.
  const converted = convertLegacySpatialSnapshot(scenario.json);
  // Then: transformed values, not merely marker presence or archive-only storage.
  const document = converted.raw.spatialAuthoring;
  assert.ok(document, "Explicit legacy conversion must produce canonical designs, not only contract probes");
  const { spatialAuthoring: _document, ...originalFields } = converted.raw;
  assert.deepEqual(originalFields, baseline);
  assert.equal(document.legacyImport.backup.json, scenario.json);
  assert.equal(document.legacyImport.backup.sha256, createHash("sha256").update(scenario.json).digest("hex"));
  assert.deepEqual(convertLegacySpatialSnapshot(JSON.stringify(converted.raw)).raw, converted.raw);
  const deleted = { ...converted.raw, spatialAuthoring: { ...document, library: { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} } } };
  assert.deepEqual(convertLegacySpatialSnapshot(JSON.stringify(deleted)).raw, deleted);
  assert.equal(new Set(document.legacyImport.mapping.map(entry => entry.sourceKey)).size, document.legacyImport.mapping.length);
  const graphics = Object.values(document.library.objects).map(object => {
    const resolved = resolveSpatialGraphic(converted.preview, object.graphic);
    assert.ok(resolved);
    return { id: object.id, name: object.name, graphic: object.graphic, resolved };
  });
  const keys = document.legacyImport.mapping.map(entry => JSON.parse(entry.sourceKey));
  const inventory = { objects: keys.filter(tuple => tuple[2] === "object").length, facilities: keys.filter(tuple => tuple[2] === "facility").length, spaces: keys.filter(tuple => tuple[2] === "place").length };
  switch (scenario.name) {
    case "missing":
      assert.deepEqual(inventory, { objects: 55, facilities: 19, spaces: 59 });
      for (const object of INTERIOR_OBJECT_CATALOG) {
        const design = document.library.objects[legacySpatialId([raw.tilesetId, "", "object", object.id])];
        assert.ok(design);
        assert.deepEqual(resolveSpatialGraphic(converted.preview, design.graphic), { source: "builtin", object });
      }
      break;
    case "empty": assert.deepEqual(document.library.places, {}); assert.deepEqual(document.library.spaces, {}); break;
    case "custom":
      assert.deepEqual(inventory, { objects: 2, facilities: 4, spaces: 10 });
      for (const tilesetId of [raw.tilesetId, "alias/\"same"]) {
        const design = document.library.objects[legacySpatialId([tilesetId, customLegacyBundle.id, "thing", "clock"])];
        assert.ok(design);
        assert.deepEqual(resolveSpatialGraphic(converted.preview, design.graphic), { source: "authored", kit: customLegacyKit });
      }
      break;
    case "collision": {
      const facility = document.library.places[legacySpatialId([raw.tilesetId, collisionBundle.id, "facility", "room"])];
      const child = facility?.children[0];
      assert.ok(child);
      const fallback = document.library.spaces[child.source.id];
      const original = document.library.spaces[legacySpatialId([raw.tilesetId, collisionBundle.id, "place", "room"])];
      assert.ok(fallback && original);
      assert.notEqual(fallback.id, original.id);
      assert.equal(fallback.name, facility.name);
      assert.deepEqual(fallback.objectSlots, []);
      assert.equal(original.floor, "mat");
      assert.equal(original.objectSlots.length, 1);
      break;
    }
    default: throw new TypeError(`Unknown QA scenario ${scenario.name}`);
  }
  const qualifiedTilesets = scenario.name === "custom" ? [raw.tilesetId, "alias/\"same"] : [raw.tilesetId];
  for (const tilesetId of qualifiedTilesets) for (const bundle of scenario.bundles) {
    for (const thing of bundle.things) {
      const design = document.library.objects[legacySpatialId([tilesetId, bundle.id, "thing", thing.id])];
      assert.ok(design);
      assert.equal(design.name, thing.label);
      assert.deepEqual(design.chips, thing.chips);
      assert.deepEqual(design.graphic, { tilesetId, kitId: thing.objectId });
    }
    for (const place of bundle.places) {
      const space = document.library.spaces[legacySpatialId([tilesetId, bundle.id, "place", place.id])];
      assert.ok(space);
      const things = bundle.things.filter(thing => thing.placeIds.includes(place.id)).sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)));
      assert.deepEqual(space.objectSlots.map(slot => ({ id: slot.objectDesignId, required: slot.required, quantity: slot.quantity, chips: slot.chipOverrides })), things.map(thing => ({ id: legacySpatialId([tilesetId, bundle.id, "thing", thing.id]), required: Boolean(thing.required), quantity: 1, chips: thing.chips })));
      assert.equal(space.name, place.label);
    }
    checkLayouts({ bundle, tilesetId, document });
  }
  const expectedConstraints = Object.entries(converted.preview.tilesets).flatMap(([tilesetId, tileset]) => (tileset.interiorRoomKinds ?? []).map(record => ({ tilesetId, record })));
  assert.deepEqual(converted.inspection, { kind: "legacy-compatibility-constraints", roomKinds: expectedConstraints });
  const archiveResults = [];
  for (const serializer of [serialize, serializePretty]) {
    const serialized = serializer(converted.preview);
    const reloaded = deserialize(serialized);
    assert.deepEqual(reloaded.spatialAuthoring, document);
    assert.deepEqual(deserialize(serializer(reloaded)).spatialAuthoring, document);
    assert.deepEqual(convertLegacySpatialSnapshot(serialized).raw.spatialAuthoring, document);
    archiveResults.push({ serializer: serializer.name, canonicalAndArchivePreserved: true });
    await writeFile(resolve(output, `${scenario.name}-${serializer.name}.json`), serialized);
  }
  const packaged = createProjectPackage(converted.preview);
  const imported = await readProjectPackage(packaged);
  assert.deepEqual(imported.spatialAuthoring, document);
  const normalizedShop = converted.preview.maps[raw.overlay.id]?.events[0]?.pages?.[0]?.commands[0];
  assert.notDeepEqual(normalizedShop, raw.overlay.events[0]?.pages[0]?.commands[0]);
  reports.push({ scenario: scenario.name, inventory, rawBeforeAfterDiff: [], normalizedShop, archiveResults, packageRoundtrip: true, repeatedConversionIdempotent: true, deletedDefinitionsRestored: false, mapping: document.legacyImport.mapping });
  await Promise.all([
    writeFile(resolve(output, `${scenario.name}-raw-before.json`), scenario.json),
    writeFile(resolve(output, `${scenario.name}-converted-raw.json`), JSON.stringify(converted.raw, null, 2)),
    writeFile(resolve(output, `${scenario.name}-normalized-preview.json`), JSON.stringify(converted.preview, null, 2)),
    writeFile(resolve(output, `${scenario.name}-inspection.json`), JSON.stringify({ constraints: converted.inspection, library: document.library, graphics }, null, 2)),
    writeFile(resolve(output, `${scenario.name}.oprn`), new Uint8Array(await packaged.arrayBuffer())),
  ]);
}
const rejections = [];
for (const fault of ["unknown-graphic", "wrong-atlas", "unknown-place"] as const) {
  const input = customLegacyRaw();
  const tileset = input.tilesets[raw.tilesetId];
  const thing = tileset.scratchConceptBundles[0]?.things[0];
  assert.ok(thing);
  switch (fault) {
    case "unknown-graphic": thing.objectId = "missing-graphic"; break;
    case "wrong-atlas": tileset.structureKits = []; tileset.image = { type: "bundled", id: "chipset/FSM_ChipSet_01.png" }; break;
    case "unknown-place": thing.placeIds = ["missing-place"]; break;
    default: fault satisfies never;
  }
  const before = JSON.stringify(input);
  assert.throws(() => convertLegacySpatialSnapshot(before), error => {
    assert.ok(error instanceof ProjectFormatError);
    assert.match(error.message, /unavailable graphic|unknown place/);
    rejections.push({ fault, diagnostic: error.message, sourceUnchanged: true });
    return true;
  });
  assert.equal(JSON.stringify(input), before);
}
const malformedInputs = malformedKits.map(({ fault, kit, field }) => ({ fault, input: regressionRaw({ structureKits: [kit] }), path: `${JSON.stringify([raw.tilesetId, "", "object", "clock"])}.${field}` }));
malformedInputs.push({ fault: "unknown-facility-layout", input: regressionRaw({ scratchConceptBundles: [{ ...collisionBundle, facilities: [{ id: "room", label: "Empty facility", placeIds: [], layout: "spiral" }] }] }), path: `${JSON.stringify([raw.tilesetId, collisionBundle.id, "facility", "room"])}.layout` });
for (const { fault, input, path } of malformedInputs) {
  // Given / When / Then: raw boundary rejection, including authoritative malformed overrides.
  const before = JSON.stringify(input);
  assert.throws(() => convertLegacySpatialSnapshot(before), error => {
    assert.ok(error instanceof ProjectFormatError);
    assert.ok(error.message.includes(path), error.message);
    rejections.push({ fault, diagnostic: error.message, sourceUnchanged: true });
    return true;
  });
  assert.equal(JSON.stringify(input), before);
  await writeFile(resolve(output, `${fault.replaceAll(" ", "-")}-rejected-raw.json`), before);
}
for (const owner of liveGraphicOwners) for (const { fault, kit, field } of canonicalKitFaults) {
  // Given: canonical live owners are edits independent of the historical mapping.
  const input = canonicalGraphicRaw(owner, kit);
  const before = JSON.stringify(input);
  const name = `canonical-${owner}-${fault.replaceAll(" ", "-")}`;
  await writeFile(resolve(output, `${name}-input.json`), before);
  // When / Then: no partial success or builtin substitution on canonical re-entry.
  assert.throws(() => convertLegacySpatialSnapshot(before), error => {
    assert.ok(error instanceof ProjectFormatError);
    assert.ok(error.message.includes(`${JSON.stringify([raw.tilesetId, "", "object", "clock"])}.${field}`), error.message);
    rejections.push({ fault: name, diagnostic: error.message, sourceUnchanged: true });
    return true;
  });
  assert.equal(JSON.stringify(input), before);
}
const canonicalPreservation = [...liveGraphicOwners.map(owner => {
  const input = canonicalGraphicRaw(owner, customLegacyKit);
  input.tilesets[raw.tilesetId].structureKits.push({ ...customLegacyKit, width: -1 }, { ...customLegacyKit, id: "retired", width: -1 });
  return { name: `canonical-${owner}-edited`, input };
}), { name: "canonical-frozen-retired", input: retiredGraphicRaw() }];
for (const { name, input } of canonicalPreservation) {
  const before = JSON.stringify(input);
  const result = convertLegacySpatialSnapshot(before);
  assert.deepEqual(result.raw, JSON.parse(before));
  assert.deepEqual(convertLegacySpatialSnapshot(JSON.stringify(result.raw)).raw, result.raw);
  assert.deepEqual((await readProjectPackage(createProjectPackage(result.preview))).spatialAuthoring, input.spatialAuthoring);
  assert.equal(JSON.stringify(input), before);
  await writeFile(resolve(output, `${name}-preserved.json`), JSON.stringify(result.raw, null, 2));
}
if (process.env["SPATIAL_TEST_DATABASE_URL"]) {
  const { activateMatrix } = await import("./spatial-db-q9.mts");
  await activateMatrix(cases, output);
}
const report = { scenario: "legacy-matrix", status: "passed", converterImplemented: true, canonicalPreservation: canonicalPreservation.map(({ name }) => name), laneSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), remoteWrites: 0, reports, rejections, unverified: process.env["SPATIAL_TEST_DATABASE_URL"] ? ["deployed authorization and browser pixels"] : ["activation RPC and concurrent remote writers (separate persistence task)"] };
await writeFile(resolve(output, "conversion-diff.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ scenario: report.scenario, status: report.status, cases: reports.map(entry => ({ scenario: entry.scenario, inventory: entry.inventory })), rejections, evidence: output }));

function checkLayouts(input: { readonly bundle: ConceptBundleRecord; readonly tilesetId: string; readonly document: ReturnType<typeof convertLegacySpatialSnapshot>["raw"]["spatialAuthoring"] }): void {
  const { bundle, tilesetId, document } = input;
  for (const facility of bundle.facilities) {
    const levels = conceptFacilityLevels(bundle, facility);
    const multi = levels.length > 1;
    const minBandWidth = multi ? Math.max(...levels.map(level => Math.max(0, ...layoutConceptFacility(bundle, facility, { level }).rooms.filter(room => room.role !== "room").map(room => room.w)))) : 0;
    const expected = levels.flatMap(level => layoutConceptFacility(bundle, facility, multi ? { level, minBandWidth } : {}).rooms.map(room => ({ level, x: room.x, y: room.y, width: room.w, height: room.h, role: room.role, shape: room.shape ?? "rect", floorTile: room.floorTile ?? CONCEPT_FLOOR_TILES.wood, wall: facility.wall ?? "cream" })));
    const place = document.library.places[legacySpatialId([tilesetId, bundle.id, "facility", facility.id])];
    assert.ok(place);
    assert.equal(place.name, facility.label);
    assert.equal(place.layout, facility.layout ?? "row");
    assert.deepEqual(place.children.map(child => {
      const space = document.library.spaces[child.source.id];
      assert.ok(space);
      return { level: child.level, x: child.x, y: child.y, width: space.width, height: space.height, role: space.environment === "interior" ? space.role : undefined, shape: space.shape, floorTile: CONCEPT_FLOOR_TILES[space.floor], wall: space.wall };
    }), expected);
  }
}
