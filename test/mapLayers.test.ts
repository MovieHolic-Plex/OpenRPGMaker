import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  cellLayerTiles, cloneExtraLayers, compactMapLayers, hasExtraLayers, layerGroup,
  layerTileAt, remapExtraLayers, setLayerTileAt, setShadowAt, shadowAt,
} from "@/project/mapLayers";
import type { GameMap } from "@/project/types";

function blankMap(): GameMap {
  const project = createBlankProject();
  return structuredClone(project.maps[project.startMapId]);
}

describe("mapLayers", () => {
  it("1층·3층은 기존 lowerTiles·upperTiles 다", () => {
    const map = blankMap();
    setLayerTileAt(map, 1, 0, 7);
    setLayerTileAt(map, 3, 0, 9);
    expect(map.lowerTiles[0]).toBe(7);
    expect(map.upperTiles[0]).toBe(9);
    expect(hasExtraLayers(map)).toBe(false);
  });

  it("2층·4층·그림자는 쓸 때만 생기고 나머지는 빈칸", () => {
    const map = blankMap();
    expect(layerTileAt(map, 2, 3)).toBe(-1);
    expect(shadowAt(map, 3)).toBe(0);
    setLayerTileAt(map, 2, 3, 11);
    setLayerTileAt(map, 4, 5, 12);
    setShadowAt(map, 6, 0b0101);
    expect(map.lowerOverlayTiles?.length).toBe(map.width * map.height);
    expect(layerTileAt(map, 2, 3)).toBe(11);
    expect(layerTileAt(map, 2, 4)).toBe(-1);
    expect(layerTileAt(map, 4, 5)).toBe(12);
    expect(shadowAt(map, 6)).toBe(5);
    expect(cellLayerTiles(map, 3)).toEqual([map.lowerTiles[3], 11, map.upperTiles[3], -1]);
  });

  it("빈칸을 쓰면 칸을 만들지 않는다", () => {
    const map = blankMap();
    setLayerTileAt(map, 2, 0, -1);
    setShadowAt(map, 0, 0);
    expect(map.lowerOverlayTiles).toBeUndefined();
    expect(map.shadowBits).toBeUndefined();
  });

  it("그림자 비트는 0..15 로 자른다", () => {
    const map = blankMap();
    setShadowAt(map, 0, 0xff);
    expect(shadowAt(map, 0)).toBe(15);
  });

  it("compact 는 모두 빈 칸을 지운다", () => {
    const map = blankMap();
    setLayerTileAt(map, 2, 0, 5);
    setLayerTileAt(map, 2, 0, -1);
    setShadowAt(map, 1, 3);
    setShadowAt(map, 1, 0);
    compactMapLayers(map);
    expect("lowerOverlayTiles" in map).toBe(false);
    expect("shadowBits" in map).toBe(false);
  });

  it("clone 은 배열을 복사한다(별칭 없음)", () => {
    const map = blankMap();
    setLayerTileAt(map, 4, 0, 5);
    const copy = cloneExtraLayers(map);
    copy.upperOverlayTiles![0] = 99;
    expect(layerTileAt(map, 4, 0)).toBe(5);
    expect(cloneExtraLayers(blankMap())).toEqual({});
  });

  it("remap 은 새 크기로 옮기고 밖은 비운다", () => {
    const map = blankMap();
    const oldW = map.width;
    setLayerTileAt(map, 2, 1 * oldW + 1, 8);   // (1,1)
    setShadowAt(map, 0, 2);                    // (0,0)
    // 2×2 로 줄이면서 (1,1) → (0,0), 나머지는 원본 없음
    remapExtraLayers(map, 2, 2, (t) => (t === 0 ? 1 * oldW + 1 : -1));
    expect(map.lowerOverlayTiles).toEqual([8, -1, -1, -1]);
    expect(map.shadowBits).toBeUndefined();     // (0,0) 로 온 원본에는 그림자가 없어 모두 0 → 칸 제거
  });

  it("layerGroup", () => {
    expect([1, 2, 3, 4].map((n) => layerGroup(n as 1 | 2 | 3 | 4))).toEqual(["lower", "lower", "upper", "upper"]);
  });
});
