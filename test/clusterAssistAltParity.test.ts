// bAlt/aAlt 패리티 — 검사기는 대체 타일을 보는데 확장기는 못 보던 결함의 재현.
//
// OPRN-OUT-017 은 이 항목을 「따로 재현·리뷰한 뒤에 범위를 넓힌다」로 미뤘다. 여기서 재는 것은
// 이름이 아니라 **저작 결과**다: 규칙 데이터(`bAlt`/`aAlt`)와 `validateClusterRules` 가 합법으로
// 인정하는 배치를, 손붓의 구조 보조(hard 클러스터 확장)가 만들 수 있는가.
//
// 두 가족이 대체 타일을 쓴다(둘 다 실제 번들 데이터):
//   1. 마른나무 261/291 — `{a:261, b:291, bAlt:[261], relation:"aAboveB"}` (세로 스택)
//   2. 긴 탁자 325/326/327 — `aAlt`/`bAlt` 두 규칙 (가로 임의 길이)
// 재현 시점의 실측 결함:
//   1. 261 을 위로 쌓으면 아래 칸(이미 261)의 **하위 레이어에 291 이 몰래 찍혀** 지형이 파괴됐다.
//      수관 아래에 숨어 lint 도 조용했고, 위 수관을 지우면 밑동이 드러났다.
//   2. 3칸을 넘는 탁자를 손으로 이어 붙일 수 없었다 — 확장기가 이미 놓인 326(=bAlt) 자리에
//      325 를 요구해 `occupied-upper` 로 거부했다. 같은 배치를 lint 와 행 배치기는 합법으로 본다
//      (test/interiorLongTable.test.ts 의 `[325,326,326,326,327]`).

import { beforeEach, describe, expect, it } from "vitest";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import {
  getMapEditHistoryState,
  recordMapEditIfChanged,
  redoMapEdit,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { expandHardClusterPlacement } from "@/editor/tools/clusterRulePlacement";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankProject, TILE } from "@/project/defaults";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

const DRY_TOP = 261;
const DRY_BOTTOM = 291;
const TABLE_L = 325;
const TABLE_M = 326;
const TABLE_R = 327;
const TABLE_GROUP_ID = "harness-interior-house-v1-tavern-table";

function townFixture(): MapId {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 10;
  map.height = 10;
  map.lowerTiles = Array(100).fill(TILE.GRASS);
  map.upperTiles = Array(100).fill(TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 0, y: 9 };
  store.replace(project);
  resetMapEditHistory();
  return project.startMapId;
}

function interiorFixture(): MapId {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.tilesetId = INTERIOR_ROOM_TILESET_ID;
  map.width = 10;
  map.height = 10;
  map.lowerTiles = Array(100).fill(42);
  map.upperTiles = Array(100).fill(TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 0, y: 9 };
  // 번들 타일셋이 이미 들고 있는 정본 그룹을 쓴다 — `interiorRoomTileGroups()` 는 마이그레이션
  // 이전의 2타일 레거시(대체 타일 없음)를 돌려주므로 여기서 쓰면 재현 대상이 사라진다(실측).
  const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
  const group = (tileset?.tileGroups ?? []).find((candidate) => candidate.id === TABLE_GROUP_ID);
  if (!group?.rules?.some((rule) => Array.isArray(rule.params.bAlt))) {
    throw new Error("long-table group lost its bAlt rules");
  }
  store.replace(project);
  resetMapEditHistory();
  return project.startMapId;
}

function currentMap(mapId: MapId): GameMap {
  const map = store.getCurrent().maps[mapId];
  if (!map) throw new Error(`missing map ${mapId}`);
  return map;
}

function lowerAt(mapId: MapId, x: number, y: number): number {
  const map = currentMap(mapId);
  return map.lowerTiles[y * map.width + x];
}

function upperAt(mapId: MapId, x: number, y: number): number {
  const map = currentMap(mapId);
  return map.upperTiles[y * map.width + x];
}

/** 손붓 한 번(구조 보조 켜짐) = 되돌리기 한 단위. 거부는 모아서 돌려준다. */
function assistedPaint(mapId: MapId, tile: number, x: number, y: number): readonly TilePaintRejection[] {
  const rejections: TilePaintRejection[] = [];
  recordMapEditIfChanged(mapId, () => {
    paintTilesBulk(mapId, [{ layer: "upper", tile, x, y }], {
      autoConnect: false,
      onRejected: (rejection) => rejections.push(rejection),
    });
  });
  return rejections;
}

function tableRow(mapId: MapId, y: number, x0: number, width: number): readonly number[] {
  const map = currentMap(mapId);
  return Array.from({ length: width }, (_unused, index) => map.upperTiles[y * map.width + x0 + index]);
}

beforeEach(() => {
  resetMapEditHistory();
});

describe("bAlt/aAlt 패리티 — 확장기가 이미 놓인 대체 타일을 인정한다", () => {
  it("마른나무 261 을 위로 쌓으면 아래 칸의 지형이 그대로 남는다 (bAlt:[261])", () => {
    const mapId = townFixture();

    expect(assistedPaint(mapId, DRY_TOP, 5, 6)).toEqual([]);
    expect(upperAt(mapId, 5, 6)).toBe(DRY_TOP);
    expect(lowerAt(mapId, 5, 7)).toBe(DRY_BOTTOM);

    // 위로 두 칸 더 쌓는다 — 규칙이 261 아래 261 을 허용하므로 새 밑동은 생기지 않아야 한다.
    expect(assistedPaint(mapId, DRY_TOP, 5, 5)).toEqual([]);
    expect(assistedPaint(mapId, DRY_TOP, 5, 4)).toEqual([]);

    expect([upperAt(mapId, 5, 4), upperAt(mapId, 5, 5), upperAt(mapId, 5, 6)])
      .toEqual([DRY_TOP, DRY_TOP, DRY_TOP]);
    // 재현 시점의 결함: 아래 두 칸의 하위 레이어에 291 이 몰래 찍혀 풀이 사라졌다.
    expect([lowerAt(mapId, 5, 5), lowerAt(mapId, 5, 6)]).toEqual([TILE.GRASS, TILE.GRASS]);
    expect(lowerAt(mapId, 5, 7)).toBe(DRY_BOTTOM);
  });

  it("쌓아 올린 마른나무는 hard 위반이 없다 — 검사기와 확장기가 같은 배치를 본다", () => {
    const mapId = townFixture();
    for (const y of [6, 5, 4]) expect(assistedPaint(mapId, DRY_TOP, 5, y)).toEqual([]);

    const violations = validateClusterRules(store.getCurrent())
      .filter((issue) => issue.rule.id.includes("dry_tree"));
    expect(violations, JSON.stringify(violations.map((issue) => issue.coords))).toEqual([]);
  });

  it("숨은 밑동이 없으므로 위 수관을 지워도 땅에 밑동이 드러나지 않는다", () => {
    const mapId = townFixture();
    for (const y of [6, 5]) expect(assistedPaint(mapId, DRY_TOP, 5, y)).toEqual([]);

    // 스택 중간(5,6)의 수관을 지운다.
    recordMapEditIfChanged(mapId, () => {
      paintTilesBulk(mapId, [{ layer: "upper", tile: TILE.EMPTY, x: 5, y: 6 }], { autoConnect: false });
    });
    expect(lowerAt(mapId, 5, 6)).not.toBe(DRY_BOTTOM);
  });

  it("스택 한 칸을 올리는 것도 되돌리기 한 단위다", () => {
    const mapId = townFixture();
    assistedPaint(mapId, DRY_TOP, 5, 6);
    const before = JSON.stringify(currentMap(mapId));

    assistedPaint(mapId, DRY_TOP, 5, 5);
    expect(upperAt(mapId, 5, 5)).toBe(DRY_TOP);
    const after = JSON.stringify(currentMap(mapId));
    expect(getMapEditHistoryState().canUndo).toBe(true);

    expect(undoMapEdit()).toBe(true);
    expect(JSON.stringify(currentMap(mapId))).toBe(before);
    expect(redoMapEdit()).toBe(true);
    expect(JSON.stringify(currentMap(mapId))).toBe(after);
  });

  it("긴 탁자를 3칸보다 길게 손으로 이어 붙일 수 있다 (aAlt/bAlt)", () => {
    const mapId = interiorFixture();

    // 첫 붓질은 닫힌 3칸을 만든다(기존 계약).
    expect(assistedPaint(mapId, TABLE_L, 3, 5)).toEqual([]);
    expect(tableRow(mapId, 5, 3, 3)).toEqual([TABLE_L, TABLE_M, TABLE_R]);

    // 오른끝 자리에 몸통을 얹어 늘린다 — 규칙은 326 오른쪽에 326 을 허용한다(bAlt).
    expect(assistedPaint(mapId, TABLE_M, 5, 5)).toEqual([]);
    expect(tableRow(mapId, 5, 3, 4)).toEqual([TABLE_L, TABLE_M, TABLE_M, TABLE_R]);

    const violations = validateClusterRules(store.getCurrent())
      .filter((issue) => issue.groupId === TABLE_GROUP_ID);
    expect(violations, JSON.stringify(violations.map((issue) => issue.coords))).toEqual([]);
  });

  it("확장기는 이미 놓인 대체 타일만 인정하고, 빈 칸에는 정본 동반 타일을 만든다", () => {
    const mapId = interiorFixture();
    const map = currentMap(mapId);
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");

    // 빈 맵: 몸통 하나에서 닫힌 3칸이 나온다(기존 계약, 회귀 금지).
    const fresh = expandHardClusterPlacement({ map, origin: { x: 4, y: 3 }, originLayer: "upper", tile: TABLE_M, tileset });
    expect(fresh.ok).toBe(true);
    expect([...fresh.edits].sort((a, b) => a.x - b.x).map((edit) => edit.tile)).toEqual([TABLE_L, TABLE_M, TABLE_R]);
  });

  it("대체 타일이 없는 그룹은 예전처럼 동반 타일을 강제한다 (침엽수 260/290)", () => {
    const mapId = townFixture();
    expect(assistedPaint(mapId, 290, 5, 5)).toEqual([]);
    expect(upperAt(mapId, 5, 4)).toBe(260);
    expect(lowerAt(mapId, 5, 5)).toBe(290);
  });
});
