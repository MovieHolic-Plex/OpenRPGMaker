import { beforeEach, describe, expect, it } from "vitest";
import { eraseTile, fillTile, paintTile, toggleCollision } from "@/editor/actions";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

// M1 핵심 워크플로우 단위 검증: 타일 페인트/채우기/지우개 + 통행 토글.
// 브라우저 없이 store.update 경로의 결과를 직접 단언한다.

function currentMap(): GameMap {
  const project = store.getCurrent();
  return project.maps[project.startMapId];
}

function at(map: GameMap, x: number, y: number): number {
  return map.lowerTiles[y * map.width + x];
}

function upperAt(map: GameMap, x: number, y: number): number {
  const i = y * map.width + x;
  // 스택 오버레이 타일(FLOWERS 등)은 upperTileStacks에 쌓이므로 top을 우선 본다.
  return topTileInStack(map, "upper", i) ?? map.upperTiles[i];
}

beforeEach(() => {
  store.replace(createBlankProject());
});

describe("paintTile — layer routing", () => {
  it("lower 타일을 페인트하면 lowerTiles에 반영된다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    const map = currentMap();
    expect(at(map, 1, 1)).toBe(TILE.WATER);
  });

  it("페인트 전에 있던 같은 위치 타일을 덮어쓴다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 2, 2, TILE.WATER);
    paintTile(mapId, "lower", 2, 2, TILE.GRASS);
    expect(at(currentMap(), 2, 2)).toBe(TILE.GRASS);
  });

  it("맵 경계 밖 페인트는 무시된다 (예외 없음)", () => {
    const mapId = store.getCurrent().startMapId;
    const map = currentMap();
    const before = [...map.lowerTiles];
    expect(() => paintTile(mapId, "lower", -1, -1, TILE.WATER)).not.toThrow();
    expect(() => paintTile(mapId, "lower", 9999, 9999, TILE.WATER)).not.toThrow();
    expect(currentMap().lowerTiles).toEqual(before);
  });
});

describe("fillTile — flood fill", () => {
  it("시작 셀과 동일한 타일의 연결 영역을 채운다", () => {
    const mapId = store.getCurrent().startMapId;
    // 시작 맵은 기본적으로 비어있거나 GRASS로 채워져 있을 수 있으므로,
    // 먼저 한 칸을 WATER로 만들고 그 칸에서 flood fill 로 되돌려 확인.
    const map = currentMap();
    const firstTile = at(map, 0, 0);
    fillTile(mapId, "lower", 0, 0, TILE.WATER);
    expect(at(currentMap(), 0, 0)).toBe(TILE.WATER);
    // 다시 원래 타일로 flood fill — WATER로 묶인 연결 영역이 복원되어야 함
    fillTile(mapId, "lower", 0, 0, firstTile);
    expect(at(currentMap(), 0, 0)).toBe(firstTile);
  });

  it("대상 타일이 이미 같으면 변경하지 않는다 (no-op)", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 3, 3, TILE.GRASS);
    const before = [...currentMap().lowerTiles];
    fillTile(mapId, "lower", 3, 3, TILE.GRASS);
    expect(currentMap().lowerTiles).toEqual(before);
  });

  it("서로 다른 타일로 둘러싸인 영역은 경계에서 멈춘다", () => {
    const mapId = store.getCurrent().startMapId;
    // 3x3 영역을 WATER 벽으로 둘러싸고, 내부를 GRASS로 채운다
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        paintTile(mapId, "lower", x, y, TILE.WATER);
      }
    }
    paintTile(mapId, "lower", 1, 1, TILE.GRASS);
    paintTile(mapId, "lower", 2, 1, TILE.GRASS);
    paintTile(mapId, "lower", 1, 2, TILE.GRASS);
    paintTile(mapId, "lower", 2, 2, TILE.GRASS);

    // (2,2)에서 GRASS flood fill → 4칸만 GRASS, 벽(WATER)은 그대로
    fillTile(mapId, "lower", 2, 2, TILE.GRASS);
    const map = currentMap();
    // 내부 4칸은 GRASS
    expect(at(map, 1, 1)).toBe(TILE.GRASS);
    expect(at(map, 2, 1)).toBe(TILE.GRASS);
    expect(at(map, 1, 2)).toBe(TILE.GRASS);
    expect(at(map, 2, 2)).toBe(TILE.GRASS);
    // 벽은 WATER 유지
    expect(at(map, 0, 0)).toBe(TILE.WATER);
    expect(at(map, 3, 3)).toBe(TILE.WATER);
  });
});

describe("eraseTile", () => {
  it("페인트한 타일을 지우면 EMPTY가 된다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 4, 4, TILE.WATER);
    expect(at(currentMap(), 4, 4)).toBe(TILE.WATER);
    eraseTile(mapId, "lower", 4, 4);
    expect(at(currentMap(), 4, 4)).toBe(TILE.EMPTY);
  });

  it("맵 경계 밖 지우기는 무시된다 (예외 없음)", () => {
    const mapId = store.getCurrent().startMapId;
    expect(() => eraseTile(mapId, "lower", -5, -5)).not.toThrow();
    expect(() => eraseTile(mapId, "lower", 9999, 9999)).not.toThrow();
  });

  it("upper 레이어를 지워도 lower 레이어는 보존된다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 5, 5, TILE.WATER);
    paintTile(mapId, "upper", 5, 5, TILE.FLOWERS);
    expect(upperAt(currentMap(), 5, 5)).toBe(TILE.FLOWERS);
    eraseTile(mapId, "upper", 5, 5);
    expect(upperAt(currentMap(), 5, 5)).toBe(TILE.EMPTY);
    expect(at(currentMap(), 5, 5)).toBe(TILE.WATER);
  });
});

describe("toggleCollision", () => {
  function passageOf(tile: number) {
    const ts = store.getCurrent().tilesets[store.getCurrent().maps[store.getCurrent().startMapId].tilesetId];
    return ts.passability[tile];
  }

  it("통행 가능 타일을 토글하면 solid가 된다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 0, 0, TILE.GRASS);
    const before = passageOf(TILE.GRASS);
    toggleCollision(mapId, 0, 0);
    const after = passageOf(TILE.GRASS);
    expect(after.up && after.down && after.left && after.right).toBe(false);
    expect(before.up && before.down && before.left && before.right).toBe(true);
  });

  it("solid 타일을 다시 토글하면 통행 가능으로 돌아간다 (왕복)", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 0, 0, TILE.GRASS);
    const original = { ...passageOf(TILE.GRASS) };
    toggleCollision(mapId, 0, 0); // -> solid
    toggleCollision(mapId, 0, 0); // -> passable
    const after = passageOf(TILE.GRASS);
    expect(after).toEqual(original);
  });

  it("맵 경계 밖 토글은 무시된다 (예외 없음)", () => {
    const mapId = store.getCurrent().startMapId;
    expect(() => toggleCollision(mapId, -1, -1)).not.toThrow();
    expect(() => toggleCollision(mapId, 9999, 9999)).not.toThrow();
  });
});
