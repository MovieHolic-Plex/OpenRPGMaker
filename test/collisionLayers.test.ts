import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable, layeredPassability, tilePassability } from "@/project/collision";
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
