import { describe, expect, it } from "vitest";
import { createStarterMap, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";

describe("starter map chipset showcase", () => {
  // 2026-10-07 저작권 정리(0d4f13e7c8): 통나무집 세 채와 길을 그리던 시작 마을 장식은 지웠다.
  // createStarterMap 은 이제 기본 칩셋의 빈 풀밭이라 집·길 타일 패턴 단언은 폐기하고 크기·칩셋·빈 위층만 지킨다.
  it("builds a compact default 마을 as an open 30x30 field on the default tileset", () => {
    const map = createStarterMap();

    expect(map.width).toBe(30);
    expect(map.height).toBe(30);
    expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(map.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
  });
});
