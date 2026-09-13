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
  const bedsideId = "compact-interior:bedside-table";
  tileset.structureKits = [
    ...(tileset.structureKits ?? []).filter((k) => k.id !== bedsideId),
    {
      id: bedsideId,
      kind: "section",
      name: "침대 옆 작은 탁자",
      width: 1,
      height: 1,
      learnedFrom: "db-authored",
      rows: [{ tiles: [-1], upperTiles: [328] }],
    },
  ];
  document.library.objects[bedsideId] = {
    id: spatialId(bedsideId),
    name: "침대 옆 작은 탁자",
    revision: 1,
    tags: ["작은 실내", "침실", "협탁"],
    provenance: { origin: "ai" },
    graphic: { tilesetId, kitId: bedsideId },
    anchors: [],
    chips: [],
  };
  const diningId = "compact-interior:single-dining";
  tileset.structureKits = [
    ...(tileset.structureKits ?? []).filter((k) => k.id !== diningId),
    {
      id: diningId,
      kind: "section",
      name: "작은 집 1인 식탁",
      width: 2,
      height: 1,
      learnedFrom: "db-authored",
      rows: [{ tiles: [-1, -1], upperTiles: [328, 298] }],
    },
  ];
  document.library.objects[diningId] = {
    id: spatialId(diningId),
    name: "작은 집 1인 식탁",
    revision: 1,
    tags: ["작은 실내", "식사", "1인용"],
    provenance: { origin: "ai" },
    graphic: { tilesetId, kitId: diningId },
    anchors: [],
    chips: [],
  };
  const slot = (key: string, object: string, x: number, y: number) => ({
    id: spatialId(key),
    quantity: 1,
    required: true,
    objectDesignId: [kitId, stoveId, bedsideId, diningId].includes(object)
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
    interiorLayout: {
      rooms: [
        {
          id: spatialId("living-kitchen"),
          name: "거실·주방",
          x: 0,
          y: 0,
          width: 5,
          height: 6,
        },
        {
          id: spatialId("bedroom"),
          name: "침실",
          x: 5,
          y: 0,
          width: 3,
          height: 6,
        },
      ],
      doorways: [{ x: 4, y: 3 }],
    },
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
      slot("stove", stoveId, 0, 0),
      slot("dishes", kitId, 1, 0),
      slot("water", "jars", 2, 0),
      slot("meal", diningId, 1, 4),
      slot("bed", "bed_v", 7, 0),
      slot("wardrobe", kitId, 7, 4),
      slot("bedside", bedsideId, 6, 0),
      slot("plant", "plant", 5, 0),
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
