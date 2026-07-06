import { beforeEach, describe, expect, it } from "vitest";
import { eraseTile, paintTile } from "@/editor/actions";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import type { GameMap, MapId } from "@/project/types";

// M1: 3레이어(lower/upper/event) 독립성 + harness 기반 자동 라우팅 검증.
// 핵심 — 한 레이어를 편집해도 다른 레이어 데이터는 보존되어야 한다.

function currentMap(): GameMap {
  const project = store.getCurrent();
  return project.maps[project.startMapId];
}

function lowerAt(map: GameMap, x: number, y: number): number {
  const i = y * map.width + x;
  return topTileInStack(map, "lower", i) ?? map.lowerTiles[i];
}

function upperAt(map: GameMap, x: number, y: number): number {
  const i = y * map.width + x;
  return topTileInStack(map, "upper", i) ?? map.upperTiles[i];
}

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: null,
    tool: "paint",
    layer: "lower",
    selectedTile: TILE.GRASS,
    selectedEventId: null,
    selection: null,
    clipboard: null,
  });
});

describe("레이어 독립성 — 한 레이어 편집이 다른 레이어를 침범하지 않는다", () => {
  it("lower에 페인트 후 upper를 페인트해도 lower는 유지된다", () => {
    const mapId: MapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    paintTile(mapId, "upper", 1, 1, TILE.FLOWERS);

    const map = currentMap();
    expect(lowerAt(map, 1, 1)).toBe(TILE.WATER);
    expect(upperAt(map, 1, 1)).toBe(TILE.FLOWERS);
  });

  it("upper를 지워도 lower는 그대로다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 2, 2, TILE.GRASS);
    paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);
    eraseTile(mapId, "upper", 2, 2);

    const map = currentMap();
    expect(upperAt(map, 2, 2)).toBe(TILE.EMPTY);
    expect(lowerAt(map, 2, 2)).toBe(TILE.GRASS);
  });

  it("두 레이어에 서로 다른 타일이 공존할 수 있다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 3, 3, TILE.WATER);
    paintTile(mapId, "upper", 3, 3, TILE.FLOWERS);
    paintTile(mapId, "lower", 4, 4, TILE.GRASS);
    paintTile(mapId, "upper", 4, 4, TILE.FLOWERS);

    const map = currentMap();
    expect(lowerAt(map, 3, 3)).toBe(TILE.WATER);
    expect(upperAt(map, 3, 3)).toBe(TILE.FLOWERS);
    expect(lowerAt(map, 4, 4)).toBe(TILE.GRASS);
    expect(upperAt(map, 4, 4)).toBe(TILE.FLOWERS);
  });
});

describe("editorState 레이어 전환", () => {
  it("layer를 upper로 전환해도 lower 데이터에 영향을 주지 않는다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    const lowerBefore = lowerAt(currentMap(), 1, 1);

    editorState.set({ layer: "upper" });
    // editorState만 바꿨으니 맵 데이터는 그대로
    expect(lowerAt(currentMap(), 1, 1)).toBe(lowerBefore);
  });

  it("event 레이어로 전환해도 lower/upper 타일은 보존된다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 2, 2, TILE.GRASS);
    paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);
    const mapBefore = currentMap();

    editorState.set({ layer: "event" });
    const mapAfter = currentMap();
    expect(lowerAt(mapAfter, 2, 2)).toBe(lowerAt(mapBefore, 2, 2));
    expect(upperAt(mapAfter, 2, 2)).toBe(upperAt(mapBefore, 2, 2));
  });
});

describe("effectiveLayer — harness 라우팅 동작", () => {
  it("WATER(lower 고정 타일)를 upper로 요청해도 lower에 배치된다", () => {
    // harness가 lower로 고정한 타일은 요청 레이어와 무관하게 lower로 간다.
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "upper", 1, 1, TILE.WATER);
    expect(lowerAt(currentMap(), 1, 1)).toBe(TILE.WATER);
    expect(upperAt(currentMap(), 1, 1)).toBe(TILE.EMPTY);
  });

  it("FLOWERS(투명 칩)는 하위 요청에도 상위로 라우팅되어 지면을 보존한다", () => {
    // 투명 배경 칩은 하위에 깔리면 투명 부분 아래가 검게 보이므로 상위 전용이다.
    const mapId = store.getCurrent().startMapId;
    const groundBefore = lowerAt(currentMap(), 1, 1);
    paintTile(mapId, "lower", 1, 1, TILE.FLOWERS);
    expect(upperAt(currentMap(), 1, 1)).toBe(TILE.FLOWERS);
    expect(lowerAt(currentMap(), 1, 1)).toBe(groundBefore); // 지면 보존.

    // upper로 요청해도 당연히 upper.
    paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);
    expect(upperAt(currentMap(), 2, 2)).toBe(TILE.FLOWERS);
  });
});

// Phase 0-5: 울타리/소품이 하위 레이어로 강제되어 지면을 지우던 버그의 회귀 테스트.
// 울타리 타일(378~380/408~410/438~439)은 stackable 소품이므로 상위 레이어에 올려
// 아래 지면(잔디 등)을 보존해야 한다.
describe("소품(울타리)이 하위 지면을 지우지 않는다", () => {
  const FENCE_TILES = [378, 379, 380, 408, 409, 410, 438, 439];

  it("잔디 위에 울타리를 칠해도 잔디(lower)가 보존된다", () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 6, 6, TILE.GRASS);
    // 하위 레이어를 요청해도 stackable 소품은 상위로 라우팅되어 잔디를 덮지 않는다.
    paintTile(mapId, "lower", 6, 6, 378);

    const map = currentMap();
    expect(lowerAt(map, 6, 6)).toBe(TILE.GRASS);
    expect(upperAt(map, 6, 6)).toBe(378);
  });

  it("모든 울타리 타일이 지면을 보존한다", () => {
    const mapId = store.getCurrent().startMapId;
    for (const [n, fence] of FENCE_TILES.entries()) {
      const x = 2 + n;
      paintTile(mapId, "lower", x, 8, TILE.DARK_GRASS);
      paintTile(mapId, "lower", x, 8, fence);
      const map = currentMap();
      expect(lowerAt(map, x, 8)).toBe(TILE.DARK_GRASS);
      expect(upperAt(map, x, 8)).toBe(fence);
    }
  });
});
