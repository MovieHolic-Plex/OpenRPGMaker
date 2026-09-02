import { beforeEach, describe, expect, it } from "vitest";
import {
  claimThingPicture,
  conceptObjectsForTileset,
  isOwnedPicture,
  registerStampOnTileset,
  stampKitFromTiles,
} from "@/editor/panels/conceptStudioModel";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { store } from "@/project/store";

describe("conceptStudioModel 출처", () => {
  it("마을 칩셋은 내장 집 그림을 물건 후보로 준다", () => {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const objects = conceptObjectsForTileset(tileset);
    expect(objects.some((object) => object.id.startsWith("kit_house_"))).toBe(true);
    expect(objects.every((object) => object.width >= 1 && object.cells.length >= 0)).toBe(true);
  });

  it("실내 칩셋은 여관 가구 그림을 물건 후보로 준다", () => {
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const objects = conceptObjectsForTileset(tileset);
    expect(objects.some((object) => object.id === "bed_h")).toBe(true);
  });
});

describe("conceptStudioModel 스탬프", () => {
  it("고른 칸으로 한 줄 킷을 만든다", () => {
    const kit = stampKitFromTiles([TILE.GRASS, 241], "잔디 두 칸", "kit_stamp_test");
    expect(kit.kind).toBe("section");
    expect(kit.width).toBe(2);
    expect(kit.height).toBe(1);
    expect(kit.rows[0]?.tiles).toEqual([TILE.GRASS, 241]);
    expect(kit.learnedFrom).toBe("db-authored");
  });

  it("빈 칸 목록은 거절한다", () => {
    expect(() => stampKitFromTiles([], "없음", "kit_empty")).toThrow(/칸/);
  });
});

describe("conceptStudioModel 소유", () => {
  beforeEach(() => {
    store.update((project) => {
      const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
      if (tileset) {
        tileset.scratchConceptBundles = [cloneConceptBundle(SCRATCH_INN_BUNDLE)];
        tileset.structureKits = tileset.structureKits?.filter((kit) => kit.learnedFrom !== "db-authored");
      }
    });
  });

  it("카탈로그 침대는 아직 내 그림이 아니다", () => {
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    expect(isOwnedPicture(tileset, "bed_h")).toBe(false);
  });

  it("그림 고치기는 카탈로그를 타일셋 킷으로 굽고 물건을 그 id 로 옮긴다", () => {
    const kitId = claimThingPicture(INTERIOR_ROOM_TILESET_ID, SCRATCH_INN_BUNDLE.id, "bed_h");
    expect(kitId).toMatch(/^kit_/);
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    expect(isOwnedPicture(tileset, kitId!)).toBe(true);
    const thing = tileset.scratchConceptBundles?.[0]?.things.find((entry) => entry.id === "bed_h");
    expect(thing?.objectId).toBe(kitId);
  });

  it("시트 칸을 타일셋에 등록하면 소유 그림이 된다", () => {
    const kit = registerStampOnTileset(DEFAULT_TILESET_ID, [TILE.GRASS], "잔디 한 칸");
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    expect(isOwnedPicture(tileset, kit.id)).toBe(true);
    expect(tileset.structureKits?.some((entry) => entry.id === kit.id)).toBe(true);
  });
});
