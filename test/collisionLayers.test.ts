import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { canMove, cellPassability, isPassable, layeredPassability, passabilityOf, tilePassability } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";

function setup() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  const tileset = project.tilesets[map.tilesetId];
  const find = (mark: "o" | "x" | "star") => {
    for (let t = 0; t < tileset.count; t++) if (passageMarkForTile(tileset, t) === mark) return t;
    throw new Error(`no ${mark} tile`);
  };
  return { project, map, tileset, O: find("o"), X: find("x"), STAR: find("star") };
}

describe("layeredPassability", () => {
  it("두 층이면 기존 tilePassability 와 같다", () => {
    const { tileset, O, X, STAR } = setup();
    for (const lower of [O, X]) for (const upper of [-1, O, X, STAR]) {
      expect(layeredPassability(tileset, [lower, -1, upper, -1])).toEqual(tilePassability(tileset, lower, upper));
    }
  });
  it("맨 위의 ★ 아닌 타일이 정한다 — 4층 X 는 3층 O 를 막는다", () => {
    const { tileset, O, X } = setup();
    expect(layeredPassability(tileset, [O, -1, O, X]).up).toBe(false);
  });
  it("★ 는 건너뛴다 — 4층 ★ 아래 2층 X 가 정한다", () => {
    const { tileset, O, X, STAR } = setup();
    expect(layeredPassability(tileset, [O, X, -1, STAR]).up).toBe(false);
  });
  it("2층 O 는 1층 X 위에서 통행을 연다(MZ 와 같음)", () => {
    const { tileset, O, X } = setup();
    expect(layeredPassability(tileset, [X, O, -1, -1]).up).toBe(true);
  });
  it("1층이 비면 막힘", () => {
    const { tileset, O } = setup();
    expect(layeredPassability(tileset as TilesetDef, [-1, O, -1, -1])).toEqual({ up: false, down: false, left: false, right: false });
  });
  it("isPassable 이 4층을 본다", () => {
    const { project, map, O, X } = setup();
    setLayerTileAt(map, 1, 0, O);
    expect(isPassable(project, map, 0, 0)).toBe(true);
    setLayerTileAt(map, 4, 0, X);
    expect(isPassable(project, map, 0, 0)).toBe(false);
  });
});

describe("배열 없는 통행 읽기", () => {
  it("passabilityOf 는 layeredPassability 와 같다 — ★·빈칸·범위 밖 번호 포함", () => {
    const { tileset, O, X, STAR } = setup();
    const ids = [-1, O, X, STAR, tileset.count + 5];
    for (const a of ids) for (const b of ids) for (const c of ids) for (const d of ids) {
      expect(passabilityOf(tileset, a, b, c, d)).toEqual(layeredPassability(tileset, [a, b, c, d]));
    }
  });
  it("cellPassability 와 canMove 가 4층을 읽는다", () => {
    const { project, map, tileset, O, X } = setup();
    for (let i = 0; i < 2; i++) setLayerTileAt(map, 1, i, O);
    expect(cellPassability(tileset, map, 1)).toEqual(layeredPassability(tileset, [O, -1, map.upperTiles[1], -1]));
    expect(canMove(project, map, 0, 0, 1, 0)).toBe(true);
    setLayerTileAt(map, 4, 1, X);
    expect(cellPassability(tileset, map, 1)).toEqual(layeredPassability(tileset, [O, -1, map.upperTiles[1], X]));
    expect(canMove(project, map, 0, 0, 1, 0)).toBe(false);
    expect(canMove(project, map, 0, 0, -1, 0)).toBe(false);
  });
});
