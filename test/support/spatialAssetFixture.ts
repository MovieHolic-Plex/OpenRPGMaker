import { createBlankProject } from "@/project/defaults/defaultProject";
import { EASYRPG_INTERIOR_TILESET_ID as INTERIOR_TILESET_ID } from "@/project/mapCreateSpec";
import type { StructureKitDef, TilesetDef } from "@/project/types";
import baseline from "../fixtures/spatial/interiorCatalogBaseline.json";
import { designBase, emptySpatialDocument } from "./spatialSchemaFixture";

export function spatialAssetFixture() {
  const project = createBlankProject();
  const interior = project.tilesets[INTERIOR_TILESET_ID];
  if (!interior) throw new Error("Missing default interior atlas");
  interior.structureKits = [];
  delete interior.scratchConceptBundles;
  const document = { ...emptySpatialDocument(), library: {
    ...emptySpatialDocument().library,
    objects: Object.fromEntries(baseline.catalog.map(entry => [entry.id, {
      ...designBase(entry.id), graphic: { tilesetId: interior.id, kitId: entry.id }, anchors: [], chips: [],
    }])),
  } };
  return { project, interior, document };
}

export const authoredGraphics: readonly StructureKitDef[] = [
  { id: "bed_h", kind: "section", width: 1, height: 1, rows: [{ tiles: [72], upperTiles: [405] }], learnedFrom: "user-paint" },
  // Deliberately malformed section dimensions: never swap this authored record for a builtin.
  { id: "bed_h", kind: "section", width: 0, height: 1, rows: [], learnedFrom: "user-paint" },
];

/** 제거된 파라메트릭 집 킷(kind:"house")의 저장 잔재 — 인터트 레코드. untyped stored data로만 존재한다. */
export const legacyInertHouseKit: Readonly<Record<string, unknown>> = {
  id: "bed_h", kind: "house", houseKitId: "historical-house",
  wings: [{ x: 0, y: 0, w: 4, h: 4 }], learnedFrom: "user-paint",
};

export const ineligibleAtlases: readonly { readonly name: string; readonly change: Partial<TilesetDef> }[] = [
  { name: "uploaded-lookalike", change: { image: { type: "uploaded", id: "tex_easyrpg_chipset_interior" } } },
  { name: "wrong-bundled-image", change: { image: { type: "bundled", id: "tex_easyrpg_chipset_dungeon" } } },
  { name: "near-image-name", change: { image: { type: "bundled", id: "tex_easyrpg_chipset_interior_copy" } } },
  { name: "custom-kind", change: { kind: "custom" } },
  { name: "tile-size", change: { tileSize: 32 } },
  { name: "column-count", change: { tilesPerRow: 15 } },
  { name: "tile-count", change: { count: 479 } },
  { name: "grafted", change: { tileGrafts: [{ targetTile: 355, sourceChipset: "tex_easyrpg_chipset_dungeon", sourceTile: 1 }] } },
];
