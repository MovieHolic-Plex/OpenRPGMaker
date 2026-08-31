import { beforeEach, describe, expect, it } from "vitest";
import { eraseTile, fillTile, paintTile, toggleCollision } from "@/editor/actions";
import { replaceTileStack } from "@/project/mapOverlayTiles";
import { createBlankProject, TILE } from "@/project/defaults";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { findByTestId, installFakeDom } from "./fakeDom";

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
  return map.upperTiles[i];
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

  it("실내 투명 배경 가구를 lower로 칠해도 바닥을 보존하고 upper에 배치한다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    project.maps[mapId].tilesetId = "easyrpg_chipset_interior";

    paintTile(mapId, "lower", 3, 3, 270);
    paintTile(mapId, "lower", 3, 3, 115);
    paintTile(mapId, "lower", 4, 3, 270);
    paintTile(mapId, "lower", 4, 3, 268);

    const map = currentMap();
    expect(at(map, 3, 3)).toBe(270);
    expect(upperAt(map, 3, 3)).toBe(115);
    expect(at(map, 4, 3)).toBe(270);
    expect(upperAt(map, 4, 3)).toBe(268);
  });

  it("투명 소품을 칠해도 스택을 만들지 않고 대상 레이어의 단일 타일로 교체한다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    project.maps[mapId].tilesetId = "easyrpg_chipset_interior";

    paintTile(mapId, "lower", 3, 3, 270);
    paintTile(mapId, "lower", 3, 3, 115);
    paintTile(mapId, "lower", 3, 3, 268);

    const map = currentMap();
    const index = 3 + 3 * map.width;
    expect(at(map, 3, 3)).toBe(270);
    expect(upperAt(map, 3, 3)).toBe(268);
    expect(map.upperTileStacks?.[index]).toBeUndefined();
  });

  it("기본 선택 타일 360을 칠해도 흙길 오토타일로 연결된다", () => {
    const mapId = store.getCurrent().startMapId;

    paintTile(mapId, "lower", 1, 1, TILE.PATH);
    paintTile(mapId, "lower", 2, 1, TILE.PATH);
    paintTile(mapId, "lower", 1, 2, TILE.PATH);
    paintTile(mapId, "lower", 2, 2, TILE.PATH);

    const map = currentMap();
    expect(at(map, 1, 1)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
    expect(at(map, 2, 1)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_EAST);
    expect(at(map, 1, 2)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_WEST);
    expect(at(map, 2, 2)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
  });

  it("기본 선택 모래 타일을 칠해도 모래 지형 오토타일로 연결된다", () => {
    const mapId = store.getCurrent().startMapId;

    paintTile(mapId, "lower", 1, 1, TILE.SAND);
    paintTile(mapId, "lower", 2, 1, TILE.SAND);
    paintTile(mapId, "lower", 1, 2, TILE.SAND);
    paintTile(mapId, "lower", 2, 2, TILE.SAND);

    const map = currentMap();
    expect(at(map, 1, 1)).toBe(SAND_TILE.CORNER_NORTH_WEST);
    expect(at(map, 2, 1)).toBe(SAND_TILE.CORNER_NORTH_EAST);
    expect(at(map, 1, 2)).toBe(SAND_TILE.CORNER_SOUTH_WEST);
    expect(at(map, 2, 2)).toBe(SAND_TILE.CORNER_SOUTH_EAST);
  });

  it("물을 모래 옆에 칠하면 인접 모래 지형도 다시 오토타일된다", () => {
    const mapId = store.getCurrent().startMapId;

    paintTile(mapId, "lower", 1, 1, TILE.SAND);
    paintTile(mapId, "lower", 2, 1, TILE.SAND);
    paintTile(mapId, "lower", 1, 2, TILE.SAND);
    paintTile(mapId, "lower", 2, 2, TILE.SAND);
    paintTile(mapId, "lower", 0, 1, TILE.WATER);

    expect(at(currentMap(), 1, 1)).toBe(SAND_TILE.EDGE_NORTH);
  });

  it("hard 클러스터 규칙이 있는 나무는 수동 펜 페인트에서도 동반 타일을 원자적으로 배치한다", () => {
    const mapId = store.getCurrent().startMapId;

    paintTile(mapId, "lower", 1, 1, 260);
    paintTile(mapId, "lower", 4, 1, 262);

    const map = currentMap();
    expect(upperAt(map, 1, 1)).toBe(260);
    expect(upperAt(map, 1, 2)).toBe(290);
    expect(upperAt(map, 4, 1)).toBe(262);
    expect(upperAt(map, 5, 1)).toBe(263);
    expect(upperAt(map, 4, 2)).toBe(292);
    expect(upperAt(map, 5, 2)).toBe(293);
  });

  it("hard 클러스터 동반 타일이 경계나 보호셀에 걸리면 수동 펜 배치를 거부하고 토스트를 띄운다", () => {
    const restoreDom = installFakeDom();
    try {
      const toastText = (): string | undefined => findByTestId(
        document.body as unknown as Parameters<typeof findByTestId>[0],
        "toast"
      )?.textContent;
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = currentMap();
      const bottomY = map.height - 1;
      const beforeBoundary = [...map.upperTiles];

      paintTile(mapId, "lower", 1, bottomY, 260);

      expect(currentMap().upperTiles).toEqual(beforeBoundary);
      expect(toastText()).toContain("맵 경계");

      const protectedMap = currentMap();
      protectedMap.events.push({ id: "event_under_tree", x: 3, y: 2, trigger: { kind: "action" }, commands: [] });
      const beforeProtected = [...protectedMap.upperTiles];

      paintTile(mapId, "lower", 3, 1, 260);

      expect(currentMap().upperTiles).toEqual(beforeProtected);
      expect(toastText()).toContain("보호셀");
    } finally {
      restoreDom();
    }
  });

  it("덧그림에 공백을 칠하면 덧그림만 비우고 바닥은 남긴다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 5, 5, TILE.WATER);
    paintTile(mapId, "upper", 5, 5, TILE.FLOWERS);
    paintTile(mapId, "upper", 5, 5, TILE.EMPTY);
    expect(upperAt(currentMap(), 5, 5)).toBe(TILE.EMPTY);
    expect(at(currentMap(), 5, 5)).toBe(TILE.WATER);
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

  it("선택 레이어의 기본 타일과 스택을 한 번에 지운다", () => {
    const mapId = store.getCurrent().startMapId;
    const map = currentMap();
    const index = 7 + 6 * map.width;
    map.lowerTiles[index] = TILE.GRASS;
    replaceTileStack(map, "lower", index, [TILE.FLOWERS]);

    eraseTile(mapId, "lower", 7, 6);

    expect(at(currentMap(), 7, 6)).toBe(TILE.EMPTY);
    expect(currentMap().lowerTileStacks?.[index]).toBeUndefined();
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
