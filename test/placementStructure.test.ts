import { describe, expect, it } from "vitest";

import { resolvePlacementStructure } from "@/editor/tools/placementStructure";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, TileGroupMetadata, TilesetDef } from "@/project/types";

describe("resolvePlacementStructure", () => {
  it("junctions와 overlays가 없으면 빈 배열을 반환한다", () => {
    // Given: 구조 규칙이 없는 그룹.
    const group = groupWith({ role: "roof" });

    // When: 구조 edit을 계산한다.
    const edits = resolvePlacementStructure({ group, map: blankMap(4, 4), placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([group]) });

    // Then: 추가 구조 edit이 없다.
    expect(edits).toEqual([]);
  });

  it("overlay ridge/eaveEnd/diagonalCorner를 인스턴스 좌표의 upper edit으로 만든다", () => {
    // Given: 여러 overlay 규칙과 맵 밖 인스턴스가 함께 있다.
    const group = groupWith({
      overlays: [
        { tileIds: [10], when: "ridge" },
        { tileIds: [20, 21], when: "eaveEnd" },
        { tileIds: [30, 31, 32, 33], when: "diagonalCorner" },
      ],
      role: "roof",
    });

    // When: 구조 edit을 계산한다.
    const edits = resolvePlacementStructure({
      group,
      map: blankMap(6, 5),
      placed: [rect(1, 1, 3, 2), rect(-4, -4, 1, 1)],
      tileset: tilesetWithGroups([group]),
    });

    // Then: 맵 안 좌표만 deterministic 순서로 나온다.
    expect(edits).toEqual([
      { layer: "upper", tile: 10, x: 2, y: 1 },
      { layer: "upper", tile: 20, x: 1, y: 2 },
      { layer: "upper", tile: 21, x: 3, y: 2 },
      { layer: "upper", tile: 30, x: 1, y: 1 },
      { layer: "upper", tile: 31, x: 3, y: 1 },
      { layer: "upper", tile: 32, x: 1, y: 2 },
      { layer: "upper", tile: 33, x: 3, y: 2 },
    ]);
  });

  it("junction omit은 인접 role 타일이 있을 때 표시 레이어를 EMPTY로 비운다", () => {
    // Given: 지붕 아래 바깥 셀에 wall 역할 타일이 놓여 있다.
    const roof = groupWith({
      junctions: [{ action: "omit", side: "below", withRole: "wall" }],
      role: "roof",
    });
    const wall = groupWith({ id: "wall", role: "wall", tileIds: [7] });
    const map = blankMap(5, 5);
    map.lowerTiles[index(map, 1, 3)] = 7;
    map.lowerTiles[index(map, 1, 2)] = 11;
    map.upperTiles[index(map, 1, 2)] = 99;

    // When: 구조 edit을 계산한다.
    const edits = resolvePlacementStructure({ group: roof, map, placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([roof, wall]) });

    // Then: wall과 맞닿은 지붕 경계 셀의 upper 표시만 비운다.
    expect(edits).toEqual([{ layer: "upper", tile: TILE.EMPTY, x: 1, y: 2 }]);
  });

  it("junction replace는 인접 role 타일이 있을 때 replaceWith 순서로 치환한다", () => {
    // Given: 오른쪽 바깥 셀 두 개에 wall 역할 타일이 놓여 있다.
    const roof = groupWith({
      junctions: [{ action: "replace", replaceWith: [70, 71], side: "rightOf", withRole: "wall" }],
      role: "roof",
    });
    const wall = groupWith({ id: "wall", role: "wall", tileIds: [7] });
    const map = blankMap(5, 5);
    map.lowerTiles[index(map, 3, 1)] = 7;
    map.lowerTiles[index(map, 3, 2)] = 7;
    map.lowerTiles[index(map, 2, 1)] = 11;
    map.lowerTiles[index(map, 2, 2)] = 12;

    // When: 구조 edit을 계산한다.
    const edits = resolvePlacementStructure({ group: roof, map, placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([roof, wall]) });

    // Then: 오른쪽 경계가 replaceWith 배열 순서로 바뀐다.
    expect(edits).toEqual([
      { layer: "lower", tile: 70, x: 2, y: 1 },
      { layer: "lower", tile: 71, x: 2, y: 2 },
    ]);
  });

  it("같은 입력은 같은 edit 배열을 반환한다", () => {
    // Given: overlay와 junction을 함께 가진 그룹.
    const roof = groupWith({
      junctions: [{ action: "replace", replaceWith: [70], side: "below", withRole: "wall" }],
      overlays: [{ tileIds: [10], when: "innerCorner" }],
      role: "roof",
    });
    const wall = groupWith({ id: "wall", role: "wall", tileIds: [7] });
    const map = blankMap(5, 5);
    map.lowerTiles[index(map, 1, 3)] = 7;

    // When: 같은 입력으로 두 번 계산한다.
    const input = { group: roof, map, placed: [rect(1, 1, 2, 2)], tileset: tilesetWithGroups([roof, wall]) };
    const first = resolvePlacementStructure(input);
    const second = resolvePlacementStructure(input);

    // Then: 결과가 완전히 동일하다.
    expect(second).toEqual(first);
  });
});

function rect(x: number, y: number, w: number, h: number): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  return { h, w, x, y };
}

function index(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function blankMap(width: number, height: number): GameMap {
  return {
    events: [],
    height,
    id: "map",
    lowerTiles: Array.from({ length: width * height }, () => 0),
    name: "테스트 맵",
    tileSize: 16,
    tilesetId: "tileset",
    upperTiles: Array.from({ length: width * height }, () => TILE.EMPTY),
    width,
  };
}

function groupWith(input: {
  readonly id?: string;
  readonly junctions?: TileGroupMetadata["junctions"];
  readonly overlays?: TileGroupMetadata["overlays"];
  readonly role: TileGroupMetadata["role"];
  readonly tileIds?: readonly number[];
}): TileGroupMetadata {
  return {
    defaultLayer: "upper",
    description: "구조 해석 테스트 그룹",
    id: input.id ?? input.role,
    junctions: input.junctions ? [...input.junctions] : undefined,
    name: input.role,
    overlays: input.overlays ? [...input.overlays] : undefined,
    placementRules: "",
    role: input.role,
    tileIds: [...(input.tileIds ?? [1])],
  };
}

function tilesetWithGroups(groups: readonly TileGroupMetadata[]): TilesetDef {
  return {
    count: 128,
    id: "tileset",
    image: { id: "tileset-image", type: "bundled" },
    name: "테스트 타일셋",
    passability: Array.from({ length: 128 }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: 128 }, () => "lower"),
    terrain: Array.from({ length: 128 }, () => 0),
    tileGroups: [...groups],
    tilesPerRow: 8,
    tileSize: 16,
  };
}
