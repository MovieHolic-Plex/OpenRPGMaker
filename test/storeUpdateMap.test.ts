import { beforeEach, describe, expect, it } from "vitest";
import { moveEvent, createDefaultGameEvent } from "@/editor/eventActions";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { paintTile } from "@/editor/tileActions";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";

beforeEach(() => {
  store.replace(createBlankProject());
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
});

describe("store.updateMap", () => {
  it("replaces only the target map and structurally shares the rest of the project", () => {
    const project = createBlankProject();
    const targetMapId = project.startMapId;
    const otherMap = createBlankMap("공유 확인 맵", 8, 8);
    project.maps[otherMap.id] = otherMap;
    project.mapTree.children.push({ mapId: otherMap.id, children: [] });
    store.replace(project);

    const before = store.getCurrent();
    const beforeTargetMap = before.maps[targetMapId];
    const beforeOtherMap = before.maps[otherMap.id];
    const beforeTilesets = before.tilesets;
    const beforeDatabase = before.database;

    store.updateMap(targetMapId, (map) => {
      map.lowerTiles[0] = TILE.WATER;
    }, { cells: [{ x: 0, y: 0, layer: "lower" }] });

    const after = store.getCurrent();
    expect(after).not.toBe(before);
    expect(after.maps).not.toBe(before.maps);
    expect(after.maps[targetMapId]).not.toBe(beforeTargetMap);
    expect(after.maps[otherMap.id]).toBe(beforeOtherMap);
    expect(after.tilesets).toBe(beforeTilesets);
    expect(after.database).toBe(beforeDatabase);
    expect(beforeTargetMap.lowerTiles[0]).not.toBe(TILE.WATER);
    expect(after.maps[targetMapId].lowerTiles[0]).toBe(TILE.WATER);
  });

  it("does not let later map patches mutate the persisted baseline snapshot", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].lowerTiles[0] = TILE.GRASS;
    store.replace(project);
    store._setPersistedBaselineForTest(structuredClone(store.getCurrent()));

    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = TILE.WATER;
    });
    store.updateMap(mapId, (map) => {
      map.lowerTiles[1] = TILE.SAND;
    });

    const baseline = store._getPersistedBaselineForTest();
    expect(baseline).not.toBeNull();
    expect(baseline?.maps[mapId]).not.toBe(store.getCurrent().maps[mapId]);
    expect(baseline?.maps[mapId].lowerTiles[0]).toBe(TILE.GRASS);
    expect(baseline?.maps[mapId].lowerTiles[1]).not.toBe(TILE.SAND);
  });

  it("keeps map-kind history snapshots isolated from later updateMap edits", () => {
    const mapId = store.getCurrent().startMapId;
    const before = store.getCurrent().maps[mapId].lowerTiles[0];

    recordProjectSnapshot("맵 패치 전", mapId, { kind: "map" });
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = TILE.WATER;
    });
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = TILE.SAND;
    });

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(before);
  });
});

describe("map-only editor actions on updateMap", () => {
  it("paintTile and moveEvent preserve shared project subtrees outside the edited map", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = createDefaultGameEvent(1, 1);
    project.maps[mapId].events.push(event);
    store.replace(project);

    const beforePaint = store.getCurrent();
    paintTile(mapId, "lower", 1, 1, TILE.WATER, { autoConnect: false });
    expect(store.getCurrent().tilesets).toBe(beforePaint.tilesets);
    expect(store.getCurrent().database).toBe(beforePaint.database);

    const beforeMove = store.getCurrent();
    moveEvent(mapId, event.id, 3, 4);
    expect(store.getCurrent().tilesets).toBe(beforeMove.tilesets);
    expect(store.getCurrent().maps[mapId]).not.toBe(beforeMove.maps[mapId]);
    expect(store.getCurrent().maps[mapId].events.find((item) => item.id === event.id)).toMatchObject({ x: 3, y: 4 });
  });
});
