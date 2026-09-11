// benchmark/town/palettes.ts
// 태스크별 팔레트 — 모델에게 **주는** 타일 어휘.
//
// 설계 판단(플랜 대비 의도적 수정, 2026-08-21):
// interior 트랙은 배치 태스크에 그리드 그림만 주고 타일 id 를 일절 알려주지 않는다.
// 그 결과 측정되는 것은 "30열 시트에서 눈으로 480까지 세기"이지 타일 배치 실력이
// 아니다. 실제 제품도 AI 에게 타일 어휘(라벨+id)를 넘긴 뒤 배치를 시킨다.
//
// 그래서 이 트랙은 **팔레트는 주고 배치를 측정한다**:
//   허용: 오름차순·중복 없는 후보 id 집합(= 공개 입력. 벽 세트, 흙길 블록 등)
//   금지: 역할→id 매핑, 좌표→id 매핑, 프로브의 정답 부분집합
// 이 구분은 test/townBenchPrompts.test.ts 가 기계적으로 강제한다 — 프롬프트에서
// 정수를 전부 뽑아 해당 태스크의 팔레트와 정확히 같은 집합인지 대조한다.
//
// 팔레트는 살아있는 엔진 테이블에서 파생한다(손으로 적은 id 없음). 팔레트가
// 바뀌면 프롬프트가 바뀌고 taskSuiteDigest → manifestHash 가 바뀌어 옛 점수와
// 섞이지 않는다.

import { deriveTreePairs } from "@/benchmark/groundTruth";
import { HOUSE_KITS, type HouseKitId } from "@/editor/houseKit";
import { FENCE_TILES } from "@/editor/tools/village/constants";
import {
  DEFAULT_COBBLE_AUTOTILE_GROUP,
  DEFAULT_ROAD_AUTOTILE_GROUP,
} from "@/project/defaults/autotileGroups";
import type { AutotileGroup } from "@/project/types";
import { ROOF_GRID, VILLAGE_GRID, WALL_GRID } from "./fixtures";
import type { TownImageKey } from "./types";

function ascending(values: Iterable<number>): readonly number[] {
  return Object.freeze([...new Set(values)].sort((a, b) => a - b));
}

function groupPalette(group: AutotileGroup): readonly number[] {
  // memberTileIds 에는 같은 id 가 두 역할로 들어있을 수 있다(흙길의 BODY_ALT 와
  // ISOLATED 는 둘 다 360 이다) — 중복 제거가 필수다.
  return ascending(group.memberTileIds);
}

/** 집 키트 한 벌의 모든 타일 — 벽 나인슬라이스 + 지붕(하위/상위) + 기둥 열. */
export function houseKitPalette(kitId: HouseKitId): readonly number[] {
  const kit = HOUSE_KITS[kitId];
  if (!kit) throw new Error(`town palettes: 알 수 없는 집 키트 ${kitId}`);
  const ids: number[] = [];
  for (const slice of [kit.wall.top, kit.wall.mid, kit.wall.bottom]) ids.push(...slice);
  if (kit.postColumn) ids.push(...kit.postColumn.tiles);
  for (const value of Object.values(kit.roof)) if (typeof value === "number") ids.push(value);
  for (const value of Object.values(kit.roof.upper)) if (typeof value === "number") ids.push(value);
  return ascending(ids);
}

export const ROAD_PALETTE = groupPalette(DEFAULT_ROAD_AUTOTILE_GROUP);
export const COBBLE_PALETTE = groupPalette(DEFAULT_COBBLE_AUTOTILE_GROUP);
export const FENCE_PALETTE = ascending(FENCE_TILES);

/** 나무 4종의 캐노피·줄기 전부 — 수종 선택은 모델 자유다. */
export const TREE_PALETTE = ascending(deriveTreePairs().flatMap((pair) => [...pair]));

/**
 * 문 두 벌(나무 문 상/하단, 석재 문 상/하단). 한 벌이 아니라 두 벌을 주는 이유는
 * "위아래를 같은 벌로 짝지을 수 있는가"가 7번의 실제 난이도이기 때문이다.
 * 출처: tileSemanticsCombinedTown — 116/146 "나무 문 상단/하단", 329/359 "문 상단/하단".
 */
export const DOOR_PALETTE: readonly number[] = Object.freeze([116, 146, 329, 359]);

export const WALL_KIT_PALETTE = houseKitPalette(WALL_GRID.house.kitId);
export const ROOF_KIT_PALETTE = houseKitPalette(ROOF_GRID.house.kitId);

/** 마을 팔레트 — 세 키트 + 문 + 흙길 + 포석 + 울타리 + 나무. */
export const VILLAGE_PALETTE = ascending([
  ...VILLAGE_GRID.houses.flatMap((house) => [...houseKitPalette(house.kitId)]),
  ...DOOR_PALETTE,
  ...ROAD_PALETTE,
  ...COBBLE_PALETTE,
  ...FENCE_PALETTE,
  ...TREE_PALETTE,
]);

/**
 * 태스크(=이미지 키) 하나가 쓰는 팔레트. 프로브 태스크는 팔레트 대신 프로브
 * 목록 자체를 프롬프트에 싣기 때문에 여기서 다루지 않는다(tasks.ts 가 분기).
 */
export const TOWN_PALETTES: Readonly<Partial<Record<TownImageKey, readonly number[]>>> = Object.freeze({
  autotileShape: ROAD_PALETTE,
  treeGrid: TREE_PALETTE,
  roadGrid: ROAD_PALETTE,
  wallGrid: WALL_KIT_PALETTE,
  roofGrid: ROOF_KIT_PALETTE,
  doorGrid: DOOR_PALETTE,
  fenceGrid: FENCE_PALETTE,
  villageGrid: VILLAGE_PALETTE,
});

export function paletteFor(key: TownImageKey): readonly number[] {
  const palette = TOWN_PALETTES[key];
  if (!palette) throw new Error(`town palettes: ${key} 에 팔레트가 없다`);
  return palette;
}
