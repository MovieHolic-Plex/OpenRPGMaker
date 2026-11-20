/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/22-map-tiles";
import { mapTarget } from "@/editor/smallTask/target";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { canMove } from "@/project/collision";
import { cellLayerTiles, shadowAt } from "@/project/mapLayers";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectUndoRestores, loadFixture } from "./harness";

type Selection = NonNullable<Parameters<typeof runPrimitive>[4]>;
type Rect = NonNullable<Selection["rect"]>;
type Fixture = Parameters<typeof loadFixture>[0];

const BUILT_MAP = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
const fixtures = new Map<Fixture, Project>();
const rect = (x: number, y: number, w = 1, h = 1): Rect => ({ x, y, w, h });

function fixture(name: Fixture, mapId?: string): { project: Project; map: GameMap } {
  const project = fixtures.get(name) ?? loadFixture(name);
  fixtures.set(name, project);
  const map = project.maps[mapId ?? project.startMapId];
  if (!map && name === "blank") {
    const blank = { ...createBlankMap("빈 맵", 20, 15), id: "map_blank_start" };
    return { project: { ...withMap(project, blank), startMapId: blank.id,
      startPos: { x: 10, y: 8 }, mapTree: { mapId: blank.id, children: [] } }, map: blank };
  }
  if (!map) throw new Error("검사할 맵이 없습니다.");
  return { project, map };
}

function withMap(project: Project, map: GameMap): Project {
  return { ...project, maps: { ...project.maps, [map.id]: map } };
}

function prepared() {
  const { project, map } = fixture("built", BUILT_MAP);
  const index = map.width * 5 + 4;
  const lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
  const upperOverlayTiles = lowerOverlayTiles.slice();
  const shadowBits = new Array(lowerOverlayTiles.length).fill(0);
  lowerOverlayTiles[index] = 2;
  upperOverlayTiles[index] = 454;
  shadowBits[index] = 1;
  const lowerTileStacks = { [index]: [1, 2] };
  const next = { ...map, lowerOverlayTiles, upperOverlayTiles, shadowBits, lowerTileStacks };
  return { project: withMap(project, next), map: next, index };
}

async function applied(
  project: Project, map: GameMap, id: string, args: Record<string, unknown>, selection?: Rect,
  inspect?: (after: GameMap, result: Project) => void,
): Promise<void> {
  const target = mapTarget(project, map.id)!;
  const beforeMap = structuredClone(map);
  const tileset = project.tilesets[map.tilesetId];
  const originalPassage = tileset.passability.map(row => ({ ...row }));
  const { after, sentence } = runPrimitive(project, target, id, args, selection && { rect: selection });
  expect(sentence).toMatch(/^[가-힣0-9 ·]+\.$/u);
  expect(sentence.length).toBeLessThanOrEqual(80);
  expect(sentence).not.toContain(id);
  expect(jsonEqual(project.maps[map.id], beforeMap)).toBe(true);
  expect(jsonEqual(project.tilesets[map.tilesetId].passability, originalPassage)).toBe(true);
  const edited = after.maps[map.id];
  expect(edited.tilesetId).toBe(map.tilesetId);
  expect(edited.events).toBe(map.events);
  expect(after.startPos).toBe(project.startPos);
  if (id !== "map.tile.setPassability") expect(after.tilesets).toBe(project.tilesets);
  inspect?.(edited, after);
  await expectUndoRestores(project, after, target);
}

function execute(project: Project, map: GameMap, id: string, args: Record<string, unknown>, selection: Rect) {
  return runPrimitive(project, mapTarget(project, map.id)!, id, args, { rect: selection }).after;
}

describe("맵 타일 적용과 한 번의 실행 취소", () => {
  it("눈밭 한 칸만 칠하고 같은 칸의 물건을 보존한다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.tile.paint", { x: 4, y: 5, tile: 4 }, rect(4, 5), after => {
      expect(cellLayerTiles(after, index)).toEqual([4, 2, 399, 454]);
      expect(shadowAt(after, index)).toBe(1);
    });
  });

  it("위층 물건과 받침 위 물건을 지우고 바닥과 그림자를 보존한다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.tile.erase", {}, rect(4, 5), after => {
      expect(cellLayerTiles(after, index)).toEqual([1, 2, -1, -1]);
      expect(shadowAt(after, index)).toBe(1);
    });
  });

  it("마왕 편의점 맵의 선택한 세 칸만 같은 타일로 채운다", async () => {
    const { project, map } = fixture("maou", "map_mk_konbini");
    const tile = 10455;
    await applied(project, map, "map.region.fill", { tile, layer: "4" }, rect(0, 0, 3), after => {
      expect(after.upperOverlayTiles?.slice(0, 4)).toEqual([tile, tile, tile, map.upperOverlayTiles?.[3] ?? -1]);
    });
  }, 180_000);

  it("현재 타일셋의 두 칸짜리 긴 의자를 찍는다", async () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const index = 6 * map.width + 5;
    await applied(project, map, "map.object.stamp", { objectId: "sn-bench" }, rect(5, 6, 2), after => {
      expect(after.upperTiles.slice(index, index + 2)).toEqual([607, 608]);
    });
  });

  it("타일 네 층과 그림자와 옛 타일 더미를 옆 칸으로 복제한다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.region.copy", { x: 4, y: 5, w: 1, h: 1, dx: 1, dy: 0 }, rect(4, 5, 2), after => {
      expect(cellLayerTiles(after, index)).toEqual([1, 2, 399, 454]);
      expect(cellLayerTiles(after, index + 1)).toEqual([1, 2, 399, 454]);
      expect(shadowAt(after, index + 1)).toBe(1);
      expect(after.lowerTileStacks?.[index + 1]).toEqual([1, 2]);
    });
  });

  it("겹치는 이동에서도 원본 두 칸을 순서대로 읽고 비워진 칸만 지운다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.region.move", { x: 4, y: 5, w: 2, h: 1, dx: 1, dy: 0 }, rect(4, 5, 3), after => {
      expect(cellLayerTiles(after, index)).toEqual([-1, -1, -1, -1]);
      expect(cellLayerTiles(after, index + 1)).toEqual([1, 2, 399, 454]);
      expect(cellLayerTiles(after, index + 2)).toEqual(cellLayerTiles(map, index + 1));
      expect(shadowAt(after, index)).toBe(0);
      expect(shadowAt(after, index + 1)).toBe(1);
    });
  });

  it("좌우 대칭으로 타일과 칸 안의 그림자 방향까지 뒤집는다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.region.mirror", { axis: "horizontal" }, rect(4, 5, 2), after => {
      expect(cellLayerTiles(after, index)).toEqual(cellLayerTiles(map, index + 1));
      expect(cellLayerTiles(after, index + 1)).toEqual([1, 2, 399, 454]);
      expect(shadowAt(after, index + 1)).toBe(2);
    });
  });

  it("맵 전체에서는 타일과 그림자만 오른쪽 두 칸으로 민다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.tile.shift", { dx: 2, dy: 0 }, undefined, after => {
      expect(cellLayerTiles(after, index + 2)).toEqual([1, 2, 399, 454]);
      expect(shadowAt(after, index + 2)).toBe(1);
      expect(after.lowerTiles[5 * map.width]).toBe(727);
    });
  });

  it("작은 커스텀 타일셋의 빈 바닥을 밀 때 다른 타일셋의 칸 번호를 쓰지 않는다", () => {
    const { project, map } = fixture("blank");
    const id = "custom_test_tiles";
    const tileset: TilesetDef = {
      id, name: "타일 한 칸", image: project.tilesets[map.tilesetId].image,
      tileSize: map.tileSize, tilesPerRow: 1, count: 1,
      passability: [{ up: true, down: true, left: true, right: true }], priority: ["lower"], terrain: [0],
    };
    const upperTiles = map.upperTiles.slice();
    upperTiles[0] = 0;
    const source = { ...map, tilesetId: id, lowerTiles: map.lowerTiles.map(() => -1), upperTiles };
    const before = { ...withMap(project, source), tilesets: { ...project.tilesets, [id]: tileset } };
    const { after } = runPrimitive(before, mapTarget(before, map.id)!, "map.tile.shift", { dx: 1, dy: 0 });
    expect(after.maps[map.id].lowerTiles.slice(0, 2)).toEqual([-1, -1]);
    expect(after.maps[map.id].upperTiles.slice(0, 2)).toEqual([-1, 0]);
  });

  it("선택 안에서만 쓰이는 타일의 네 방향 통행을 바꾼다", async () => {
    const { project, map } = fixture("built", BUILT_MAP);
    await applied(project, map, "map.tile.setPassability", { tile: 702, passable: false }, rect(16, 17), (after, result) => {
      expect(after).toBe(map);
      expect(result.tilesets[map.tilesetId].passability[702]).toEqual({ up: false, down: false, left: false, right: false });
      expect(result.tilesets[map.tilesetId].passability[1]).toBe(project.tilesets[map.tilesetId].passability[1]);
    });
  });
});

describe("선택 범위 검증", () => {
  const cases = [
    ["map.tile.paint", { x: 2, y: 1, tile: 4 }, rect(1, 1)],
    ["map.tile.erase", {}, rect(45, 0, 2)],
    ["map.region.fill", { tile: 4 }, rect(45, 0, 2)],
    ["map.object.stamp", { objectId: "sn-bench" }, rect(5, 6)],
    ["map.region.copy", { x: 4, y: 5, w: 1, h: 1, dx: 1, dy: 0 }, rect(4, 5)],
    ["map.region.move", { x: 4, y: 5, w: 1, h: 1, dx: 1, dy: 0 }, rect(4, 5)],
    ["map.region.mirror", { axis: "vertical" }, rect(45, 0, 2)],
    ["map.tile.shift", { dx: 1, dy: 0 }, rect(4, 5)],
    ["map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0)],
  ] as const;

  it.each(cases)("%s의 범위 밖 편집을 거부한다", (id, args, selection) => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(() => execute(project, map, id, args, selection)).toThrow(/범위 밖/u);
  });

  it("실제 맵 가드는 범위를 벗어난 타일이나 맵 속성 변경을 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const target = mapTarget(project, map.id)!;
    const primitive = PRIMITIVES.find(p => p.id === "map.tile.paint")!;
    const args = { x: 0, y: 0, tile: 4 };
    const scope = primitive.scope({ project, target, selection: { rect: rect(0, 0) } }, args);
    const lowerTiles = map.lowerTiles.slice();
    lowerTiles[1] = 4;
    const result = checkSmallTaskScope(project, withMap(project, { ...map, lowerTiles, name: "바뀐 이름" }), scope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/범위 밖/u);
  });

  it("없는 타일과 없는 물건을 한국어 오류로 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(() => execute(project, map, "map.tile.paint", { x: 0, y: 0, tile: 99999 }, rect(0, 0)))
      .toThrow(PrimitiveError);
    expect(() => execute(project, map, "map.object.stamp", { objectId: "unknown_kit" }, rect(0, 0)))
      .toThrow("놓을 물건을 찾을 수 없어요.");
  });

  it("고정한 지형 타일은 선택에 들어 있어도 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const next = { ...map, terrainDesign: { ...map.terrainDesign, lockedCells: [0] } };
    expect(() => execute(withMap(project, next), next, "map.tile.paint", { x: 0, y: 0, tile: 4 }, rect(0, 0)))
      .toThrow(/범위 밖.*보호된 타일/u);
  });
});

describe("플레이 이동 판정", () => {
  it("빈 프로젝트에서 막힌 4층을 칠하면 진입할 수 없다", () => {
    const { project, map } = fixture("blank");
    const tile = project.tilesets[map.tilesetId].passability.findIndex(flags => flags && !Object.values(flags).some(Boolean));
    expect(tile).toBeGreaterThanOrEqual(0);
    const edited = execute(project, map, "map.tile.paint", { x: 5, y: 6, tile, layer: "4" }, rect(5, 6));
    expect(canMove(project, map, 6, 6, 5, 6)).toBe(true);
    expect(canMove(edited, edited.maps[map.id], 6, 6, 5, 6)).toBe(false);
  });

  it("위층의 막힌 타일을 지우면 바닥을 다시 걸을 수 있다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(canMove(project, map, 5, 6, 4, 6)).toBe(false);
    const edited = execute(project, map, "map.tile.erase", {}, rect(4, 6));
    expect(canMove(edited, edited.maps[map.id], 5, 6, 4, 6)).toBe(true);
  });

  it("통행 설정이 이웃 칸에서 드나드는 플레이 이동 양쪽에 적용된다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(canMove(project, map, 17, 17, 16, 17)).toBe(true);
    const edited = execute(project, map, "map.tile.setPassability", { tile: 702, passable: false }, rect(16, 17));
    expect(canMove(edited, edited.maps[map.id], 17, 17, 16, 17)).toBe(false);
    expect(canMove(edited, edited.maps[map.id], 16, 17, 17, 17)).toBe(false);
  });
});
