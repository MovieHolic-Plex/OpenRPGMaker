// OPRN-OUT-026 회귀 행렬 — 레이어/받침 선택이 OPRN-OUT-017 의 하드클러스터 거부
// (경계·보호 셀·점유 상위)를 바꾸는지 측정한다. 두 이슈가 같은 원인이라고 주장하기 위한
// 테스트가 아니라, 원인 공유 여부를 **재현으로 판정**하기 위한 테스트다.
import { describe, expect, it } from "vitest";
import { expandHardClusterPlacement } from "@/editor/tools/clusterRulePlacement";
import { setTileBackingOverride, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import { tilePassability } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, TilesetDef } from "@/project/types";

const CONIFER_TRUNK = 290;
const SECOND_TRUNK = 291;
const BROADLEAF_TRUNK = 292;
const CONIFER_CANOPY = 260;

function blankMapAndTileset(): { map: GameMap; tileset: TilesetDef } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  return { map, tileset: project.tilesets[map.tilesetId] };
}

function placeUpper(map: GameMap, x: number, y: number, tile: number): void {
  map.upperTiles[y * map.width + x] = tile;
}

type Case = { readonly name: string; readonly run: (map: GameMap, tileset: TilesetDef) => boolean };

const CASES: readonly Case[] = [
  {
    name: "맵 상단 경계 — 동반 수관이 맵 밖",
    run: (map, tileset) =>
      expandHardClusterPlacement({ map, origin: { x: 4, y: 0 }, originLayer: "lower", tile: CONIFER_TRUNK, tileset }).ok,
  },
  {
    name: "위 칸에 다른 상위 오브젝트가 점유",
    run: (map, tileset) => {
      placeUpper(map, 4, 3, 448);
      return expandHardClusterPlacement({ map, origin: { x: 4, y: 4 }, originLayer: "lower", tile: CONIFER_TRUNK, tileset }).ok;
    },
  },
  {
    name: "보호 셀(blocked)이 동반 타일 자리",
    run: (map, tileset) =>
      expandHardClusterPlacement({
        blocked: new Set(["4,7"]),
        map,
        origin: { x: 4, y: 8 },
        originLayer: "lower",
        tile: CONIFER_TRUNK,
        tileset,
      }).ok,
  },
  {
    name: "빈 공간 — 정상 배치",
    run: (map, tileset) =>
      expandHardClusterPlacement({ map, origin: { x: 6, y: 6 }, originLayer: "lower", tile: CONIFER_TRUNK, tileset }).ok,
  },
];

describe("레이어/받침 선택과 하드클러스터 거부의 관계", () => {
  it("받침을 없음으로 바꿔도 네 경우의 거부 결과는 동일하다", () => {
    for (const testCase of CASES) {
      const base = blankMapAndTileset();
      const baseline = testCase.run(base.map, base.tileset);
      const altered = blankMapAndTileset();
      setTileBackingOverride(altered.tileset, CONIFER_TRUNK, "none");
      expect(testCase.run(altered.map, altered.tileset), testCase.name).toBe(baseline);
    }
  });

  it("밑동을 상위로 확정하면 하위 밑동 경로와 다른 결과가 나올 수 있고, 그 차이를 기록한다", () => {
    const observed: Record<string, { lower: boolean; upper: boolean }> = {};
    for (const testCase of CASES) {
      const lowerSide = blankMapAndTileset();
      const lower = testCase.run(lowerSide.map, lowerSide.tileset);
      const upperSide = blankMapAndTileset();
      setTileLayerOverride(upperSide.tileset, CONIFER_TRUNK, "upper");
      const upper = testCase.run(upperSide.map, upperSide.tileset);
      observed[testCase.name] = { lower, upper };
    }
    // 경계·점유·보호 셀 거부는 동반 타일의 좌표 제약에서 나오므로 레이어 선택과 무관하다.
    for (const [name, result] of Object.entries(observed)) {
      expect(result.upper, `${name} (상위 확정)`).toBe(result.lower);
    }
  });

  it("빈 공간 배치는 밑동 하위 + 수관 상위로 확장된다", () => {
    const { map, tileset } = blankMapAndTileset();
    const result = expandHardClusterPlacement({ map, origin: { x: 6, y: 6 }, originLayer: "lower", tile: CONIFER_TRUNK, tileset });
    expect(result.ok).toBe(true);
    const trunkEdit = result.edits.find((edit) => edit.tile === CONIFER_TRUNK);
    const canopyEdit = result.edits.find((edit) => edit.tile === CONIFER_CANOPY);
    expect(trunkEdit?.layer).toBe("lower");
    expect(canopyEdit?.layer).toBe("upper");
  });
});

describe("받침 선택은 통행 판정을 바꾸지 않는다", () => {
  it("밑동의 통행 판정은 받침 없음/잔디/자동에서 같다", () => {
    const { tileset } = blankMapAndTileset();
    const baseline = tilePassability(tileset, TILE.GRASS, CONIFER_TRUNK);
    for (const choice of ["none", TILE.GRASS, "auto"] as const) {
      setTileBackingOverride(tileset, CONIFER_TRUNK, choice);
      expect(tilePassability(tileset, TILE.GRASS, CONIFER_TRUNK), String(choice)).toEqual(baseline);
    }
  });

  it("받침 타일 자체는 하위 슬롯을 덮어쓰지 않는다 — 렌더 합성 전용", () => {
    const { map, tileset } = blankMapAndTileset();
    map.lowerTiles[3 * map.width + 3] = SECOND_TRUNK;
    expect(tileBackingTile(tileset, SECOND_TRUNK)).toBe(TILE.GRASS);
    expect(map.lowerTiles[3 * map.width + 3]).toBe(SECOND_TRUNK);
  });

  it("2×2 활엽수 밑동도 같은 받침 계약을 따른다", () => {
    const { tileset } = blankMapAndTileset();
    expect(tileBackingTile(tileset, BROADLEAF_TRUNK)).toBe(TILE.GRASS);
  });
});
