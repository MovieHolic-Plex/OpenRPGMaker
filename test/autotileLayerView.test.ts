// 오토타일이 칠한 층 배열에서 모양을 잡는다(MZ 4층 — 2층 풀 장식 A2). 설계: docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 3
import { describe, expect, it } from "vitest";
import { autotileLayerView, buildEdgeCornerVariantMap, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { setLayerTileAt } from "@/project/mapLayers";
import type { AutotileGroup, GameMap } from "@/project/types";

const TILES = { body: 10, edgeN: 11, edgeS: 12, edgeW: 13, edgeE: 14, cornerNW: 15, cornerNE: 16, cornerSW: 17, cornerSE: 18 } as const;
const GROUP: AutotileGroup = {
  id: "grass-deco",
  name: "풀 장식",
  neighborhood: 4,
  memberTileIds: [10, 11, 12, 13, 14, 15, 16, 17, 18],
  variantMap: buildEdgeCornerVariantMap(TILES),
};

function blankMap(width = 5, height = 5): GameMap {
  return {
    id: "m", name: "m", width, height, tilesetId: "t", tileSize: 16,
    lowerTiles: new Array<number>(width * height).fill(10), upperTiles: new Array<number>(width * height).fill(-1), events: [],
  } as GameMap;
}

describe("autotileLayerView", () => {
  it("2층에 칠한 멤버는 2층 이웃 기준으로 모양이 잡히고 1층은 그대로다", () => {
    const map = blankMap();
    const lowerBefore = map.lowerTiles.slice();
    // 2층 가운데 가로 3칸 띠 (1..3, 2) — 1층은 전부 같은 그룹 몸통(10)이라 1층 이웃을 보면 모두 몸통이 된다.
    const points = [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }];
    for (const p of points) setLayerTileAt(map, 2, p.y * map.width + p.x, TILES.body);
    shapeAutotileGroupAround(autotileLayerView(map, 2), GROUP, points);
    const row = [1, 2, 3].map((x) => map.lowerOverlayTiles![2 * map.width + x]);
    // 위아래가 비었으므로 몸통이 아니라 가장자리/모서리다(2층 이웃 기준).
    expect(row).toEqual([TILES.cornerNW, TILES.edgeN, TILES.cornerNE]);
    expect(map.lowerTiles).toEqual(lowerBefore);
  });

  it("1층 뷰는 lowerTiles, 3층 뷰는 upperTiles 를 그대로 빌려준다", () => {
    const map = blankMap();
    expect(autotileLayerView(map, 1).lowerTiles).toBe(map.lowerTiles);
    expect(autotileLayerView(map, 3).lowerTiles).toBe(map.upperTiles);
  });

  it("2·4층 칸이 없는 옛 맵에서는 모양 잡기가 새 키를 만들지 않는다", () => {
    const map = blankMap();
    for (const layer of [2, 4] as const) {
      shapeAutotileGroupAround(autotileLayerView(map, layer), GROUP, [{ x: 2, y: 2 }]);
    }
    expect("lowerOverlayTiles" in map).toBe(false);
    expect("upperOverlayTiles" in map).toBe(false);
  });
});
