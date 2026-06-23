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

  it("FLOWERS(mixed 타일)는 요청한 레이어를 따른다", () => {
    // mixed 그룹(FLOWERS/TREE 등)은 harness가 null을 반환하므로 요청 레이어를 존중.
    // stackable 오버레이이므로 해당 레이어 스택에 쌓인다.
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 1, 1, TILE.FLOWERS);
    expect(lowerAt(currentMap(), 1, 1)).toBe(TILE.FLOWERS);

    // upper로 요청하면 upper 스택으로 간다
    paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);
    expect(upperAt(currentMap(), 2, 2)).toBe(TILE.FLOWERS);
  });
});
