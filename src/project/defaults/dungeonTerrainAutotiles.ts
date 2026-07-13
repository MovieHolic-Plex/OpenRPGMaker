import { buildEdgeCornerInnerVariantMap } from "./autotileEngine";
import type { AutotileGroup } from "../types";

// 던전 칩셋(easyrpg_chipset_dungeon)의 지형 RM2k3 오토타일 블록 12종 + 붉은 카펫 9-슬라이스.
// 2026-07-13 vision 업스케일 감사로 확정 — 실내(interiorTerrainAutotiles)와 동일한 표준 3×4 배치:
// 윗줄 = 고립 · 바탕 · 오목 코너 소스, 아래 3×3 = 본체(볼록 코너/변/중앙). 바탕 칸은 멤버가 아니다.
// 성형은 buildEdgeCornerInnerVariantMap(8방·11분류)로 실내/흙길(combined_town)과 동일하게 처리한다.
// (눈밭·석재·적암·흙바닥은 무늬가 균질해 변/코너가 미묘하지만 타일은 전부 별개다.)

const COLS = 30;

type DungeonTerrainBlockSpec = {
  readonly key: string;
  readonly name: string;
  readonly col: number;
  readonly row: number;
  /**
   * standard  = 3×4 RM 블록(윗줄: 고립·바탕·오목, 아래 3×3 본체)
   * nineSlice = 3×3 본체만(고립/오목 아트 없음 — 둘 다 몸통으로 폴백. 예: 붉은 카펫)
   */
  readonly layout?: "standard" | "nineSlice";
  /**
   * 이 블록 위에 얹히는 오버레이 블록 key 목록. 오버레이의 바탕 아트가 이 블록이므로
   * (예: 이끼 바탕 = 흙) 호스트는 오버레이를 "연결됨"으로 보고 몸통을 유지해야 한다 —
   * 전환 테두리는 오버레이 쪽 아트가 그린다. (모래→물 연결과 같은 선례)
   */
  readonly connectsTo?: readonly string[];
};

export const DUNGEON_TERRAIN_AUTOTILE_PREFIX = "harness-dungeon-v1-terrain-";

const DUNGEON_TERRAIN_BLOCKS: readonly DungeonTerrainBlockSpec[] = [
  { key: "stone", name: "회록 석재 바닥", col: 6, row: 4, connectsTo: ["chasm"] },
  { key: "chasm", name: "석재 균열 구덩이", col: 9, row: 4 },
  { key: "redrock", name: "적암 바닥", col: 0, row: 8, connectsTo: ["lava"] },
  { key: "lava", name: "용암", col: 3, row: 8 },
  { key: "pit-pale", name: "어둠 구덩이(담색 테두리)", col: 6, row: 8 },
  { key: "pit-gold", name: "어둠 구덩이(금장 테두리)", col: 9, row: 8 },
  { key: "snow", name: "눈밭", col: 6, row: 0, connectsTo: ["ice"] },
  { key: "ice", name: "얼음판", col: 9, row: 0 },
  { key: "dirt", name: "흙바닥", col: 0, row: 12, connectsTo: ["moss"] },
  { key: "moss", name: "이끼 수풀", col: 3, row: 12 },
  { key: "abyss-blue", name: "심연(푸른 테두리)", col: 6, row: 12 },
  { key: "abyss-gray", name: "심연(회암 테두리)", col: 9, row: 12 },
  // 붉은 카펫은 금장 테두리 9-슬라이스(138~200). 아래 계단 행(228~230)은 별개 그룹 — 고립은 몸통 169로.
  { key: "red-carpet", name: "붉은 카펫", col: 18, row: 4, layout: "nineSlice" },
];

function tileAt(spec: DungeonTerrainBlockSpec, dx: number, dy: number): number {
  return (spec.row + dy) * COLS + (spec.col + dx);
}

function memberTileIdsFor(spec: DungeonTerrainBlockSpec): number[] {
  // nineSlice는 3×3이 블록 원점부터 시작(윗줄 없음) — 행 오프셋으로 흡수한다.
  const gridTop = spec.layout === "nineSlice" ? 0 : 1;
  const body = tileAt(spec, 1, gridTop + 1);
  const isolated = spec.layout === "nineSlice" ? body : tileAt(spec, 0, 0);
  const inner = spec.layout === "nineSlice" ? body : tileAt(spec, 2, 0);
  const tiles = [isolated, inner];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) tiles.push(tileAt(spec, dx, gridTop + dy));
  return [...new Set(tiles)];
}

function createGroup(spec: DungeonTerrainBlockSpec, connectAlso: readonly number[]): AutotileGroup {
  const gridTop = spec.layout === "nineSlice" ? 0 : 1;
  const cornerNW = tileAt(spec, 0, gridTop);
  const edgeN = tileAt(spec, 1, gridTop);
  const cornerNE = tileAt(spec, 2, gridTop);
  const edgeW = tileAt(spec, 0, gridTop + 1);
  const body = tileAt(spec, 1, gridTop + 1);
  const edgeE = tileAt(spec, 2, gridTop + 1);
  const cornerSW = tileAt(spec, 0, gridTop + 2);
  const edgeS = tileAt(spec, 1, gridTop + 2);
  const cornerSE = tileAt(spec, 2, gridTop + 2);
  const isolated = spec.layout === "nineSlice" ? body : tileAt(spec, 0, 0);
  const inner = spec.layout === "nineSlice" ? body : tileAt(spec, 2, 0);
  const memberTileIds = memberTileIdsFor(spec);
  return {
    id: `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${spec.key}`,
    name: spec.name,
    neighborhood: 8,
    memberTileIds,
    connectTileIds: [...new Set([...memberTileIds, ...connectAlso])],
    variantMap: buildEdgeCornerInnerVariantMap({
      body,
      edgeN,
      edgeS,
      edgeW,
      edgeE,
      cornerNW,
      cornerNE,
      cornerSW,
      cornerSE,
      isolated,
      inner,
    }),
  };
}

/** 쿼터(8×8 미니타일) 합성 렌더용 블록 역할표 — 표준 3×4 블록 12종(카펫 nineSlice 제외). */
export type DungeonTerrainBlockRoles = {
  readonly key: string;
  readonly body: number;
  readonly edgeNorth: number;
  readonly edgeSouth: number;
  readonly edgeWest: number;
  readonly edgeEast: number;
  readonly cornerNorthWest: number;
  readonly cornerNorthEast: number;
  readonly cornerSouthWest: number;
  readonly cornerSouthEast: number;
  readonly inner: number;
  readonly isolated: number;
  readonly memberTileIds: readonly number[];
  readonly connectTileIds: readonly number[];
};

export function dungeonTerrainBlockRoles(): DungeonTerrainBlockRoles[] {
  const membersByKey = new Map(DUNGEON_TERRAIN_BLOCKS.map((spec) => [spec.key, memberTileIdsFor(spec)]));
  return DUNGEON_TERRAIN_BLOCKS.filter((spec) => spec.layout !== "nineSlice").map((spec) => {
    const memberTileIds = membersByKey.get(spec.key)!;
    const connectAlso = (spec.connectsTo ?? []).flatMap((key) => membersByKey.get(key) ?? []);
    return {
      key: spec.key,
      body: tileAt(spec, 1, 2),
      edgeNorth: tileAt(spec, 1, 1),
      edgeSouth: tileAt(spec, 1, 3),
      edgeWest: tileAt(spec, 0, 2),
      edgeEast: tileAt(spec, 2, 2),
      cornerNorthWest: tileAt(spec, 0, 1),
      cornerNorthEast: tileAt(spec, 2, 1),
      cornerSouthWest: tileAt(spec, 0, 3),
      cornerSouthEast: tileAt(spec, 2, 3),
      inner: tileAt(spec, 2, 0),
      isolated: tileAt(spec, 0, 0),
      memberTileIds,
      connectTileIds: [...new Set([...memberTileIds, ...connectAlso])],
    };
  });
}

/** 던전 지형 오토타일 그룹 13종 — 브러시는 각 블록의 중앙(몸통) 타일. */
export function createDungeonTerrainAutotileGroups(): AutotileGroup[] {
  const membersByKey = new Map(DUNGEON_TERRAIN_BLOCKS.map((spec) => [spec.key, memberTileIdsFor(spec)]));
  return DUNGEON_TERRAIN_BLOCKS.map((spec) => {
    const connectAlso = (spec.connectsTo ?? []).flatMap((key) => {
      const members = membersByKey.get(key);
      if (!members) throw new Error(`connectsTo 대상 블록 없음: ${spec.key} -> ${key}`);
      return members;
    });
    return createGroup(spec, connectAlso);
  });
}
