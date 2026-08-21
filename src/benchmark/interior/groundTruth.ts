// benchmark/interior/groundTruth.ts
// easyrpg_chipset_interior 정답 세트 — 벤치마크 11개 카테고리 + 정본 주택 플랜.
//
// 설계는 src/benchmark/groundTruth.ts 와 같다: 각 카테고리는 "소스 테이블을 읽는
// 파생 함수"가 근본 진실이고, 리터럴 스냅샷은 그 출력을 손으로 고정한 것이다.
// test/interiorBenchGroundTruth.test.ts 가 매 실행 스냅샷 === 파생 을 검증하므로
// 소스 테이블이 바뀌면 테스트가 깨지고 같은 변경 안에서 스냅샷 갱신이 강제된다.
//
// 소스 테이블(2026-08-20 실측):
//  - tileSemanticsInterior.ts     INTERIOR_TILE_SEMANTICS 480칸 전수 라벨
//    역할 분포: wall 100 · decoration 83 · terrain 83 · furniture 67 · floor 56 ·
//    water 40 · building 21 · tree 13 · stairs 7 · window 5 · sign 5
//  - themePacks.ts                INTERIOR_HARNESS_GROUPS 23그룹(role/defaultLayer/passage)
//  - interiorHouseWallTiles.ts    HOUSE_SHELL_* 정본 주택 셸 문법
//  - interiorHouseWallGrammar.ts  planInteriorHouseWalls / CEILING_MEMBER_TILES
//  - defaultAssets.ts             defaultTilesets() 의 시드된 passability/priority
//
// 핵심 설계 판단 — wallAny vs houseShellWall:
// 이 칩셋에는 "벽"으로 보이는 타일이 100칸 있지만 정본 주택 셸은 16칸뿐이다.
// 생성형 모델은 거의 항상 벽돌/석벽(wall-brick, wall-stone)을 집어 오는데, 그것들은
// 진짜 벽이지만 주택 셸 문법이 아니다. 두 카테고리를 따로 채점하고 그 격차를
// 헤드라인 지표로 보고한다 — 이 벤치마크가 측정하려는 바로 그 구분이다.

import { defaultTilesets } from "@/project/defaults/defaultAssets";
import {
  HOUSE_SHELL_CREAM_FACE_TILES,
  HOUSE_SHELL_FORBIDDEN_TILES,
  HOUSE_SHELL_TILE,
} from "@/project/defaults/interiorHouseWallTiles";
import {
  type InteriorTileSemanticEntry,
  INTERIOR_TILE_SEMANTICS,
} from "@/project/defaults/tileSemanticsInterior";
import {
  INTERIOR_HARNESS_GROUPS,
  INTERIOR_HARNESS_PREFIX,
  INTERIOR_WALL_FRAME_FLOOR_TILES,
} from "@/project/tilesetHarness/themePacks";
import { CEILING_MEMBER_TILES, planInteriorHouseWalls } from "@/editor/interiorHouseWallGrammar";
import type { PassFlag } from "@/project/types";
import { digestOf } from "./hash";
import { INTERIOR_GRID_FIXTURES, fixtureFloorMask, type InteriorGridFixture } from "./fixtures";
import {
  INTERIOR_TILE_COUNT,
  INTERIOR_TILESET_ID,
  type HouseReference,
  type InteriorCategoryKey,
  type InteriorCategoryTruth,
  type InteriorGroundTruth,
} from "./types";

// ── 공용 헬퍼 ──────────────────────────────────────────────────────────────

function freezeSet(values: Iterable<number>): ReadonlySet<number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  for (const id of sorted) {
    if (!Number.isInteger(id) || id < 0 || id >= INTERIOR_TILE_COUNT) {
      throw new Error(`interior groundTruth: 타일 id 범위 초과 — ${id} (허용 0..${INTERIOR_TILE_COUNT - 1})`);
    }
  }
  return Object.freeze(new Set<number>(sorted));
}

function groupTileIds(...keys: readonly string[]): number[] {
  const out: number[] = [];
  for (const key of keys) {
    const id = `${INTERIOR_HARNESS_PREFIX}${key}`;
    const group = INTERIOR_HARNESS_GROUPS.find((candidate) => candidate.id === id);
    if (!group) {
      const known = INTERIOR_HARNESS_GROUPS.map((g) => g.id.replace(INTERIOR_HARNESS_PREFIX, "")).join(", ");
      throw new Error(`interior groundTruth: 하네스 그룹 ${key} 없음 (있는 그룹: ${known})`);
    }
    out.push(...group.tileIds);
  }
  return out;
}

function semanticsWhere(predicate: (entry: InteriorTileSemanticEntry) => boolean): number[] {
  return INTERIOR_TILE_SEMANTICS.filter(predicate).map((entry) => entry.index);
}

function difference(source: Iterable<number>, remove: ReadonlySet<number>): number[] {
  return [...source].filter((id) => !remove.has(id));
}

function interiorTileset(): {
  passability: readonly PassFlag[];
  priority: readonly ("lower" | "upper")[];
} {
  const tileset = defaultTilesets()[INTERIOR_TILESET_ID];
  if (!tileset) {
    throw new Error(`interior groundTruth: defaultTilesets() 에 ${INTERIOR_TILESET_ID} 없음`);
  }
  if (tileset.count !== INTERIOR_TILE_COUNT) {
    throw new Error(`interior groundTruth: 타일 수 불일치 — ${tileset.count} (기대 ${INTERIOR_TILE_COUNT})`);
  }
  return { passability: tileset.passability, priority: tileset.priority };
}

function isSolid(flag: PassFlag): boolean {
  return !flag.up && !flag.down && !flag.left && !flag.right;
}

function category(
  key: InteriorCategoryKey,
  canonical: Iterable<number>,
  generous: Iterable<number>,
  traps: Iterable<number>,
  source: string,
): InteriorCategoryTruth {
  const canonicalSet = freezeSet(canonical);
  // generous 는 canonical 을 항상 포함한다(부분점수 집합은 정답의 상위집합).
  const generousSet = freezeSet([...canonicalSet, ...generous]);
  // 함정은 정답과 절대 겹치지 않는다 — 겹치면 같은 픽이 가점이자 감점이 된다.
  const trapSet = freezeSet(difference(traps, generousSet));
  return Object.freeze({ key, canonical: canonicalSet, generous: generousSet, traps: trapSet, source });
}

// ── 카테고리 파생 ──────────────────────────────────────────────────────────

/** 정본 주택 셸 벽 — HOUSE_SHELL_TILE 의 크림 벽면 + 프레임 포스트/캡/트림. */
const HOUSE_SHELL_WALL_TILES: readonly number[] = [
  ...HOUSE_SHELL_CREAM_FACE_TILES,
  HOUSE_SHELL_TILE.capStraight,
  HOUSE_SHELL_TILE.capJointNW,
  HOUSE_SHELL_TILE.capJointNE,
  HOUSE_SHELL_TILE.postWest,
  HOUSE_SHELL_TILE.postEast,
  HOUSE_SHELL_TILE.southTrim,
  HOUSE_SHELL_TILE.southWestCorner,
  HOUSE_SHELL_TILE.southEastCorner,
];

function deriveWallAny(): InteriorCategoryTruth {
  // 하네스 role==="wall" 5그룹(wall-cream/brick/stone/panel/dark-zone) ∪ 시맨틱 role==="wall".
  const harnessWalls = INTERIOR_HARNESS_GROUPS.filter((g) => g.role === "wall").flatMap((g) => [...g.tileIds]);
  const semanticWalls = semanticsWhere((entry) => entry.role === "wall");
  return category(
    "wallAny",
    [...harnessWalls, ...semanticWalls],
    // 천장 덩어리는 "벽"으로 답해도 방어 가능하다(구조 질량이라 부분점수).
    CEILING_MEMBER_TILES,
    // 통행 가능한 바닥을 벽이라고 답하면 명백한 오답.
    groupTileIds("floor", "floor-stone", "carpet-red"),
    "themePacks.INTERIOR_HARNESS_GROUPS(role=wall) ∪ tileSemanticsInterior(role=wall)",
  );
}

function deriveHouseShellWall(): InteriorCategoryTruth {
  const canonical = freezeSet(HOUSE_SHELL_WALL_TILES);
  // 함정: 진짜 벽이지만 주택 셸 문법이 아닌 것들 — 모델이 거의 항상 여기로 샌다.
  const genericWalls = groupTileIds("wall-brick", "wall-stone", "wall-panel", "dark-zone");
  return category(
    "houseShellWall",
    canonical,
    // 같은 셸 계열인 크림 회벽 그룹 전체는 부분점수.
    groupTileIds("wall-cream"),
    [...genericWalls, ...HOUSE_SHELL_FORBIDDEN_TILES],
    "interiorHouseWallTiles.HOUSE_SHELL_* (함정 = wall-brick/stone/panel/dark-zone + 금지 타일)",
  );
}

function deriveCeiling(): InteriorCategoryTruth {
  return category(
    "ceiling",
    CEILING_MEMBER_TILES,
    groupTileIds("dark-zone"),
    HOUSE_SHELL_CREAM_FACE_TILES,
    "interiorHouseWallGrammar.CEILING_MEMBER_TILES",
  );
}

function deriveFloor(): InteriorCategoryTruth {
  const { passability } = interiorTileset();
  const canonical = groupTileIds("floor", "floor-stone", "floor-mat", "deck");
  const generous = [...INTERIOR_WALL_FRAME_FLOOR_TILES, ...groupTileIds("carpet-red", "carpet-teal")];
  // 함정 두 종류: (1) 지형처럼 보이나 실측 통행 불가, (2) 실내 칩셋 안의 실외 지면.
  const looksLikeFloorButSolid = semanticsWhere(
    (entry) => (entry.role === "terrain" || entry.role === "floor") && isSolid(passability[entry.index]!),
  );
  return category(
    "floor",
    canonical,
    generous,
    [...looksLikeFloorButSolid, ...groupTileIds("grass", "outdoor-ground")],
    "themePacks 그룹 floor/floor-stone/floor-mat/deck (함정 = 통행 불가 지형 + 실외 지면)",
  );
}

function deriveCarpet(): InteriorCategoryTruth {
  return category(
    "carpet",
    groupTileIds("carpet-red", "carpet-teal"),
    groupTileIds("floor-mat"),
    groupTileIds("floor", "floor-stone"),
    "themePacks 그룹 carpet-red + carpet-teal",
  );
}

function deriveWindow(): InteriorCategoryTruth {
  return category(
    "window",
    semanticsWhere((entry) => entry.role === "window"),
    semanticsWhere((entry) => /창/.test(entry.label)),
    groupTileIds("curtain"),
    "tileSemanticsInterior(role=window)",
  );
}

function deriveFurnitureSolid(): InteriorCategoryTruth {
  const { passability, priority } = interiorTileset();
  const canonical = semanticsWhere(
    (entry) => entry.role === "furniture" && isSolid(passability[entry.index]!),
  );
  const generous = [
    ...semanticsWhere((entry) => entry.role === "furniture"),
    ...groupTileIds("kitchen", "counter", "pillar"),
  ];
  // 함정: 가구 그림이지만 상위 레이어 투명 소품이라 실제로는 통행 가능한 타일.
  // (침대·탁자 아트가 transparent-props 에 들어 있어 "막는 가구"를 물으면 여기로 샌다.)
  const passableProps = groupTileIds("transparent-props").filter(
    (index) => priority[index] === "upper" && !isSolid(passability[index]!),
  );
  return category(
    "furnitureSolid",
    canonical,
    generous,
    passableProps,
    "tileSemanticsInterior(role=furniture) ∩ 시드된 passability 통행 불가 (함정 = 통행 가능한 상위 소품)",
  );
}

function derivePropUpper(): InteriorCategoryTruth {
  const { priority } = interiorTileset();
  const canonical: number[] = [];
  for (let index = 0; index < INTERIOR_TILE_COUNT; index += 1) {
    if (priority[index] === "upper") canonical.push(index);
  }
  return category(
    "propUpper",
    canonical,
    groupTileIds("transparent-props"),
    // 함정: 하위 레이어 전용 벽/바닥을 상위 소품이라고 답하는 경우.
    groupTileIds("wall-cream", "floor"),
    "defaultTilesets().easyrpg_chipset_interior.priority === upper",
  );
}

function deriveWater(): InteriorCategoryTruth {
  return category(
    "water",
    groupTileIds("water"),
    semanticsWhere((entry) => entry.role === "water"),
    groupTileIds("fire-magic"),
    "themePacks 그룹 water",
  );
}

/**
 * 실내 칩셋 안에 실려 있는 **실외 지형** — 실내 질문의 정답이 될 수 없다.
 *
 * 처음엔 "시맨틱 passage 와 런타임 passability 가 어긋나는 타일"로 정의했으나
 * 실측(2026-08-20) 결과 480칸 전부 일치했다 — themePacks 가 passability 를 시맨틱에서
 * 시드하므로 구조적으로 어긋날 수 없다. 빈 집합은 물을 수 없는 질문이라 폐기하고,
 * 실제로 모델이 빠지는 함정(실내 바닥을 물으면 잔디를 고르는 것)으로 재정의했다.
 */
function deriveDistractor(): InteriorCategoryTruth {
  return category(
    "distractor",
    groupTileIds("grass", "outdoor-ground"),
    groupTileIds("water", "hedge"),
    groupTileIds("floor", "floor-stone"),
    "themePacks 그룹 grass + outdoor-ground (실내 칩셋 안의 실외 지형)",
  );
}

// ── 정본 주택 플랜 ─────────────────────────────────────────────────────────

/**
 * 정본 플랜과 바닥 마스크를 함께 산출한다.
 *
 * 마스크를 방 사각형 그대로 두면 안 된다: planInteriorHouseWalls 는 방이 맞닿는
 * 공유 변을 **칸막이 벽으로 전환**하므로(두 방 플랜에서 6,3 → 77 / 6,4 → 107 /
 * 6,6 → 430) 그 칸들은 더 이상 바닥이 아니다. 사각형 마스크를 그대로 쓰면
 * 정본 답안 자신이 "바닥인데 통행 불가"로 감점된다(실측: structural 0.95).
 * 정답이 만점을 받지 못하는 채점 기준은 기준이 아니므로, 플랜이 실제로 바닥
 * 타일을 깔았는 칸만 바닥으로 삼는다.
 */
function deriveHouseReference(fixture: InteriorGridFixture): HouseReference {
  const requestedFloor = fixtureFloorMask(fixture);
  const walls = planInteriorHouseWalls({
    width: fixture.width,
    height: fixture.height,
    floor: requestedFloor,
    rooms: fixture.rooms.map((room) => ({ ...room })),
    door: fixture.door,
    innerDoors: fixture.innerDoors.map((entry) => ({ ...entry })),
  });

  const planned = new Map<string, number>();
  for (const placement of walls) planned.set(`${placement.x},${placement.y}`, placement.tile);
  const effectiveFloor = requestedFloor.map((isRoom, index) => {
    if (!isRoom) return false;
    const x = index % fixture.width;
    const y = Math.floor(index / fixture.width);
    return planned.get(`${x},${y}`) === HOUSE_SHELL_TILE.floor;
  });

  return Object.freeze({
    fixtureId: fixture.id,
    width: fixture.width,
    height: fixture.height,
    floor: Object.freeze(effectiveFloor),
    door: fixture.door,
    walls: Object.freeze(walls.map((placement) => Object.freeze({ ...placement }))),
  });
}

// ── 공개 API ───────────────────────────────────────────────────────────────

const CATEGORY_BUILDERS: Readonly<Record<InteriorCategoryKey, () => InteriorCategoryTruth>> = Object.freeze({
  wallAny: deriveWallAny,
  houseShellWall: deriveHouseShellWall,
  ceiling: deriveCeiling,
  floor: deriveFloor,
  carpet: deriveCarpet,
  window: deriveWindow,
  furnitureSolid: deriveFurnitureSolid,
  propUpper: derivePropUpper,
  water: deriveWater,
  distractor: deriveDistractor,
});

export const INTERIOR_CATEGORY_KEYS: readonly InteriorCategoryKey[] = Object.freeze(
  Object.keys(CATEGORY_BUILDERS) as InteriorCategoryKey[],
);

export function buildInteriorGroundTruth(): InteriorGroundTruth {
  const { passability, priority } = interiorTileset();
  const categories = {} as Record<InteriorCategoryKey, InteriorCategoryTruth>;
  for (const key of INTERIOR_CATEGORY_KEYS) {
    categories[key] = CATEGORY_BUILDERS[key]();
  }
  const houses: Record<string, HouseReference> = {};
  for (const fixture of INTERIOR_GRID_FIXTURES) {
    houses[fixture.id] = deriveHouseReference(fixture);
  }
  const forbidden = freezeSet(HOUSE_SHELL_FORBIDDEN_TILES);

  // digest 는 시각·환경에 의존하지 않는 순수 내용 해시다. 소스 테이블이 바뀌면
  // 값이 바뀌고, 그러면 manifest 해시가 바뀌어 옛 점수와의 비교가 차단된다.
  const digest = digestOf({
    categories: Object.fromEntries(
      INTERIOR_CATEGORY_KEYS.map((key) => [
        key,
        {
          canonical: [...categories[key].canonical],
          generous: [...categories[key].generous],
          traps: [...categories[key].traps],
        },
      ]),
    ),
    houses: Object.fromEntries(
      Object.entries(houses).map(([id, house]) => [
        id,
        { ...house, walls: house.walls.map((w) => [w.x, w.y, w.tile]) },
      ]),
    ),
    forbidden: [...forbidden],
    passability: passability.map((flag) => (isSolid(flag) ? 0 : 1)),
    priority: priority.map((value) => (value === "upper" ? 1 : 0)),
  });

  return Object.freeze({
    categories: Object.freeze(categories),
    houses: Object.freeze(houses),
    passability: Object.freeze(passability.map((flag) => Object.freeze({ ...flag }))),
    priority: Object.freeze([...priority]),
    forbidden,
    digest,
  });
}
