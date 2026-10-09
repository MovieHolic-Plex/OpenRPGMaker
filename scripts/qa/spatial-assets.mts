import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { INTERIOR_OBJECT_CATALOG } from "../../src/project/defaults/interiorObjectCatalog";
import { interiorVocabTiles } from "../../src/project/defaults/interiorVocabulary";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../../src/project/io";
import { resolveSpatialGraphic } from "../../src/project/spatial/assets";
import { inspectLegacySpatialConstraints, type LegacySpatialConstraintInspection } from "../../src/project/spatial/legacyConstraints";
import type { InteriorRoomKindRecord } from "../../src/project/types";
import baseline from "../../test/fixtures/spatial/interiorCatalogBaseline.json";
import { authoredGraphics, ineligibleAtlases, spatialAssetFixture } from "../../test/support/spatialAssetFixture";
import { designBase, emptySpatialDocument, spatialFixture, spatialWire } from "../../test/support/spatialSchemaFixture";

const { values } = parseArgs({ options: { evidence: { type: "string", default: "output/evidence/tile-to-world/task-29" } } });
const output = resolve(values.evidence);
const sandbox = await mkdtemp(join(tmpdir(), "spatial-asset-proof-"));
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const inspections: LegacySpatialConstraintInspection[] = [];
const failures: { readonly scenario: string; readonly diagnostic: string }[] = [];
try {
  // Given: actual legacy atlas, empty raw kits, missing bundles. No converter/materialization.
  const { project, interior, document } = spatialAssetFixture();
  const raw = JSON.stringify(project);
  const sourcePath = join(sandbox, "source.json");
  await writeFile(sourcePath, raw);
  assert.deepEqual({ catalog: INTERIOR_OBJECT_CATALOG, vocabulary: interiorVocabTiles() }, baseline);
  const graphics = [];
  for (const [format, write] of [["compact", serialize], ["pretty", serializePretty]] as const) {
    const loaded = deserialize(spatialWire(project, document));
    const path = join(sandbox, `${format}.json`);
    await writeFile(path, write(loaded));
    const reloaded = deserialize(await readFile(path, "utf8"));
    assert.deepEqual(reloaded.spatialAuthoring, document);
    assert.deepEqual(reloaded.tilesets[interior.id]?.structureKits, []);
    assert.equal(Object.hasOwn(reloaded.tilesets[interior.id] ?? {}, "scratchConceptBundles"), false);
    for (const expected of baseline.catalog) {
      const resolved = resolveSpatialGraphic(reloaded, { tilesetId: interior.id, kitId: expected.id });
      assert.ok(resolved);
      switch (resolved.source) {
        case "builtin":
          assert.deepEqual(resolved.object, expected);
          if (format === "compact") graphics.push({ id: expected.id, width: expected.width, height: expected.height, cells: resolved.object.cells, sha256: digest(JSON.stringify(resolved.object)) });
          break;
        case "authored": assert.fail("Raw empty kits must use the builtin source");
        default: resolved satisfies never;
      }
    }
  }
  for (const kit of authoredGraphics) {
    const authored = structuredClone(project);
    const atlas = authored.tilesets[interior.id];
    assert.ok(atlas);
    atlas.structureKits = [structuredClone(kit)];
    const before = JSON.stringify(authored);
    const loaded = deserialize(serialize(deserialize(spatialWire(authored, document))));
    assert.deepEqual(resolveSpatialGraphic(loaded, { tilesetId: interior.id, kitId: kit.id }), { source: "authored", kit });
    // Fallback is per missing ID even when an unsupported stored kit is present.
    assert.equal(resolveSpatialGraphic(loaded, { tilesetId: interior.id, kitId: "stove" })?.source, "builtin");
    assert.equal(JSON.stringify(authored), before);
  }
  for (const state of ["empty", "missing", "partial"] as const) {
    const alias = { ...structuredClone(interior), id: " unrelated alias ", name: "Unrelated", tileGrafts: [] };
    delete alias.kind;
    switch (state) {
      case "empty": alias.structureKits = []; break;
      case "missing": delete alias.structureKits; break;
      case "partial": alias.structureKits = structuredClone([...authoredGraphics.slice(0, 1)]); break;
      default: state satisfies never;
    }
    const aliased = { ...project, tilesets: { ...project.tilesets, [alias.id]: alias } };
    const aliasDocument = { ...document, library: { ...document.library, objects: {
      alias: { ...designBase("alias"), graphic: { tilesetId: alias.id, kitId: "stove" }, anchors: [], chips: [] },
    } } };
    const loaded = deserialize(serialize(deserialize(spatialWire(aliased, aliasDocument))));
    assert.deepEqual(resolveSpatialGraphic(loaded, { tilesetId: alias.id, kitId: "stove" }), { source: "builtin", object: baseline.catalog.find(object => object.id === "stove") });
  }
  for (const { name, change } of ineligibleAtlases) {
    const atlas = { ...interior, ...change };
    // Keep the ordinary tileset shape valid so this proves graphic eligibility, not array length validation.
    atlas.passability = atlas.passability.slice(0, atlas.count);
    atlas.priority = atlas.priority.slice(0, atlas.count);
    atlas.terrain = atlas.terrain.slice(0, atlas.count);
    if (atlas.tileMeta) atlas.tileMeta = atlas.tileMeta.slice(0, atlas.count);
    // The shortened synthetic atlas cannot retain default tile groups referencing its removed cell.
    if (change.count !== undefined) atlas.tileGroups = [];
    const altered = { ...project, tilesets: { ...project.tilesets, [interior.id]: atlas } };
    const before = JSON.stringify(altered);
    assert.equal(resolveSpatialGraphic(altered, { tilesetId: interior.id, kitId: "bed_h" }), undefined);
    assert.throws(() => deserialize(spatialWire(altered, document)), (error: unknown) => {
      assert.ok(error instanceof ProjectFormatError);
      assert.match(error.message, /graphic\.kitId/);
      failures.push({ scenario: name, diagnostic: error.message });
      return true;
    });
    assert.equal(JSON.stringify(altered), before);
  }
  for (const kitId of ["unknown", "constructor", "__proto__"]) {
    const invalid = { ...document, library: { ...document.library, objects: {
      unknown: { ...designBase("unknown"), graphic: { tilesetId: interior.id, kitId }, anchors: [], chips: [] },
    } } };
    assert.throws(() => deserialize(spatialWire(project, invalid)), ProjectFormatError);
    assert.equal(resolveSpatialGraphic(project, { tilesetId: interior.id, kitId }), undefined);
  }
  assert.equal(resolveSpatialGraphic({ tilesets: {} }, { tilesetId: interior.id, kitId: "bed_h" }), undefined);
  const record: InteriorRoomKindRecord = { id: " room ", label: " label\n", requiredRoles: [" custom ", " custom ", ""], suggestedModifiers: ["", " mood ", " mood "], walkway: false };
  for (const roomKinds of [undefined, [], [{ tilesetId: " historical atlas ", record }, { tilesetId: " historical atlas ", record }], [{ tilesetId: "", record: { id: "", label: "", requiredRoles: [] } }]]) {
    const input = { ...document, legacyImport: { ...document.legacyImport, ...(roomKinds === undefined ? {} : { roomKinds }) } };
    const before = JSON.stringify(input);
    for (const write of [serialize, serializePretty]) {
      const loaded = deserialize(write(deserialize(spatialWire(project, input))));
      assert.ok(loaded.spatialAuthoring);
      assert.deepEqual(loaded.spatialAuthoring.legacyImport, input.legacyImport);
      const view = inspectLegacySpatialConstraints(loaded.spatialAuthoring.legacyImport);
      assert.deepEqual(view, { kind: "legacy-compatibility-constraints", ...(roomKinds === undefined ? {} : { roomKinds }) });
      inspections.push(view);
    }
    assert.equal(JSON.stringify(input), before);
  }
  const frozen = spatialFixture();
  const frozenAtlas = frozen.project.tilesets[frozen.tilesetId];
  assert.ok(frozenAtlas);
  frozenAtlas.structureKits = [];
  frozenAtlas.kind = "custom";
  const frozenDocument = { ...frozen.document, library: emptySpatialDocument().library };
  assert.deepEqual(deserialize(serialize(deserialize(spatialWire(frozen.project, frozenDocument)))).spatialAuthoring, frozenDocument);
  assert.equal(JSON.stringify(project), raw);
  const sourceAfter = await readFile(sourcePath, "utf8");
  assert.equal(sourceAfter, raw);
  await mkdir(output, { recursive: true });
  const report = { verdict: "passed", base: "b3a508b3ececfeae2c7826cccbe732a43c50063f", executedHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), builtinGraphics: graphics.length, graphics,
    authoredOverrides: authoredGraphics.length, eligibleAliases: 3, rejectedAtlases: failures.length, failures, rejectedUnknownIds: 3,
    inspections, frozenSnapshotIndependent: true, sourceUnchanged: true, sourceSha256: digest(raw), sourceAfterSha256: digest(sourceAfter),
    converterImplemented: false, remoteWrites: 0, ports: [], temporaryFiles: "removed in finally" };
  await writeFile(join(output, "assets.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ verdict: report.verdict, builtinGraphics: report.builtinGraphics, evidence: join(output, "assets.json"), inspections }));
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
