import { describe, expect, it, beforeEach } from "vitest";
import { lightingGradientParams, type LightingMaskContext } from "@/player/lighting";
import { lightAtTile, lightFalloffAt } from "@/project/lightingRules";
import { isNpcSight, withinSightRange } from "@/project/npcBehavior";
import type { LightingState, GameMap, Project, MapNamedLocation, MapId, GameEvent } from "@/project/types";
import { collectMapLocationReferences, countLocationReferences, repairMapLocationReferences } from "@/project/mapLocationReferences";
import { createBlankProject, TILE } from "@/project/defaults";
import { hasLocationRole, locationRoleRects, locationRoleTag, projectLocationRoles } from "@/project/locationRoles";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { paintTile } from "@/editor/tileActions";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { mapEdgeDragTarget, mapEdgeGrowAxes, mapEdgeGrowCursor, NO_MAP_EDGE_SIDES } from "@/editor/mapEdgeGrow";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { collectMapInspection, isFolderNode, reachableMapIdsFromStart } from "@/project/mapInspection";
import { collectMapLinkGraph, collectMapLinkStats } from "@/project/mapLinkStats";
import { loopStepTarget, wrapLoopPosition } from "@/project/mapLoop";
import { runTool, type ToolContext } from "@/editor/tools";
import { deserialize, serialize } from "@/project/io";
import { activePlanningItems, describePlanningReuse, formatPlanningReuseBlock, makeMapPlanningItemId, MAP_PLANNING_ITEM_TEXT_MAX, normalizeMapPlanningItems, normalizePlanningItemText, planningTextFromSpecAsset, resolvePlanningReuse, type MapPlanningItem } from "@/project/mapPlanningItems";
import { maxTemplateOverlap, templateOverlap, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { mapWorldScale, playPixelDensity, projectReferenceTileSize } from "@/project/mapViewScale";
import { isolateTimers } from "./mergedTeardown";

describe("lightFollowsFigure", () => {
  isolateTimers();
  const context = (resolveAnchor: LightingMaskContext["resolveAnchor"]): LightingMaskContext => ({
    viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0, resolveAnchor,
  });
  const lamp: LightingState = { ambient: 0.8, color: "#000000", sources: [{ id: "lamp", at: { eventId: "ev_guard" }, radius: 3.5, intensity: 0.8 }] };
  describe("event-anchored light follows the figure", () => {
    it("dims with the carrier's opacity and goes out with it", () => {
      const at = (fade?: number) => () => ({ x: 4, y: 4, ...(fade === undefined ? {} : { fade }) });
      expect(lightingGradientParams(lamp, context(at())).gradients[0]?.intensity).toBeCloseTo(0.8);
      expect(lightingGradientParams(lamp, context(at(0.5))).gradients[0]?.intensity).toBeCloseTo(0.4);
      expect(lightingGradientParams(lamp, context(() => undefined)).gradients).toEqual([]);
      expect(lightAtTile(lamp, 4, 5, at(0))).toBe(false);
      expect(lightAtTile(lamp, 4, 5, at(1))).toBe(true);
    });
  });
  describe("hard-edged sight light and circular sight agree", () => {
    it("keeps the hard edge readable at the rim while the inside falls off like a lantern", () => {
      // 끝 가까이에도 빛이 남아 테두리가 읽힌다(부드러운 곡선은 거의 0).
      expect(lightFalloffAt(0.9, "hard")).toBeGreaterThan(0.2);
      expect(lightFalloffAt(0.9)).toBeLessThan(0.1);
      // 안쪽은 고른 판이 아니라 들고 있는 사람 곁이 밝다.
      expect(lightFalloffAt(0.1, "hard")).toBeGreaterThan(lightFalloffAt(0.5, "hard") * 2);
      // 안쪽 낙차(가운데 → 끝 띠 직전)가 끝 계단보다 훨씬 커야 판이 아니라 등불로 읽힌다.
      expect(lightFalloffAt(0.05, "hard") - lightFalloffAt(0.92, "hard")).toBeGreaterThan(lightFalloffAt(0.92, "hard") * 3);
      expect(lightFalloffAt(0.5, "hard")).toBeGreaterThan(lightFalloffAt(0.85, "hard"));
      // 끝 띠는 짧다 — 반지름 94% 너머에서 끊긴다.
      expect(lightFalloffAt(0.99, "hard")).toBeLessThan(0.05);
      const hard = lightingGradientParams({ ...lamp, sources: [{ ...lamp.sources[0]!, at: { x: 1, y: 1 }, edge: "hard" }] }, context((a) => (a === "player" || "eventId" in a ? undefined : a)));
      expect(hard.gradients[0]?.edge).toBe("hard");
    });

    it("circle sight sees exactly the cells whose centre is inside the range + 0.5 lamp", () => {
      const range = 3;
      for (let dx = -5; dx <= 5; dx += 1) for (let dy = -5; dy <= 5; dy += 1) {
        expect(withinSightRange(dx, dy, range, "circle")).toBe(Math.hypot(dx, dy) <= range + 0.5);
      }
      // 맨해튼은 빛 한가운데 대각선(2,2)을 못 보고, 원은 본다.
      expect(withinSightRange(2, 2, range, undefined)).toBe(false);
      expect(withinSightRange(2, 2, range, "circle")).toBe(true);
      expect(withinSightRange(3, 2, range, "circle")).toBe(false);
    });

    it("validates the sight shape", () => {
      expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "circle" })).toBe(true);
      expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "square" })).toBe(false);
    });
  });
});

// 로케이션 ID 는 맵 안에서만 유일하다(loc1, loc2 …). 편집기 참조 화면과 복구가
// 맵 경계를 넘으면 다른 맵의 **다른 장소**를 같은 것으로 취급한다(2026-09-11 적대적 리뷰).
describe("locationReferenceScope", () => {
  isolateTimers();
  function mapWith(id: string, locationId: string, extra: Partial<GameMap> = {}): GameMap {
    return {
      id,
      name: id,
      width: 10,
      height: 10,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(100).fill(0),
      upperTiles: new Array(100).fill(0),
      events: [],
      locations: [{ id: locationId, name: id + " 광장", x: 1, y: 1, w: 2, h: 2 }],
      ...extra,
    };
  }
  function projectWithSharedId(): Project {
    const project = createBlankProject();
    const a = mapWith("map_a", "loc1", {
      encounterTable: [{ troopId: "troop_slime", weight: 1, conditions: { locationId: "loc1" } }],
    });
    const b = mapWith("map_b", "loc1", {
      encounterTable: [{ troopId: "troop_bat", weight: 1, conditions: { locationId: "loc1" } }],
    });
    project.maps = { map_a: a, map_b: b };
    project.startMapId = "map_a";
    return project;
  }
  describe("location reference scope", () => {
    it("mapId 를 주면 그 맵의 참조만 센다", () => {
      const project = projectWithSharedId();
      expect(countLocationReferences(project, "loc1")).toBe(2);
      expect(countLocationReferences(project, "loc1", "map_a")).toBe(1);
      expect(countLocationReferences(project, "loc1", "map_b")).toBe(1);
    });

    it("복구도 그 맵만 고친다 — 다른 맵의 동명 ID 를 건드리지 않는다", () => {
      const project = projectWithSharedId();
      const result = repairMapLocationReferences(project, "loc1", { kind: "detach" }, "map_a");
      expect(result.repaired).toBe(1);
      expect(project.maps.map_a.encounterTable?.[0]?.conditions?.locationId).toBeUndefined();
      expect(project.maps.map_b.encounterTable?.[0]?.conditions?.locationId).toBe("loc1");
    });

    it("mapId 없이 부르면 전량을 복구한다 — 삭제 영향 계산은 그게 맞다", () => {
      const project = projectWithSharedId();
      const result = repairMapLocationReferences(project, "loc1", { kind: "detach" });
      expect(result.repaired).toBe(2);
      expect(collectMapLocationReferences(project)).toHaveLength(0);
    });
  });
});

// 로케이션 역할 → safeZones/farmableArea 투영 (2026-09-12).
describe("locationRoles", () => {
  isolateTimers();
  function location(id: string, extra: Partial<MapNamedLocation> = {}): MapNamedLocation {
    return { id, name: id, x: 1, y: 1, w: 3, h: 2, ...extra };
  }
  function mapWith(locations: MapNamedLocation[], extra: Partial<GameMap> = {}): GameMap {
    return {
      id: "map_a",
      name: "맵",
      width: 20,
      height: 20,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(400).fill(0),
      upperTiles: new Array(400).fill(0),
      events: [],
      locations,
      ...extra,
    };
  }
  describe("location roles", () => {
    it("역할은 태그 하나로 표현되고 정의된 낱말만 인정한다", () => {
      expect(locationRoleTag({ tags: ["safeZone"] })).toBe("safeZone");
      expect(locationRoleTag({ tags: ["아무말"] })).toBeUndefined();
      expect(hasLocationRole({ tags: ["farmable"] }, "farmable")).toBe(true);
      expect(hasLocationRole({ tags: ["farmable"] }, "safeZone")).toBe(false);
    });

    it("역할 구역이 해당 배열로 투영된다", () => {
      const map = mapWith([location("loc1", { tags: ["safeZone"] }), location("loc2", { x: 5, y: 5, tags: ["farmable"] })]);
      // 배열 2건 + 기록 1건. 반환값은 «바뀐 것» 의 수다(무변경 판정에만 쓰인다).
      expect(projectLocationRoles(map)).toBe(3);
      expect(map.safeZones).toEqual([{ x: 1, y: 1, w: 3, h: 2 }]);
      expect(map.farmableArea).toEqual([{ x: 5, y: 5, w: 3, h: 2 }]);
      expect(locationRoleRects(map, "safeZone")).toHaveLength(1);
    });

    it("두 번 투영해도 늘지 않는다(멱등)", () => {
      const map = mapWith([location("loc1", { tags: ["safeZone"] })]);
      // 배열 1건 + 기록 1건.
      expect(projectLocationRoles(map)).toBe(2);
      expect(projectLocationRoles(map)).toBe(0);
      expect(map.safeZones).toHaveLength(1);
    });

    it("손으로 넣은 사각형은 지우지 않는다 — 출처가 다르다", () => {
      // 추격자 툴(make_chase_scene)이 넣은 사각형을 흉내낸다(출처 없는 배열 항목).
      const map = mapWith([location("loc1", { tags: ["safeZone"] })], {
        safeZones: [{ x: 9, y: 9, w: 2, h: 2 }],
      });
      projectLocationRoles(map);
      expect(map.safeZones).toEqual([{ x: 9, y: 9, w: 2, h: 2 }, { x: 1, y: 1, w: 3, h: 2 }]);
    });

    it("역할을 뗀 구역의 사각형은 그 출처의 것만 사라진다", () => {
      const map = mapWith([location("loc1")], {
        safeZones: [{ x: 1, y: 1, w: 3, h: 2 }, { x: 9, y: 9, w: 2, h: 2 }],
        // loc1 이 예전에는 역할이었고 그 흔적이 남아 있다고 가정한다.
      });
      // 출처 표시가 남아 있어야 «우리 것» 으로 식별된다.
      map.locationRoleProjection = { safeZone: { loc1: { x: 1, y: 1, w: 3, h: 2 } } };
      projectLocationRoles(map);
      expect(map.safeZones).toEqual([{ x: 9, y: 9, w: 2, h: 2 }]);
    });

    it("역할이 없는 맵은 아무것도 바꾸지 않는다", () => {
      const map = mapWith([location("loc1")]);
      expect(projectLocationRoles(map)).toBe(0);
      expect(map.safeZones).toBeUndefined();
      expect(map.farmableArea).toBeUndefined();
    });

    it("구역을 옮기면 투영도 따라간다 — 복사본이 아니라 투영이다", () => {
      const map = mapWith([location("loc1", { tags: ["safeZone"] })]);
      projectLocationRoles(map);
      map.locations![0] = { ...map.locations![0]!, x: 7, y: 8 };
      projectLocationRoles(map);
      expect(map.safeZones).toEqual([{ x: 7, y: 8, w: 3, h: 2 }]);
      expect(map.safeZones).toHaveLength(1);
    });

    it("마지막 역할 구역이 사라지면 키 자체가 없어진다 — 빈 배열을 남기지 않는다", () => {
      // 역할을 떼고 구역도 지운 상태 — 기록만 남아 있다.
      const map = mapWith([], {
        safeZones: [{ x: 1, y: 1, w: 3, h: 2 }],
      });
      map.locationRoleProjection = { safeZone: { loc1: { x: 1, y: 1, w: 3, h: 2 } } };
      projectLocationRoles(map);
      expect(map.safeZones).toBeUndefined();
    });
  });
});

describe("mapClipboardBothLayers", () => {
  isolateTimers();
  // 영역 복사/붙여넣기는 하위+상위 레이어를 통째로 옮겨야 한다(RM2K3 관례).
  // 이전에는 현재 편집 레이어 하나만 복사되어 건물(하위 벽 + 상위 지붕) 같은
  // 다층 구조가 반쪽만 복제되는 문제가 있었다.

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
  function startMapId(): MapId {
    return store.getCurrent().startMapId;
  }
  beforeEach(() => {
    store.replace(startOnRetiredCombinedTown(createBlankProject()));
    editorState.set({
      currentMapId: null,
      tool: "select",
      layer: "lower",
      selection: null,
      clipboard: null,
    });
  });
  describe("영역 복사/붙여넣기 — 두 레이어 통째로", () => {
    it("하위+상위 레이어가 함께 복사되어 붙여넣기된다", () => {
      const mapId = startMapId();
      // 원본 2x2: 하위 = 물/잔디, 상위 = 꽃/빈칸.
      paintTile(mapId, "lower", 1, 1, TILE.WATER);
      paintTile(mapId, "lower", 2, 1, TILE.GRASS);
      paintTile(mapId, "upper", 1, 1, TILE.FLOWERS);
      paintTile(mapId, "lower", 1, 2, TILE.GRASS);
      paintTile(mapId, "lower", 2, 2, TILE.GRASS);

      selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 2, height: 2 });
      expect(copySelection(mapId)).toBe(true);
      expect(pasteClipboard(mapId, 5, 5)).toBe(true);

      const map = currentMap();
      expect(lowerAt(map, 5, 5)).toBe(TILE.WATER);
      expect(upperAt(map, 5, 5)).toBe(TILE.FLOWERS);
      expect(lowerAt(map, 6, 5)).toBe(TILE.GRASS);
      expect(lowerAt(map, 5, 6)).toBe(TILE.GRASS);
      expect(lowerAt(map, 6, 6)).toBe(TILE.GRASS);
    });

    it("현재 편집 레이어와 무관하게 항상 두 레이어를 복사한다", () => {
      const mapId = startMapId();
      paintTile(mapId, "lower", 3, 3, TILE.WATER);
      paintTile(mapId, "upper", 3, 3, TILE.FLOWERS);

      // 상위 레이어 편집 모드에서 복사해도 하위 레이어까지 함께 담긴다.
      editorState.set({ layer: "upper" });
      selectTileRegion(mapId, { mapId, x: 3, y: 3, width: 1, height: 1 });
      expect(copySelection(mapId)).toBe(true);
      expect(pasteClipboard(mapId, 7, 7)).toBe(true);

      const map = currentMap();
      expect(lowerAt(map, 7, 7)).toBe(TILE.WATER);
      expect(upperAt(map, 7, 7)).toBe(TILE.FLOWERS);
    });

    it("스택 소품(울타리)도 붙여넣기에서 함께 복원된다", () => {
      const mapId = startMapId();
      paintTile(mapId, "lower", 4, 4, TILE.GRASS);
      // 울타리는 stackable 소품 — 상위 레이어 스택에 쌓인다.
      paintTile(mapId, "lower", 4, 4, 378);

      selectTileRegion(mapId, { mapId, x: 4, y: 4, width: 1, height: 1 });
      expect(copySelection(mapId)).toBe(true);
      expect(pasteClipboard(mapId, 8, 8)).toBe(true);

      const map = currentMap();
      expect(lowerAt(map, 8, 8)).toBe(TILE.GRASS);
      expect(upperAt(map, 8, 8)).toBe(378);
    });

    it("붙여넣기는 대상 영역의 두 레이어를 원본 상태로 덮어쓴다", () => {
      const mapId = startMapId();
      // 원본: 하위 잔디만, 상위 빈칸.
      paintTile(mapId, "lower", 1, 1, TILE.GRASS);
      // 대상: 상위에 꽃이 있던 자리 — 붙여넣기 후 원본의 빈 상위가 반영되어 지워져야 한다.
      paintTile(mapId, "upper", 9, 9, TILE.FLOWERS);

      selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 1, height: 1 });
      expect(copySelection(mapId)).toBe(true);
      expect(pasteClipboard(mapId, 9, 9)).toBe(true);

      const map = currentMap();
      expect(lowerAt(map, 9, 9)).toBe(TILE.GRASS);
      expect(upperAt(map, 9, 9)).toBe(TILE.EMPTY);
    });
  });
  describe("보호(잠금) 칸 — 붙여넣기·영역 지우기도 못 바꾼다", () => {
    function lockCells(mapId: MapId, cells: readonly (readonly [number, number])[]): void {
      store.update((project) => {
        const map = project.maps[mapId]!;
        map.terrainDesign = { ...(map.terrainDesign ?? {}), lockedCells: cells.map(([x, y]) => y * map.width + x) };
      });
    }

    it("붙여넣기는 보호 칸을 건너뛰고 나머지 칸만 바꾼다", () => {
      const mapId = startMapId();
      paintTile(mapId, "lower", 1, 1, TILE.WATER);
      paintTile(mapId, "lower", 2, 1, TILE.WATER);
      paintTile(mapId, "lower", 5, 5, TILE.GRASS);
      paintTile(mapId, "lower", 6, 5, TILE.GRASS);
      lockCells(mapId, [[5, 5]]);
      const locked = lowerAt(currentMap(), 5, 5);
      const source = lowerAt(currentMap(), 2, 1);
      expect(locked).not.toBe(source);

      selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 2, height: 1 });
      expect(copySelection(mapId)).toBe(true);
      expect(pasteClipboard(mapId, 5, 5)).toBe(true);

      const map = currentMap();
      expect(lowerAt(map, 5, 5)).toBe(locked);
      expect(lowerAt(map, 6, 5)).toBe(source);
    });

    it("영역 지우기는 보호 칸을 남기고 나머지 칸만 비운다", () => {
      const mapId = startMapId();
      paintTile(mapId, "lower", 3, 3, TILE.WATER);
      paintTile(mapId, "lower", 4, 3, TILE.WATER);
      lockCells(mapId, [[3, 3]]);
      const locked = lowerAt(currentMap(), 3, 3);
      expect(locked).not.toBe(TILE.EMPTY);

      selectTileRegion(mapId, { mapId, x: 3, y: 3, width: 2, height: 1 });
      expect(clearSelectionRegion(mapId)).toBe(true);

      const map = currentMap();
      expect(lowerAt(map, 3, 3)).toBe(locked);
      expect(lowerAt(map, 4, 3)).toBe(TILE.EMPTY);
    });
  });
});

describe("mapEdgeGrow", () => {
  isolateTimers();
  // 계약(2026-09-25): 테두리 호버는 안내(띠·커서)만, 크기는 띠에서 시작한 드래그가 넘은 칸 수로만 바뀐다.
  // 이 파일은 순수 판정만 본다 — 호버 경로에는 이제 크기를 바꾸는 함수 자체가 없다.

  const ts = 32;
  describe("mapEdgeGrowAxes", () => {
    it("맵 안과 띠 밖은 null", () => {
      expect(mapEdgeGrowAxes({ worldX: 10, worldY: 10, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 })).toBeNull();
      expect(mapEdgeGrowAxes({ worldX: -200, worldY: 10, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 })).toBeNull();
    });

    it("오른쪽 띠와 왼쪽 위 모서리", () => {
      expect(mapEdgeGrowAxes({ worldX: 330, worldY: 10, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 }))
        .toEqual({ left: false, right: true, up: false, down: false });
      expect(mapEdgeGrowAxes({ worldX: -5, worldY: -5, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 }))
        .toEqual({ left: true, right: false, up: true, down: false });
    });
  });
  describe("mapEdgeGrowCursor", () => {
    it("변은 ew/ns, 모서리는 대각선", () => {
      expect(mapEdgeGrowCursor(null)).toBe("");
      expect(mapEdgeGrowCursor({ left: false, right: true, up: false, down: false })).toBe("ew-resize");
      expect(mapEdgeGrowCursor({ left: false, right: false, up: true, down: false })).toBe("ns-resize");
      expect(mapEdgeGrowCursor({ left: true, right: false, up: true, down: false })).toBe("nwse-resize");
      expect(mapEdgeGrowCursor({ left: false, right: true, up: true, down: false })).toBe("nesw-resize");
    });
  });
  describe("mapEdgeDragTarget", () => {
    const right = { left: false, right: true, up: false, down: false };
    const leftUp = { left: true, right: false, up: true, down: false };

    it("띠를 누른 자리(반 칸 미만)에서는 늘지 않는다", () => {
      const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 10 * ts + 10, worldY: 5 });
      expect(t).toMatchObject({ left: 0, right: 0, up: 0, down: 0, clamped: false });
    });

    it("넘은 거리를 칸으로 반올림한다", () => {
      const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 10 * ts + 3 * ts + 20, worldY: 5 });
      expect(t.right).toBe(4);
    });

    it("잡은 축 밖으로 끌어도 다른 변은 그대로다", () => {
      const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 12 * ts, worldY: 30 * ts });
      expect(t).toMatchObject({ right: 2, down: 0, up: 0, left: 0 });
    });

    it("왼쪽·위는 밀린 내용·카메라를 기준으로 재므로 늘린 뒤에도 값이 흔들리지 않는다", () => {
      // 처음: 원래 테두리(0,0)에서 왼쪽 위로 3칸.
      const first = mapEdgeDragTarget({ axes: leftUp, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: -3 * ts, worldY: -3 * ts });
      expect(first).toMatchObject({ left: 3, up: 3 });
      // 3칸 밀린 뒤: 카메라도 3칸 옮겼으므로 같은 화면 점의 월드 좌표는 (0,0).
      const again = mapEdgeDragTarget({ axes: leftUp, added: first, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 0, worldY: 0 });
      expect(again).toMatchObject({ left: 3, up: 3 });
    });

    it("되돌아 끌면 줄지만 원래 크기 아래로는 내려가지 않는다", () => {
      const added = { left: 0, right: 5, up: 0, down: 0 };
      const back = mapEdgeDragTarget({ axes: right, added, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 11 * ts, worldY: 5 });
      expect(back.right).toBe(1);
      const inside = mapEdgeDragTarget({ axes: right, added, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 2 * ts, worldY: 5 });
      expect(inside.right).toBe(0);
    });

    it("상한에서 깎고 clamped 를 알린다", () => {
      const origin = MAX_TOOL_MAP_DIMENSION - 2;
      const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: origin, originHeight: 10, tileSize: ts, worldX: (origin + 9) * ts, worldY: 5 });
      expect(t.right).toBe(2);
      expect(t.clamped).toBe(true);
    });
  });
});

describe("mapInspection", () => {
  isolateTimers();
  /** 시작 맵을 틀로 써서 같은 규격의 빈 맵을 추가한다 (실제 프로젝트의 "집 내부 10장" 모양). */
  function addMap(project: Project, id: MapId, name: string): GameMap {
    const template = project.maps[project.startMapId];
    if (!template) throw new Error("blank project has no start map");
    const map: GameMap = { ...template, id, name, events: [] };
    project.maps[id] = map;
    project.mapTree.children.push({ mapId: id, children: [] });
    return map;
  }
  function event(id: string, commands: GameEvent["commands"]): GameEvent {
    return { commands, id, trigger: { kind: "action" }, x: 1, y: 1 };
  }
  describe("collectMapInspection", () => {
    it("맵이 아니면(폴더 노드·지운 id) null 을 준다", () => {
      const project = createBlankProject();
      project.mapTree.children.push({ children: [], kind: "folder", mapId: "folder_town", name: "마을" });
      expect(collectMapInspection(project, "folder_town")).toBeNull();
      expect(collectMapInspection(project, "map_gone")).toBeNull();
      expect(isFolderNode(project, "folder_town")).toBe(true);
      expect(isFolderNode(project, project.startMapId)).toBe(false);
    });

    it("이벤트를 역할별로 한 칸씩만 세고 합이 total 과 맞는다", () => {
      const project = createBlankProject();
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("no start map");
      addMap(project, "map_inside", "안");
      start.events = [
        event("ev_door", [{ kind: "transfer", mapId: "map_inside", x: 2, y: 2 }]),
        // 문이 달린 상점은 문으로 센다 — classifyEvent 의 우선순위 계약.
        event("ev_shop_door", [
          { kind: "shop", itemIds: [] } as never,
          { kind: "transfer", mapId: "map_inside", x: 3, y: 3 },
        ]),
        event("ev_shop", [{ kind: "shop", itemIds: [] } as never]),
        event("ev_chest", [{ itemId: "it_potion", kind: "openChest" } as never]),
        event("ev_npc", [{ kind: "text", text: "안녕" } as never]),
        event("ev_switch", [{ kind: "setSwitch", switchId: "sw_a", value: true } as never]),
      ];

      const inspection = collectMapInspection(project, project.startMapId);
      expect(inspection).not.toBeNull();
      const events = inspection?.events;
      expect(events?.total).toBe(6);
      expect(events?.door).toBe(2);
      expect(events?.shop).toBe(1);
      expect(events?.chest).toBe(1);
      expect(events?.npc).toBe(1);
      expect(events?.other).toBe(1);
      const sum = (events?.door ?? 0) + (events?.shop ?? 0) + (events?.chest ?? 0) + (events?.npc ?? 0) + (events?.other ?? 0);
      expect(sum).toBe(events?.total);
    });

    it("분기 안에 숨은 transfer 도 문으로 센다", () => {
      const project = createBlankProject();
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("no start map");
      addMap(project, "map_inside", "안");
      start.events = [
        event("ev_choice", [{
          kind: "choices",
          options: [{ branch: [{ kind: "transfer", mapId: "map_inside", x: 1, y: 1 }], label: "들어간다" }],
          prompt: "들어갈까?",
        } as never]),
      ];
      expect(collectMapInspection(project, project.startMapId)?.events.door).toBe(1);
    });

    it("크기·계층·시작 여부를 낸다", () => {
      const project = createBlankProject();
      const child = addMap(project, "map_child", "집 내부");
      child.width = 13;
      child.height = 10;
      // 손자를 달아 childCount 가 직속 자식만 세는지 본다.
      project.mapTree.children = project.mapTree.children.map((node) =>
        node.mapId === "map_child" ? { ...node, children: [{ children: [], mapId: "map_grand" }] } : node,
      );
      project.maps["map_grand"] = { ...child, events: [], id: "map_grand", name: "지하" };

      const inspection = collectMapInspection(project, "map_child");
      expect(inspection?.width).toBe(13);
      expect(inspection?.height).toBe(10);
      expect(inspection?.tileCount).toBe(130);
      expect(inspection?.childCount).toBe(1);
      expect(inspection?.isStart).toBe(false);
      // 루트 맵의 자식이므로 상위 맵 이름은 루트 맵 이름이다.
      expect(inspection?.parentName).toBe(project.maps[project.startMapId]?.name);
      expect(collectMapInspection(project, project.startMapId)?.isStart).toBe(true);
      // 루트는 상위가 없다 — "루트" 라는 글자는 렌더러가 붙인다.
      expect(collectMapInspection(project, project.startMapId)?.parentName).toBeNull();
    });

    it("조우율이 0 이면 인카운터는 꺼진 것으로 본다", () => {
      const project = createBlankProject();
      const map = addMap(project, "map_field", "들판");
      map.encounterRate = 0;
      map.troopIds = ["tr_slime"];
      expect(collectMapInspection(project, "map_field")?.encounter.enabled).toBe(false);

      map.encounterRate = 30;
      const on = collectMapInspection(project, "map_field")?.encounter;
      expect(on?.enabled).toBe(true);
      expect(on?.rate).toBe(30);
      expect(on?.troopCount).toBe(1);
    });

    it("조우율만 있고 적이 없으면 경고한다", () => {
      const project = createBlankProject();
      const map = addMap(project, "map_field", "들판");
      map.encounterRate = 30;
      map.troopIds = [];
      map.encounterTable = [];
      const ids = collectMapInspection(project, "map_field")?.diagnostics.map((d) => d.id) ?? [];
      expect(ids).toContain("encounter-empty");
    });

    it("이동이 하나도 없으면 고립으로 경고하고, 도달 불가와 겹쳐 말하지 않는다", () => {
      const project = createBlankProject();
      addMap(project, "map_island", "외딴 섬");
      const diagnostics = collectMapInspection(project, "map_island")?.diagnostics ?? [];
      const ids = diagnostics.map((d) => d.id);
      expect(ids).toContain("unlinked");
      expect(ids).not.toContain("unreachable");
      expect(diagnostics.find((d) => d.id === "unlinked")?.severity).toBe("warning");
    });

    it("나가는 문만 있고 들어오는 문이 없으면 도달 불가로 경고한다", () => {
      const project = createBlankProject();
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("no start map");
      const far = addMap(project, "map_far", "먼 곳");
      // 먼 곳 → 시작 맵 (한 방향). 시작 맵에서 먼 곳으로 갈 길이 없다.
      far.events = [event("ev_back", [{ kind: "transfer", mapId: project.startMapId, x: 1, y: 1 }])];

      const ids = collectMapInspection(project, "map_far")?.diagnostics.map((d) => d.id) ?? [];
      expect(ids).toContain("unreachable");
      expect(ids).not.toContain("unlinked");

      // 시작 맵에서 문을 놓아 주면 경고가 사라진다.
      start.events = [event("ev_go", [{ kind: "transfer", mapId: "map_far", x: 1, y: 1 }])];
      const after = collectMapInspection(project, "map_far")?.diagnostics.map((d) => d.id) ?? [];
      expect(after).not.toContain("unreachable");
    });

    it("타일셋이 없으면 그려지지 않는다고 경고한다", () => {
      const project = createBlankProject();
      const map = addMap(project, "map_broken", "깨진 맵");
      map.tilesetId = "ts_gone";
      const inspection = collectMapInspection(project, "map_broken");
      expect(inspection?.tilesetName).toBeNull();
      expect(inspection?.diagnostics.map((d) => d.id)).toContain("tileset-missing");
    });

    it("켜진 맵 옵션만 목록에 넣는다", () => {
      const project = createBlankProject();
      const map = addMap(project, "map_dungeon", "던전");
      expect(collectMapInspection(project, "map_dungeon")?.options).toEqual([]);

      map.disableSave = true;
      map.disableTeleport = true;
      const ids = collectMapInspection(project, "map_dungeon")?.options.map((flag) => flag.id) ?? [];
      expect(ids).toEqual(["no-save", "no-teleport"]);
    });

    it("BGM 은 맵 설정과 같은 어휘로 말한다", () => {
      const project = createBlankProject();
      const map = addMap(project, "map_bgm", "곡 있는 맵");
      expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("상위 맵/기본");

      map.bgm = { mode: "none" };
      expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("무음");

      map.bgm = { mode: "resource", resourceId: "bgm_town" };
      expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("bgm_town");

      map.bgm = { mode: "resource" };
      expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("지정 안 됨");
    });
  });
  describe("reachableMapIdsFromStart", () => {
    it("문을 여러 칸 타고 간 곳까지 모은다", () => {
      const project = createBlankProject();
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("no start map");
      const mid = addMap(project, "map_mid", "가운데");
      addMap(project, "map_end", "끝");
      addMap(project, "map_orphan", "고아");
      start.events = [event("ev_1", [{ kind: "transfer", mapId: "map_mid", x: 1, y: 1 }])];
      mid.events = [event("ev_2", [{ kind: "transfer", mapId: "map_end", x: 1, y: 1 }])];

      const reachable = reachableMapIdsFromStart(project);
      expect(reachable.has(project.startMapId)).toBe(true);
      expect(reachable.has("map_mid")).toBe(true);
      expect(reachable.has("map_end")).toBe(true);
      expect(reachable.has("map_orphan")).toBe(false);
    });

    it("맵 연결은 양방향으로 본다", () => {
      const project = createBlankProject();
      addMap(project, "map_next", "옆");
      project.mapConnections = [{
        from: { mapId: "map_next", x: 0, y: 0 },
        id: "c1",
        npcEnabled: false,
        playerEnabled: true,
        to: { mapId: project.startMapId, x: 0, y: 0 },
      }];
      expect(reachableMapIdsFromStart(project).has("map_next")).toBe(true);
    });

    it("트리 계층만으로는 도달했다고 보지 않는다", () => {
      const project = createBlankProject();
      addMap(project, "map_child", "자식");
      expect(reachableMapIdsFromStart(project).has("map_child")).toBe(false);
    });
  });
});

describe("mapLinkStats", () => {
  isolateTimers();
  describe("collectMapLinkStats", () => {
    it("counts outgoing transfers, incoming transfers, and mapConnections", () => {
      const project = createBlankProject();
      const a = project.startMapId;
      const b = "map_b";
      project.maps[b] = { ...project.maps[a]!, id: b, name: "안", events: [] };
      project.maps[a]!.events = [{
        id: "ev_door",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "transfer", mapId: b, x: 2, y: 2 }],
      }];
      project.maps[b]!.events = [];
      project.mapConnections = [{
        id: "c1",
        from: { mapId: a, x: 0, y: 0 },
        to: { mapId: b, x: 1, y: 1 },
        playerEnabled: true,
        npcEnabled: false,
      }];

      const fromA = collectMapLinkStats(project, a);
      const fromB = collectMapLinkStats(project, b);
      expect(fromA.outgoingTransfers).toBe(1);
      expect(fromA.incomingTransfers).toBe(0);
      expect(fromA.connections).toBe(1);
      expect(fromA.playLinkCount).toBe(2);
      expect(fromB.outgoingTransfers).toBe(0);
      expect(fromB.incomingTransfers).toBe(1);
      expect(fromB.playLinkCount).toBe(2);
    });
  });
  describe("collectMapLinkGraph", () => {
    it("marks maps unreachable from the start and keeps the transfer's event and position", () => {
      const project = createBlankProject();
      const start = project.startMapId;
      const base = project.maps[start]!;
      for (const id of ["map_house", "map_cellar", "map_island"]) project.maps[id] = { ...base, id, name: id, events: [] };
      project.maps[start]!.events = [{ id: "door", x: 3, y: 4, trigger: { kind: "action" }, commands: [{ kind: "transfer", mapId: "map_house", x: 1, y: 1 }] }];
      // 지하실은 집으로 나가는 문만 있다 — 들어오는 길이 없으니 시작에서 못 닿는다. 섬은 문이 하나도 없다.
      project.maps.map_cellar!.events = [{ id: "up", x: 0, y: 0, trigger: { kind: "action" }, commands: [{ kind: "transfer", mapId: "map_house", x: 2, y: 2 }] }];

      const byId = Object.fromEntries(collectMapLinkGraph(project).map((node) => [node.mapId, node]));
      expect(byId[start]!.isStart).toBe(true);
      expect(byId[start]!.outgoing).toEqual([{ from: start, to: "map_house", kind: "transfer", eventId: "door", x: 3, y: 4 }]);
      expect(byId.map_house!.reachableFromStart).toBe(true);
      expect(byId.map_house!.incoming.map((edge) => edge.from).sort()).toEqual(["map_cellar", start].sort());
      expect(byId.map_cellar!.reachableFromStart).toBe(false);
      expect(byId.map_island!.reachableFromStart).toBe(false);
      expect(byId.map_island!.outgoing.length + byId.map_island!.incoming.length).toBe(0);
    });

    it("treats a map connection as a two-way link", () => {
      const project = createBlankProject();
      const start = project.startMapId;
      project.maps.map_field = { ...project.maps[start]!, id: "map_field", name: "들판", events: [] };
      project.mapConnections = [{ id: "edge", from: { mapId: "map_field", x: 0, y: 0 }, to: { mapId: start, x: 0, y: 0 }, playerEnabled: true, npcEnabled: false }];
      const field = collectMapLinkGraph(project).find((node) => node.mapId === "map_field")!;
      expect(field.reachableFromStart).toBe(true);
      expect(field.outgoing.map((edge) => edge.kind)).toEqual(["connection"]);
      expect(field.incoming.map((edge) => edge.kind)).toEqual(["connection"]);
    });
  });
  it("reuses link inputs across tile edits and invalidates event positions, start and map membership", () => {
    const p = createBlankProject();
    const a = p.startMapId;
    p.maps.b = { ...p.maps[a]!, id: "b", events: [] };
    p.maps[a]!.events = [{ id: "door", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "transfer", mapId: "b", x: 0, y: 0 }] }];
    const graph = collectMapLinkGraph(p);
    const painted = { ...p, maps: { ...p.maps, [a]: { ...p.maps[a]!, lowerTiles: [...p.maps[a]!.lowerTiles] } } };
    expect(collectMapLinkGraph(painted)).toBe(graph);
    const moved = { ...painted, maps: { ...painted.maps, [a]: { ...painted.maps[a]!, events: [{ ...p.maps[a]!.events[0]!, x: 7 }] } } };
    expect(collectMapLinkGraph(moved).find(n => n.mapId === a)!.outgoing[0]!.x).toBe(7);
    const restarted = { ...moved, startMapId: "b" };
    expect(collectMapLinkGraph(restarted).find(n => n.mapId === a)!.reachableFromStart).toBe(false);
    const removed = { ...restarted, maps: { [a]: restarted.maps[a]! } };
    expect(collectMapLinkGraph(removed)[0]!.outgoing).toEqual([]);
    expect(collectMapLinkStats(removed, a).outgoingTransfers).toBe(1); // dangling transfers still counted
    const connected = { ...p, mapConnections: [{ id: "edge", from: { mapId: a, x: 0, y: 0 }, to: { mapId: "b", x: 0, y: 0 }, playerEnabled: true, npcEnabled: false }] };
    expect(collectMapLinkGraph(connected).find(n => n.mapId === "b")!.outgoing[0]!.kind).toBe("connection");
    expect(collectMapLinkStats(connected, a).connections).toBe(1);
  });
});

// 반복 맵(map.loop) — 2026-09-24 꿈 세계 도그푸딩: 「가장자리가 반대편으로 이어지는 숲」을 만들 속성이 없었다.
describe("mapLoop", () => {
  isolateTimers();
  const map = { width: 10, height: 8, loop: "horizontal" as const };
  describe("map.loop", () => {
    it("루프 축 가장자리를 넘는 걸음만 반대편으로 접는다", () => {
      expect(loopStepTarget(map, 9, 3, 1, 0)).toEqual({ x: 0, y: 3 });
      expect(loopStepTarget(map, 0, 3, -1, 0)).toEqual({ x: 9, y: 3 });
      expect(loopStepTarget(map, 4, 0, 0, -1)).toBeNull();
      expect(loopStepTarget(map, 4, 3, 1, 0)).toBeNull();
      expect(loopStepTarget({ ...map, loop: "both" }, 4, 0, 0, -1)).toEqual({ x: 4, y: 7 });
      expect(wrapLoopPosition(map, 10, 3)).toEqual({ x: 0, y: 3 });
      expect(wrapLoopPosition(map, 3, -1)).toEqual({ x: 3, y: -1 });
    });

    it("set_map_properties 로 켜고 끄며, 가장자리가 막혀 있으면 경고한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const on = runTool(ctx, "set_map_properties", { mapId, loop: "both" });
      expect(on.ok, on.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.loop).toBe("both");
      expect(on.summary).toContain("사방 반복");
      const off = runTool(ctx, "set_map_properties", { mapId, loop: "none" });
      expect(off.ok, off.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.loop).toBeUndefined();
    });
  });
});

// 보존 기획 항목(OPRN-019) — 스키마·정규화·재사용 선택의 순수 계약.
//
// 여기서 잠그는 것:
//  1. 프로젝트 JSON 왕복(= 내보내기/가져오기 경로)에서 항목이 살아남는다.
//  2. 빈 목록은 필드를 지운다 — 옛 저장본의 바이트 안정성.
//  3. 잘못된 wire 데이터는 fail-closed 다(조용히 버리지 않는다).
//  4. 재사용 선택(none/all/selected)이 실제로 실릴 항목과 지침 블록을 정한다.
//  5. 은퇴·삭제된 항목은 선택에 남아 있어도 부활하지 않는다.
describe("mapPlanningItems", () => {
  isolateTimers();
  function withItems(items: MapPlanningItem[]): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.planningItems = items;
    return project;
  }
  const item = (id: string, text: string, over: Partial<MapPlanningItem> = {}): MapPlanningItem => ({
    id,
    text,
    status: "active",
    origin: "user",
    ...over,
  });
  describe("보존 기획 항목 스키마", () => {
    it("프로젝트 JSON 왕복에서 항목이 그대로 살아남는다 (내보내기 → 가져오기)", () => {
      // Break: serialize 가 map 필드를 화이트리스트로 걸러 새 필드를 떨어뜨린다.
      const project = withItems([
        item("pi_1", "북쪽 광장은 남긴다", { createdAt: "2026-09-10T00:00:00.000Z" }),
        item("pi_2", "동쪽 부두는 밑그림에서 담았다", { origin: "spec", specAssetId: "map_1:dock", status: "retired" }),
      ]);
      const restored = deserialize(serialize(project));
      expect(restored.maps[restored.startMapId]?.planningItems).toEqual([
        item("pi_1", "북쪽 광장은 남긴다", { createdAt: "2026-09-10T00:00:00.000Z" }),
        item("pi_2", "동쪽 부두는 밑그림에서 담았다", { origin: "spec", specAssetId: "map_1:dock", status: "retired" }),
      ]);
    });

    it("항목이 없는 맵은 필드 자체가 없다 — 스키마 버전을 올리지 않는다", () => {
      // Break: 정규화가 빈 배열을 남겨 옛 프로젝트 JSON 의 바이트가 달라진다.
      const blank = deserialize(serialize(createBlankProject()));
      expect(blank.maps[blank.startMapId]?.planningItems).toBeUndefined();
      expect(blank.version).toBe(createBlankProject().version);
      const emptied = deserialize(serialize(withItems([])));
      expect(emptied.maps[emptied.startMapId]?.planningItems).toBeUndefined();
    });

    it("잘못된 wire 데이터는 load 를 실패시킨다 (조용한 삭제 금지)", () => {
      // Break: 셰이프 검사가 빠져 사용자가 보존한 문장이 이유 없이 사라진다.
      const cases: [string, unknown][] = [
        ["빈 본문", [{ id: "pi_1", text: "   ", status: "active", origin: "user" }]],
        ["없는 status", [{ id: "pi_1", text: "a", origin: "user" }]],
        ["알 수 없는 status", [{ id: "pi_1", text: "a", status: "archived", origin: "user" }]],
        ["알 수 없는 origin", [{ id: "pi_1", text: "a", status: "active", origin: "robot" }]],
        ["중복 id", [
          { id: "pi_1", text: "a", status: "active", origin: "user" },
          { id: "pi_1", text: "b", status: "active", origin: "user" },
        ]],
        ["배열이 아님", { id: "pi_1" }],
      ];
      for (const [label, value] of cases) {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("start map missing");
        (map as unknown as Record<string, unknown>).planningItems = value;
        expect(() => deserialize(serialize(project)), label).toThrow();
      }
    });

    it("정규화는 공백을 접고 상한을 지키며 알 수 없는 값을 기본값으로 되돌린다", () => {
      // Break: 본문 길이·중복·빈 목록 처리가 저장 경로와 도구 경로에서 갈라진다.
      expect(normalizePlanningItemText("  두   칸  ")).toBe("두 칸");
      expect(normalizePlanningItemText("가".repeat(MAP_PLANNING_ITEM_TEXT_MAX + 50)))
        .toHaveLength(MAP_PLANNING_ITEM_TEXT_MAX);
      expect(normalizeMapPlanningItems([])).toBeUndefined();
      expect(normalizeMapPlanningItems("nope")).toBeUndefined();
      expect(normalizeMapPlanningItems([{ id: "pi_1", text: "a", status: "weird", origin: "weird" }]))
        .toEqual([item("pi_1", "a")]);
      expect(makeMapPlanningItemId([item("pi_1", "a"), item("pi_2", "b")])).toBe("pi_3");
    });
  });
  describe("보존 기획 재사용 선택", () => {
    const items = [
      item("pi_1", "북쪽 광장은 남긴다"),
      item("pi_2", "동쪽 부두 유지"),
      item("pi_3", "옛 다리는 철거", { status: "retired" }),
    ];

    it("사용 안 함은 아무 항목도 아무 문장도 만들지 않는다", () => {
      // Break: 목록이 있다는 사실만으로 프롬프트에 문장이 실린다(숨은 강제 기억).
      const chosen = resolvePlanningReuse(items, { mode: "none", selectedIds: ["pi_1"] });
      expect(chosen).toEqual([]);
      expect(formatPlanningReuseBlock(chosen)).toBe("");
      expect(describePlanningReuse(0, "none")).toBe("보존 기획 사용 안 함");
    });

    it("전체는 은퇴 항목을 빼고 활성만 담는다", () => {
      // Break: 은퇴가 재사용 후보에서 빠지지 않아 「은퇴」와 「삭제」가 같은 뜻이 된다.
      const chosen = resolvePlanningReuse(items, { mode: "all", selectedIds: [] });
      expect(chosen.map((row) => row.id)).toEqual(["pi_1", "pi_2"]);
      expect(activePlanningItems(items)).toHaveLength(2);
    });

    it("선택은 고른 id 만 담고, 은퇴·없는 id 는 조용히 부활하지 않는다", () => {
      // Break: 삭제된 항목의 남은 선택이 다음 턴 지침으로 되살아난다.
      const chosen = resolvePlanningReuse(items, { mode: "selected", selectedIds: ["pi_2", "pi_3", "pi_없음"] });
      expect(chosen.map((row) => row.id)).toEqual(["pi_2"]);
    });

    it("지침 블록은 지침임을 본문에서 밝히고 항목을 번호로 싣는다", () => {
      // Break: 블록이 차단 규칙처럼 쓰여 조수가 새 요청을 거절하는 근거로 쓴다.
      const block = formatPlanningReuseBlock(resolvePlanningReuse(items, { mode: "all", selectedIds: [] }));
      expect(block).toContain("[보존 기획]");
      expect(block).toContain("지침이며 차단 규칙이 아니다");
      expect(block).toContain("1. 북쪽 광장은 남긴다");
      expect(block).toContain("2. 동쪽 부두 유지");
      expect(block).not.toContain("옛 다리는 철거");
    });

    it("밑그림 에셋은 좌표를 남긴 한 줄로 바뀐다", () => {
      // Break: 담은 항목이 좌표를 잃어 나중에 「원래 그 자리」를 판단할 수 없다.
      expect(planningTextFromSpecAsset({ id: "plaza", kind: "terrain", x: 4, y: 6, w: 8, h: 5, style: "석재 광장" }))
        .toBe("석재 광장 — terrain (4,6) 8×5");
      expect(planningTextFromSpecAsset({ id: "dock", kind: "road", x: 0, y: 0, w: 3, h: 2 }))
        .toBe("road — road (0,0) 3×2");
    });
  });
});

// 견본 복사 측정(mapTemplateOverlap): 평행이동·좌우반전을 해도 같은 판을 찾아내고, 다른 타일셋 견본은 재지 않는다.
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
describe("mapTemplateOverlap", () => {
  isolateTimers();
  const grid = (width: number, height: number, cell: (x: number, y: number) => number, tilesetId = "t"): OverlapGrid =>
    ({ width, height, tilesetId, lower: Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width))) });
  const noise = (x: number, y: number) => (Math.imul(x + 3, 2654435761) ^ Math.imul(y + 7, 40503)) >>> 0;
  describe("templateOverlap", () => {
    it("is 1 for an identical map", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      expect(templateOverlap(t, t).overlap).toBe(1);
    });

    it("finds a copy moved by a few tiles", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      const moved = grid(12, 10, (x, y) => (x >= 3 ? noise(x - 3, y) % 9 : 100));
      const hit = templateOverlap(moved, t);
      expect(hit.dx).toBe(3);
      expect(hit.overlap).toBeCloseTo((9 * 10) / (12 * 10), 5);
    });

    it("finds a mirrored copy", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      const mirrored = grid(12, 10, (x, y) => noise(11 - x, y) % 9);
      const hit = templateOverlap(mirrored, t);
      expect(hit.flip).toBe(true);
      expect(hit.overlap).toBe(1);
    });

    it("stays low for an unrelated layout", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      const other = grid(12, 10, (x, y) => noise(y + 50, x + 50) % 9);
      expect(templateOverlap(other, t).overlap).toBeLessThan(0.4);
    });
  });
  describe("maxTemplateOverlap", () => {
    it("compares only templates on the same tileset", () => {
      const map = grid(8, 8, () => 1);
      const hit = maxTemplateOverlap(map, { a: grid(8, 8, () => 1, "other"), b: grid(8, 8, (x) => (x < 4 ? 1 : 2)) });
      expect(hit?.key).toBe("b");
      expect(hit?.overlap).toBe(0.5);
    });

    it("skips templates whose tile counts cannot reach the floor", () => {
      const map = grid(8, 8, () => 1);
      expect(maxTemplateOverlap(map, { b: grid(8, 8, (x) => (x < 2 ? 1 : 2)) }, { floor: 0.4 })).toBeUndefined();
      expect(maxTemplateOverlap(map, { b: grid(8, 8, (x) => (x < 4 ? 1 : 2)) }, { floor: 0.4 })?.overlap).toBe(0.5);
    });
  });
});

describe("mapViewScale", () => {
  isolateTimers();
  function maps(...sizes: number[]): { maps: Record<string, GameMap>; startMapId: string } {
    const entries = sizes.map((tileSize, index) => [`m${index}`, { id: `m${index}`, tileSize } as GameMap] as const);
    return { maps: Object.fromEntries(entries), startMapId: "m0" };
  }
  describe("mixed tile size view scale", () => {
    it("uses the tile size most maps use, so one imported map doesn't change the project's look", () => {
      expect(projectReferenceTileSize(maps(16, 16, 32))).toBe(16);
      expect(projectReferenceTileSize(maps(32, 16, 32))).toBe(32);
      expect(projectReferenceTileSize(maps(48))).toBe(48);
    });

    it("breaks ties with the start map, then the smaller cell", () => {
      expect(projectReferenceTileSize(maps(32, 16))).toBe(32);
      expect(projectReferenceTileSize({ ...maps(32, 16), startMapId: "missing" })).toBe(16);
    });

    it("recomputes when the maps object is replaced", () => {
      const project = maps(16, 16, 32);
      expect(projectReferenceTileSize(project)).toBe(16);
      project.maps = { ...project.maps, m0: { id: "m0", tileSize: 32 } as GameMap };
      expect(projectReferenceTileSize(project)).toBe(32);
    });

    it("maps world pixels to the reference cell", () => {
      expect(mapWorldScale(32, 16)).toBe(2);
      expect(mapWorldScale(16, 32)).toBe(0.5);
      expect(mapWorldScale(16, 16)).toBe(1);
    });

    it("raises canvas density only when a larger cell than the reference exists", () => {
      const resolution = { width: 320, height: 240 };
      expect(playPixelDensity(maps(16, 16), resolution)).toBe(1);
      expect(playPixelDensity(maps(32, 32, 16), resolution)).toBe(1); // smaller maps are zoomed in, not out
      expect(playPixelDensity(maps(16, 16, 32), resolution)).toBe(2);
      expect(playPixelDensity(maps(16, 16, 48), resolution)).toBe(3);
      expect(playPixelDensity(maps(16, 16, 32), resolution, 2)).toBe(1); // authored zoom already draws 32px 1:1
      expect(playPixelDensity(maps(16, 16, 48), { width: 1920, height: 1080 })).toBe(2); // canvas cap
    });
  });
});
