import { describe, expect, it } from "vitest";

import { INTERIOR_OBJECT_CATALOG, interiorObjectById } from "@/editor/interiorObjectCatalog";
import {
  INTERIOR_ROOM_TILESET_ID,
  runInteriorRoomPipeline,
  VR,
} from "@/editor/interiorRoomPipeline";
import {
  interiorObjectFromKit,
  interiorRoomKindSource,
  isInteriorFurnitureKit,
  kindsDerivedFromConceptBundles,
  resolveInteriorRoomVocab,
  seedInteriorTilesetCatalog,
} from "@/editor/interiorRoomVocab";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { DEFAULT_TILE_SIZE } from "@/project/defaults/constants";
import type { TilesetDef } from "@/project/types";

function emptyInteriorTileset(): TilesetDef {
  return {
    id: INTERIOR_ROOM_TILESET_ID,
    name: "실내",
    image: { type: "bundled", id: "tex_easyrpg_chipset_interior" },
    tileSize: DEFAULT_TILE_SIZE,
    tilesPerRow: 6,
    count: 480,
    passability: [],
    priority: [],
    terrain: [],
  };
}

describe("실내 가구·방 종류 타일셋 어휘", () => {
  it("시드하면 카탈로그 가구가 타일셋 structureKits 로 들어가고 왕복해도 셀이 같다", () => {
    const tileset = emptyInteriorTileset();
    expect(seedInteriorTilesetCatalog(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS)).toBe(true);
    expect(tileset.interiorRoomKinds?.map((kind) => kind.id)).toEqual(BUILTIN_INTERIOR_ROOM_KINDS.map((kind) => kind.id));
    const bedKit = tileset.structureKits?.find((kit) => kit.id === "bed_h");
    expect(bedKit).toBeDefined();
    expect(isInteriorFurnitureKit(bedKit!)).toBe(true);
    const roundtrip = interiorObjectFromKit(bedKit!);
    const original = interiorObjectById("bed_h")!;
    expect(roundtrip.cells).toEqual(original.cells);
    expect(roundtrip.role).toBe("bed");
    expect(roundtrip.snap).toBe("wall-north");
    expect(roundtrip.themes).toContain("bedroom");
  });

  it("이미 시드된 타일셋은 다시 시드하지 않는다", () => {
    const tileset = emptyInteriorTileset();
    seedInteriorTilesetCatalog(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    expect(seedInteriorTilesetCatalog(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS)).toBe(false);
  });

  it("빈 방 종류 배열은 폴백 7종을 다시 심지 않는다", () => {
    const tileset = emptyInteriorTileset();
    seedInteriorTilesetCatalog(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    tileset.interiorRoomKinds = [];
    const vocab = resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    expect(vocab.kindsById.size).toBe(0);
  });

  it("커스텀 방 종류는 필수 역할 가구를 놓는다", () => {
    const tileset = emptyInteriorTileset();
    seedInteriorTilesetCatalog(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    tileset.interiorRoomKinds = [
      { id: "shrine", label: "제단", requiredRoles: ["bed"] },
    ];
    const vocab = resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    const { map } = runInteriorRoomPipeline({
      mapId: "map_shrine",
      name: "제단",
      width: 16,
      height: 13,
      wings: [{ x: 2, y: 5, w: 12, h: 5 }],
      door: { x: 8, y: 9 },
      theme: "shrine",
      seed: 1,
    }, vocab);
    expect(map.upperTiles).toContain(VR.BED_L);
    expect(map.upperTiles).toContain(VR.BED_R);
  });

  it("저작값이 없으면 꾸러미 장소에서 유도한다 — walkway 전파·저작값 우선·빈배열 유지", () => {
    const tileset = emptyInteriorTileset();
    tileset.scratchConceptBundles = [{
      id: "bundle_t",
      label: "시험",
      facilities: [{ id: "facility_t", label: "시험", placeIds: ["hall_t", "corr_t"] }],
      places: [
        { id: "hall_t", label: "시험 홀", role: "entrance" },
        { id: "corr_t", label: "시험 복도", role: "walkway" },
      ],
      things: [],
    }];
    // 저작값 없음 → 유도 + 폴백 결합. 유도 kinds는 requiredRoles가 비고 walkway만 전파된다.
    expect(interiorRoomKindSource(tileset)).toBe("derived");
    const derived = kindsDerivedFromConceptBundles(tileset);
    expect(derived.map((kind) => kind.id).sort()).toEqual(["corr_t", "hall_t"]);
    expect(derived.find((kind) => kind.id === "corr_t")?.walkway).toBe(true);
    expect(derived.find((kind) => kind.id === "hall_t")?.walkway).toBeUndefined();
    const vocab = resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    expect(vocab.kindsById.get("hall_t")?.label).toBe("시험 홀");
    expect(vocab.kindsById.get("bedroom")?.label).toBe("침실");
    // 저작값이 있으면 유도를 타지 않는다.
    tileset.interiorRoomKinds = [{ id: "mine", label: "내 방", requiredRoles: ["bed"] }];
    expect(interiorRoomKindSource(tileset)).toBe("authored");
    const vocab2 = resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    expect(vocab2.kindsById.has("hall_t")).toBe(false);
    expect(vocab2.kindsById.get("mine")?.requiredRoles).toEqual(["bed"]);
    // 빈 배열은 "전부 지움" — 유도도 폴백도 타지 않는다.
    tileset.interiorRoomKinds = [];
    expect(interiorRoomKindSource(tileset)).toBe("authored");
    expect(resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS).kindsById.size).toBe(0);
  });
});
