import { beforeEach, describe, expect, it } from "vitest";
import { moveEvent, createDefaultGameEvent } from "@/editor/eventActions";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit, pendingHistoryLabels, recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { paintTile, paintRelief } from "@/editor/tileActions";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import { setMapTileset } from "@/editor/actions";
import { isolateTimers } from "./mergedTeardown";

describe("storeUpdateMap", () => {
  isolateTimers();
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
});

// 지형 리뷰 F1: 칩셋을 바꾼 뒤 Ctrl+Z 한 번이 바로 앞 지형 획까지 지웠다.
// setMapTileset 이 맵 기록을 남기지 않아, 되돌리기가 획 시작 스냅샷(옛 칩셋·획 전 높이)을 복원했기 때문이다.
// 칩셋 변경은 그 자체로 되돌리기 한 단계여야 한다.
describe("tilesetChangeUndo", () => {
  isolateTimers();
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  describe("칩셋 변경은 되돌리기 한 단계다", () => {
    it("Ctrl+Z 한 번은 칩셋만 되돌리고 앞 지형 획은 남긴다", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId]!;
      const other = Object.values(project.tilesets).find((t) => t.id !== map.tilesetId && t.tileSize === map.tileSize);
      if (!other) throw new Error("같은 크기의 다른 칩셋이 픽스처에 없습니다");
      const originalTileset = map.tilesetId;

      recordMapEditIfChanged(map.id, () => { paintRelief(map.id, 5, 5, "raise", { radius: 2, level: 1 }); }, { label: "높이 · 높이 올리기" });
      const raised = store.getCurrent().maps[map.id]!.relief!.levels.filter((v) => v > 0).length;
      expect(raised).toBeGreaterThan(0);

      setMapTileset(map.id, other.id);
      expect(store.getCurrent().maps[map.id]!.tilesetId).toBe(other.id);
      expect(pendingHistoryLabels().undo).toContain("칩셋 변경");

      expect(undoMapEdit()).toBe(true);
      const afterUndo = store.getCurrent().maps[map.id]!;
      expect(afterUndo.tilesetId).toBe(originalTileset);
      expect(afterUndo.relief!.levels.filter((v) => v > 0).length).toBe(raised);

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[map.id]!.relief?.levels.some((v) => v > 0) ?? false).toBe(false);
    });
  });
});
