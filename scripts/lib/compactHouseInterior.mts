import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { spatialId, checkedDocument } from "../../src/project/spatial/domain";
import type { Project, SectionStructureKitDef } from "../../src/project/types";
import type { SpaceDesign } from "../../src/project/spatial/types";
import { houseObjectForGraphic } from "./houseSpatialCatalog.mts";

export const COMPACT_INTERIOR_SPACE = "house-catalog:room:single";
export const COMPACT_INTERIOR_PLACE = "house-catalog:place:cottage";
export const COMPACT_INTERIOR_OCCURRENCE = "compact-interior:example:cottage";
/** One small household, sized from its furniture and a connected one-cell aisle. */
export function registerCompactHouseInterior(input: Project): Project {
  const project = structuredClone(input),
    document = project.spatialAuthoring;
  assert.ok(document);
  const tilesetId = "easyrpg_chipset_interior",
    tileset = project.tilesets[tilesetId]!;
  // The old imported cabinet puts both transparent pieces on the lower layer.
  // Register a reviewed assembly instead of rewriting existing kits/placed maps.
  const kitId = "compact-interior:cabinet";
  const kit: SectionStructureKitDef = {
    id: kitId,
    kind: "section",
    name: "작은 집 수납장",
    width: 1,
    height: 2,
    learnedFrom: "db-authored",
    rows: [
      { tiles: [-1], upperTiles: [148] },
      { tiles: [-1], upperTiles: [178] },
    ],
  };
  tileset.structureKits = [
    ...(tileset.structureKits ?? []).filter((k) => k.id !== kitId),
    kit,
  ];
  document.library.objects[kitId] = {
    id: spatialId(kitId),
    name: "작은 집 수납장",
    revision: 1,
    tags: ["작은 실내", "수납"],
    provenance: { origin: "ai" },
    graphic: { tilesetId, kitId },
    anchors: [],
    chips: [],
  };
  const stoveId = "compact-interior:wall-stove";
  const stove: SectionStructureKitDef = {
    id: stoveId,
    kind: "section",
    name: "벽 받침이 있는 화덕",
    width: 1,
    height: 2,
    learnedFrom: "db-authored",
    rows: [
      { tiles: [105], upperTiles: [21] },
      { tiles: [51], upperTiles: [-1] },
    ],
  };
  tileset.structureKits = [
    ...(tileset.structureKits ?? []).filter((k) => k.id !== stoveId),
    stove,
  ];
  document.library.objects[stoveId] = {
    id: spatialId(stoveId),
    name: "벽 받침이 있는 화덕",
    revision: 1,
    tags: ["작은 실내", "취사", "벽 받침 포함"],
    provenance: { origin: "ai" },
    graphic: { tilesetId, kitId: stoveId },
    anchors: [],
    chips: [],
  };
  // Native wall assemblies: north arm has a ceiling and two-row cream face;
  // south arm joins the south shell. The one-cell opening stays bare floor.
  const partitionIds = [
    "compact-interior:partition-north",
    "compact-interior:partition-south",
  ];
  for (const [index, tiles] of [
    [430, 77, 107],
    [430, 430],
  ].entries()) {
    const id = partitionIds[index]!;
    tileset.structureKits = [
      ...(tileset.structureKits ?? []).filter((k) => k.id !== id),
      {
        id,
        kind: "section",
        name: index === 0 ? "침실 칸막이 · 북쪽" : "침실 칸막이 · 남쪽",
        width: 1,
        height: tiles.length,
        learnedFrom: "db-authored",
        rows: tiles.map((tile) => ({ tiles: [tile], upperTiles: [-1] })),
      },
    ];
    document.library.objects[id] = {
      id: spatialId(id),
      name: index === 0 ? "침실 칸막이 · 북쪽" : "침실 칸막이 · 남쪽",
      revision: 1,
      tags: ["작은 실내", "칸막이", "벽"],
      provenance: { origin: "ai" },
      graphic: { tilesetId, kitId: id },
      anchors: [],
      chips: [],
    };
  }
  const slot = (key: string, object: string, x: number, y: number) => ({
    id: spatialId(key),
    quantity: 1,
    required: true,
    objectDesignId: [kitId, stoveId, ...partitionIds].includes(object)
      ? spatialId(object)
      : houseObjectForGraphic(project, tilesetId, object)!.id,
    placement: { mode: "fixed" as const, x, y },
  });
  const old = document.library.spaces[COMPACT_INTERIOR_SPACE];
  assert.ok(old);
  const room: SpaceDesign = {
    ...old,
    name: "작은 단층집 · 취사·식사·수면",
    width: 8,
    height: 6,
    shape: "rect",
    floor: "wood",
    wall: "cream",
    tags: [
      "주택",
      "실내",
      "소형 기준",
      "바닥 8×6",
      "통합 거실·주방",
      "벽으로 분리된 침실",
      "침실 출입구 1칸",
      "1칸 이상 통로",
    ],
    ports: [{ id: spatialId("entry"), name: "현관", x: 3, y: 5 }],
    objectSlots: [
      slot("partition-north", partitionIds[0]!, 4, 0),
      slot("partition-south", partitionIds[1]!, 4, 4),
      slot("stove", stoveId, 0, 0),
      slot("dishes", kitId, 1, 0),
      slot("water", "jars", 2, 1),
      slot("meal", "table_chairs", 0, 3),
      slot("bed", "bed_v", 6, 0),
      slot("wardrobe", kitId, 7, 3),
      slot("bedside", "jars", 5, 0),
      slot("plant", "plant", 0, 5),
    ],
  };
  document.library.spaces[room.id] = {
    ...room,
    revision: isDeepStrictEqual(
      { ...old, revision: 1 },
      { ...room, revision: 1 },
    )
      ? old.revision
      : old.revision + 1,
  };
  // Existing single-floor places already reference this same space identity.
  project.spatialAuthoring = checkedDocument(document, project);
  return project;
}
