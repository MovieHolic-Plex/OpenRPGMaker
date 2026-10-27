import { describe, expect, it } from "vitest";
import { INTERIOR_OBJECT_CATALOG } from "@/project/defaults/interiorObjectCatalog";
import * as editorCatalog from "@/editor/interiorObjectCatalog";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { resolveSpatialGraphic } from "@/project/spatial/assets";
import { snapshotGraphic } from "@/project/spatial/snapshotRaster";
import { SpatialOperationError } from "@/project/spatial/domain";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { validateSpatialReferences } from "@/project/spatial/references";
import baseline from "./fixtures/spatial/interiorCatalogBaseline.json";
import { authoredGraphics, ineligibleAtlases, legacyInertHouseKit, spatialAssetFixture } from "./support/spatialAssetFixture";
import { emptySpatialDocument, spatialFixture, spatialWire } from "./support/spatialSchemaFixture";

describe("qualified live spatial graphic resolution", () => {
  it("returns the single shared records when every builtin ID resolves", () => {
    // Given
    const { project, interior } = spatialAssetFixture();
    const before = JSON.stringify(project);
    // When
    const resolved = baseline.catalog.map(object => resolveSpatialGraphic(project, { tilesetId: interior.id, kitId: object.id }));
    // Then
    expect(resolved).toStrictEqual(baseline.catalog.map(object => ({ source: "builtin", object })));
    expect(editorCatalog.INTERIOR_OBJECT_CATALOG).toBe(INTERIOR_OBJECT_CATALOG);
    resolved.forEach((entry, index) => {
      if (!entry) throw new Error("Expected resolved builtin");
      switch (entry.source) {
        case "builtin": expect(entry.object).toBe(INTERIOR_OBJECT_CATALOG[index]); break;
        case "authored": throw new Error("Unexpected authored kit");
        default: entry satisfies never;
      }
    });
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each(authoredGraphics)("returns authored $kind without fallback when the stored record overrides a builtin", kit => {
    // Given
    const { project, interior, document } = spatialAssetFixture();
    interior.structureKits = [structuredClone(kit)];
    const before = JSON.stringify(project);
    // When
    const results = [serialize, serializePretty].map(write => {
      const loaded = deserialize(write(deserialize(spatialWire(project, document))));
      return resolveSpatialGraphic(loaded, { tilesetId: interior.id, kitId: kit.id });
    });
    // Then
    expect(results).toStrictEqual([{ source: "authored", kit }, { source: "authored", kit }]);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("keeps a stored kind:'house' record as inert authored data — resolves without fallback, refuses to rasterize", () => {
    // Given: a leftover record of the removed parametric house-kit concept in stored data.
    const { project, interior } = spatialAssetFixture();
    interior.structureKits = [structuredClone(legacyInertHouseKit) as never];
    const graphic = { tilesetId: interior.id, kitId: "bed_h" };
    // When / Then: the stored record still wins over the builtin catalog entry…
    expect(resolveSpatialGraphic(project, graphic)).toStrictEqual({ source: "authored", kit: legacyInertHouseKit });
    // …but the removed kind cannot produce cells.
    expect(() => snapshotGraphic(project, graphic)).toThrow(SpatialOperationError);
  });

  it("keeps authored precedence when the atlas is ineligible for builtins", () => {
    // Given
    const { project, interior } = spatialAssetFixture();
    const kit = authoredGraphics[0];
    if (!kit) throw new Error("Missing authored fixture");
    interior.kind = "custom";
    interior.structureKits = [kit];
    // When
    const result = resolveSpatialGraphic(project, { tilesetId: interior.id, kitId: kit.id });
    // Then
    expect(result).toStrictEqual({ source: "authored", kit });
  });

  it.each(["empty", "missing", "partial"] as const)("resolves missing IDs on eligible aliases when kits are %s", state => {
    // Given
    const { project, interior } = spatialAssetFixture();
    const alias = { ...structuredClone(interior), id: " unrelated alias ", name: "not an interior name", tileGrafts: [] };
    delete alias.kind;
    switch (state) {
      case "empty": alias.structureKits = []; break;
      case "missing": delete alias.structureKits; break;
      case "partial": alias.structureKits = [{ id: "other", kind: "section", width: 1, height: 1, rows: [{ tiles: [72] }], learnedFrom: "user-paint" }]; break;
      default: state satisfies never;
    }
    project.tilesets[alias.id] = alias;
    // When
    const result = resolveSpatialGraphic(project, { tilesetId: alias.id, kitId: "stove" });
    // Then
    expect(result).toStrictEqual({ source: "builtin", object: baseline.catalog.find(object => object.id === "stove") });
  });

  it.each(ineligibleAtlases)("rejects fallback when the atlas is $name", ({ change }) => {
    // Given
    const { project, interior, document } = spatialAssetFixture();
    project.tilesets[interior.id] = { ...interior, ...change };
    const before = JSON.stringify(project);
    // When
    const resolve = () => validateSpatialReferences(validateSpatialAuthoring(document), project);
    // Then
    expect(resolve).toThrow("graphic.kitId");
    expect(resolveSpatialGraphic(project, { tilesetId: interior.id, kitId: "bed_h" })).toBeUndefined();
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each(["unknown", "constructor", "__proto__"])("rejects unknown kit %s without object prototype lookup", kitId => {
    // Given
    const { project, interior } = spatialAssetFixture();
    // When
    const result = resolveSpatialGraphic(project, { tilesetId: interior.id, kitId });
    // Then
    expect(result).toBeUndefined();
  });

  it.each(["absent", "constructor", "__proto__"])("requires an owned project tileset when its key is %s", tilesetId => {
    // Given
    const { project } = spatialAssetFixture();
    // When
    const result = resolveSpatialGraphic(project, { tilesetId, kitId: "bed_h" });
    // Then
    expect(result).toBeUndefined();
  });

  it("uses frozen mixed-layer cells when the live atlas is ineligible and the kit no longer exists", () => {
    // Given
    const { project, document, tilesetId } = spatialFixture();
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("Missing fixture atlas");
    tileset.structureKits = [];
    tileset.kind = "custom";
    const frozen = document.occurrences["occ-a"].snapshot.kitCells.desk;
    frozen.cells = [{ x: 0, y: 0, layer: "lower", tile: 72 }, { x: 0, y: 0, layer: "upper", tile: 405 }];
    const input = { ...document, library: emptySpatialDocument().library };
    // When
    const loaded = deserialize(serialize(deserialize(spatialWire(project, input))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(input);
  });

  it("still validates stored cells when a frozen snapshot contains an out-of-atlas tile", () => {
    // Given
    const { project, document, tilesetId } = spatialFixture();
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("Missing fixture atlas");
    document.occurrences["occ-a"].snapshot.kitCells.desk.cells = [{ x: 0, y: 0, layer: "upper", tile: tileset.count }];
    // When
    const load = () => deserialize(spatialWire(project, document));
    // Then
    expect(load).toThrow("kitCells.desk.cells[0].tile");
  });
});
