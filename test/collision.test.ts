// test/collision.test.ts
// 충돌 판정 로직 단위 테스트 — v2 passability 기반.
// 스펙 docs/specs/2026-06-18-rm2k3-overhaul-design.md §8.3.

import { describe, it, expect } from "vitest";
import { createBlankMap, createBlankProject, TILE, DEFAULT_SOLID_TILES } from "@/project/defaults";
import { inBounds, isPassable, canMove, getTileset, tilePassability } from "@/project/collision";
import type { GameMap, Project, PassFlag } from "@/project/types";

function makeProject(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  return { project, map };
}

describe("inBounds", () => {
  const { map: m } = makeProject();
  it("경계 안은 true", () => {
    expect(inBounds(m, 0, 0)).toBe(true);
    expect(inBounds(m, m.width - 1, m.height - 1)).toBe(true);
  });
  it("경계 밖은 false", () => {
    expect(inBounds(m, -1, 0)).toBe(false);
    expect(inBounds(m, 0, -1)).toBe(false);
    expect(inBounds(m, m.width, 0)).toBe(false);
    expect(inBounds(m, 0, m.height)).toBe(false);
  });
});

describe("getTileset", () => {
  it("맵의 타일셋을 반환", () => {
    const { project, map } = makeProject();
    const ts = getTileset(project, map);
    expect(ts).not.toBeNull();
    if (!ts) throw new Error("tileset missing");
    expect(ts.passability.length).toBe(ts.count);
  });
});

describe("tilePassability", () => {
  const { project, map } = makeProject();
  const ts = getTileset(project, map);
  if (!ts) throw new Error("tileset missing");
  it("GRASS(lower)는 4방향 통과", () => {
    const p = tilePassability(ts, TILE.GRASS, -1);
    expect(p.up && p.down && p.left && p.right).toBe(true);
  });
  it("WATER(lower)는 4방향 불가", () => {
    const p = tilePassability(ts, TILE.WATER, -1);
    expect(p.up || p.down || p.left || p.right).toBe(false);
  });
  it("lower 통과 + upper 통과 → 합성 통과", () => {
    const lp: PassFlag = { up: true, down: true, left: true, right: true };
    ts.passability[0] = lp;
    const p = tilePassability(ts, 0, 0);
    expect(p.up).toBe(true);
  });
  it("upper star tiles are ignored by runtime passability", () => {
    const passable: PassFlag = { up: true, down: true, left: true, right: true };
    const solid: PassFlag = { up: false, down: false, left: false, right: false };
    ts.passability[0] = passable;
    ts.passability[374] = passable;
    ts.priority[374] = "upper";

    expect(tilePassability(ts, 0, 374)).toEqual(passable);
    ts.priority[374] = "lower";
    ts.passability[374] = solid;
    expect(tilePassability(ts, 374, -1)).toEqual(solid);
  });
});

describe("isPassable (v2: project 인자)", () => {
  const { project, map } = makeProject();
  it("WATER 칸은 불가", () => {
    map.lowerTiles[0] = TILE.WATER;
    expect(isPassable(project, map, 0, 0)).toBe(false);
  });
  it("GRASS 칸은 가능", () => {
    map.lowerTiles[1] = TILE.GRASS;
    expect(isPassable(project, map, 1, 0)).toBe(true);
  });
  it("경계 밖은 불가", () => {
    expect(isPassable(project, map, -1, 0)).toBe(false);
    expect(isPassable(project, map, map.width, 0)).toBe(false);
  });
});

describe("canMove (from→to)", () => {
  it("GRASS에서 GRASS로 이동 가능", () => {
    const { project, map } = makeProject();
    map.lowerTiles[0] = TILE.GRASS;
    map.lowerTiles[1] = TILE.GRASS;
    expect(canMove(project, map, 0, 0, 1, 0)).toBe(true);
  });
  it("WATER로는 진입 불가", () => {
    const { project, map } = makeProject();
    map.lowerTiles[0] = TILE.GRASS;
    map.lowerTiles[1] = TILE.WATER;
    expect(canMove(project, map, 0, 0, 1, 0)).toBe(false);
  });
  it("경계 밖으로 이동 불가", () => {
    const { project, map } = makeProject();
    expect(canMove(project, map, 0, 0, -1, 0)).toBe(false);
  });
  it("같은 칸은 false", () => {
    const { project, map } = makeProject();
    expect(canMove(project, map, 0, 0, 0, 0)).toBe(false);
  });
  it("upper passable tiles do not block movement just because they are on the upper layer", () => {
    const { project, map } = makeProject();
    const tileset = getTileset(project, map);
    if (!tileset) throw new Error("tileset missing");
    map.lowerTiles[0] = TILE.GRASS;
    map.lowerTiles[1] = TILE.GRASS;
    map.upperTiles[1] = TILE.FLOWERS;

    expect(tileset.priority[TILE.FLOWERS]).toBe("upper");
    expect(tileset.passability[TILE.FLOWERS]).toEqual({ up: true, down: true, left: true, right: true });
    expect(canMove(project, map, 0, 0, 1, 0)).toBe(true);
  });
  it("upper star building tiles are pass-through, but lower building base tiles block movement", () => {
    const { project, map } = makeProject();
    const tileset = getTileset(project, map);
    if (!tileset) throw new Error("tileset missing");
    map.lowerTiles[0] = TILE.GRASS;
    map.lowerTiles[1] = TILE.GRASS;
    map.upperTiles[1] = 374;
    tileset.priority[374] = "upper";
    tileset.passability[374] = { up: true, down: true, left: true, right: true };

    expect(canMove(project, map, 0, 0, 1, 0)).toBe(true);

    map.upperTiles[1] = TILE.EMPTY;
    map.lowerTiles[1] = 374;
    tileset.priority[374] = "lower";
    tileset.passability[374] = { up: false, down: false, left: false, right: false };

    expect(canMove(project, map, 0, 0, 1, 0)).toBe(false);
  });
});

describe("기본 충돌 규칙 일관성", () => {
  it("GRASS는 통과 가능", () => {
    expect(DEFAULT_SOLID_TILES.has(TILE.GRASS)).toBe(false);
  });
  it("WATER/WALL/TREE는 통과 불가", () => {
    expect(DEFAULT_SOLID_TILES.has(TILE.WATER)).toBe(true);
    expect(DEFAULT_SOLID_TILES.has(TILE.WALL)).toBe(true);
    expect(DEFAULT_SOLID_TILES.has(TILE.TREE)).toBe(true);
  });
  it("PATH/FLOOR/SAND/STAIRS는 통과 가능", () => {
    expect(DEFAULT_SOLID_TILES.has(TILE.PATH)).toBe(false);
    expect(DEFAULT_SOLID_TILES.has(TILE.FLOOR)).toBe(false);
    expect(DEFAULT_SOLID_TILES.has(TILE.SAND)).toBe(false);
    expect(DEFAULT_SOLID_TILES.has(TILE.STAIRS)).toBe(false);
  });
});

void createBlankMap;
