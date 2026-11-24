import { describe, it, expect } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { pushObject, toggleHiding, pursuitTarget, carryPursuitThroughDoor, advancePursuitDoors } from "@/player/horrorRuntime";
import { isHorrorState } from "@/project/horrorState";
import { lintHorrorAuthoring } from "@/project/lint/horrorAuthoringLint";
import type { GameEvent } from "@/project/types";
import type { AutonomousMover } from "@/player/playSceneTypes";
import { CHASE_LEGACY_SEARCH_MIN_MS } from "@/project/chaseTempo";
import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { formatLayoutValidationSummary, LAYOUT_TREE_TILE_IDS, layoutValidationBlocking, validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import { repairLayoutPlacement } from "@/project/lint/layoutPlacementRepair";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("horrorObjectRuntime", () => {
  isolateTimers();
  function fixture() {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.width = 12; map.height = 12; map.lowerTiles = Array(144).fill(0); map.upperTiles = Array(144).fill(-1);
    // Explicit passable test terrain, independent of the art catalog.
    project.tilesets[map.tilesetId]!.passability[0] = {up:true,down:true,left:true,right:true};
    const event = (id: string, x: number, y: number): GameEvent => ({ id, x, y, trigger: { kind: 'action' }, commands: [], pages: [{ id: `${id}_page`, name: id, conditions: [], graphic: {}, trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true, movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [] }] });
    const monster = event('monster', 7, 5);
    monster.pages![0]!.movement = { type: 'chase', speed: 4, frequency: 4, sightRange: 8, pursuit: { scope: 'connected', doorDelayMs: 500, searchMs: 1000, onLost: 'return' } };
    const chair = event('chair', 4, 5); chair.pages![0]!.interaction = { kind: 'pushable' };
    const closet = event('closet', 3, 4); closet.pages![0]!.interaction = { kind: 'hiding' };
    map.events = [monster, chair, closet];
    const next = structuredClone(map); next.id = 'next'; next.events = []; project.maps.next = next;
    const third = structuredClone(next); third.id = 'third'; project.maps.third = third;
    const session = startSession(project); session.x = 3; session.y = 5;
    const world = { project, map, session, positions: initialRuntimeEventPositions(map.events) };
    const view = (id: string) => runtimeEventViewsForMap(project, world.map, session, world.positions).find(v => v.event.id === id)!;
    const mover = { timer: 0, moveIntervalMs: 80, moveDurationMs: 100, chaseActive: true } as AutonomousMover;
    return { world, view, mover, monster, chair, closet, next, third };
  }
  describe('horror authoring and runtime contracts', () => {
    it('roundtrips authored properties and old projects without adding behavior', () => {
      const { world } = fixture();
      const loaded = deserialize(serialize(world.project));
      expect(loaded.maps[world.map.id]!.events).toEqual(world.map.events);
      const old = createBlankProject(); expect(deserialize(serialize(old)).maps[old.startMapId]!.events).toEqual(old.maps[old.startMapId]!.events);
    });
    it('pushes a chair one tile and preserves position through save storage and reload', () => {
      const { world, view } = fixture();
      expect(pushObject(world, view('chair'), 'right')).toBe(true);
      const data = new Map<string,string>();
      const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => data.set(k,v) } as Storage;
      saveToSlot(storage, 1, createSaveSnapshot(world.project, world.session));
      const read = readSaveSlot(storage, 1); expect(read.kind).toBe('present');
      if (read.kind !== 'present') throw Error('snapshot missing');
      const loaded = applySaveSnapshot(world.project, read.snapshot);
      expect(loaded.eventLocations.chair).toMatchObject({ x: 5, y: 5 });
      expect(world.map.events.find(e => e.id === 'chair')!.x).toBe(4);
    });
    it('rejects blocked, disallowed, and chain pushes without mutation', () => {
      const { world, view, chair } = fixture();
      chair.pages![0]!.interaction!.directions = ['up'];
      expect(pushObject(world, view('chair'), 'right')).toBe(false);
      world.session.eventLocations.closet = { mapId: world.map.id, x: 4, y: 4 };
      expect(pushObject(world, view('chair'), 'up')).toBe(false);
      expect(world.session.eventLocations.chair).toBeUndefined();
      world.session.eventLocations.closet = { mapId: world.map.id, x: 8, y: 8 };
      world.map.lowerTiles[4*12+4] = 1; world.project.tilesets[world.map.tilesetId]!.passability[1] = {up:false,down:false,left:false,right:false};
      expect(pushObject(world, view('chair'), 'up')).toBe(false);
    });
    it('hiding behind furniture breaks detection, searches then returns, and can be exited', () => {
      const { world, view, mover } = fixture();
      world.session.eventLocations.chair = { mapId: world.map.id, x: 8, y: 8 };
      expect(pursuitTarget(world, view('monster'), mover, 20)).toMatchObject({ x: 3, y: 5, searching: false });
      world.positions.monster = { x: 6, y: 5 };
      world.session.eventLocations.monster = { mapId: world.map.id, x: 6, y: 5 };
      world.session.eventLocations.chair = { mapId: world.map.id, x: 4, y: 5 };
      toggleHiding(world, view('closet'));
      expect(world.session.horror!.hiding!.witnessedBy).toEqual([]);
      expect(pursuitTarget(world, view('monster'), mover, 500)).toEqual({ x: 3, y: 5, searching: true });
      // 박자(chaseStepMs)를 적지 않은 추격자의 수색은 CHASE_LEGACY_SEARCH_MIN_MS 아래로 내려가지 않는다(4127a63455) — 저작 searchMs 1000 은 그보다 짧다.
      expect(pursuitTarget(world, view('monster'), mover, CHASE_LEGACY_SEARCH_MIN_MS)).toEqual({ mapId: world.map.id, x: 7, y: 5, searching: true });
      world.positions.monster = { x: 7, y: 5 };
      world.session.eventLocations.monster = { mapId: world.map.id, x: 7, y: 5 };
      expect(pursuitTarget(world, view('monster'), mover, 20)).toBeNull();
      expect(world.session.horror!.pursuits.monster!.active).toBe(false);
      toggleHiding(world); expect(world.session.horror!.hiding).toBeUndefined();
    });
    it('a monster that saw entry can still capture; saved hiding state is restored', () => {
      const { world, view, mover } = fixture();
      world.session.eventLocations.chair = { mapId: world.map.id, x: 8, y: 8 };
      toggleHiding(world, view('closet'));
      expect(world.session.horror!.hiding!.witnessedBy).toEqual(['monster']);
      expect(pursuitTarget(world, view('monster'), mover, 50)).toMatchObject({ x: 3, y: 5, searching: false });
      const snapshot = createSaveSnapshot(world.project, world.session);
      expect(applySaveSnapshot(world.project, snapshot).horror).toEqual(world.session.horror);
    });
    it('follows a real transfer after travel and door delay, without duplicating the event', () => {
      const { world, view, mover, next } = fixture();
      world.session.x = 8; world.session.y = 5;
      pursuitTarget(world, view('monster'), mover, 20);
      carryPursuitThroughDoor(world, new Map([['monster', mover]]), { mapId: next.id, x: 2, y: 2 });
      world.map = next; world.session.currentMapId = next.id; world.session.x = 3; world.session.y = 2;
      expect(advancePursuitDoors(world, 499)).toBe(false);
      expect(view('monster')).toBeUndefined();
      expect(advancePursuitDoors(world, 200)).toBe(true);
      expect(view('monster')).toMatchObject({ x: 2, y: 2 });
      expect(world.project.maps[world.project.startMapId]!.events.filter(e => e.id === 'monster')).toHaveLength(1);
      const saved = applySaveSnapshot(world.project, createSaveSnapshot(world.project, world.session));
      expect(saved.eventLocations.monster?.mapId).toBe('next');
    });
    it('retains a pending door trail across quick second transfer and save reload', () => {
      const { world, view, mover, next, third } = fixture();
      world.session.x = 8; world.session.y = 5;
      pursuitTarget(world, view('monster'), mover, 20);
      carryPursuitThroughDoor(world, new Map([['monster', mover]]), { mapId: next.id, x: 2, y: 2 });
      world.map = next; world.session.currentMapId = next.id; world.session.x = 3;
      carryPursuitThroughDoor(world, new Map(), { mapId: third.id, x: 2, y: 2 });
      expect(world.session.horror!.pursuits.monster!.doors.map(d => d.mapId)).toEqual(['next','third']);
      world.session = applySaveSnapshot(world.project, createSaveSnapshot(world.project, world.session));
      world.map = third; world.session.currentMapId = third.id;
      advancePursuitDoors(world, 10000); advancePursuitDoors(world, 10000);
      expect(world.session.eventLocations.monster?.mapId).toBe('third');
    });
    it('map-only chasers never follow and erased pursuers cancel transit', () => {
      const { world, monster, mover, next } = fixture();
      monster.pages![0]!.movement.pursuit!.scope = 'map';
      carryPursuitThroughDoor(world, new Map([['monster',mover]]), { mapId: next.id, x: 2,y: 2 });
      expect(world.session.horror?.pursuits.monster).toBeUndefined();
      monster.pages![0]!.movement.pursuit!.scope = 'connected';
      world.session.x = 8; world.session.y = 5;
      carryPursuitThroughDoor(world, new Map([['monster',mover]]), { mapId: next.id,x: 2,y: 2 });
      world.session.erasedEventIds.push('monster'); advancePursuitDoors(world, 10000);
      expect(world.session.horror!.pursuits.monster!.doors).toEqual([]);
    });
    it('rejects malformed persisted timers and reports incomplete object authoring', () => {
      expect(isHorrorState({ pursuits: { m: { home: {mapId:'a',x:0,y:0}, active:true, searchMs: NaN, doors:[] } } })).toBe(false);
      const { world } = fixture();
      expect(lintHorrorAuthoring(world.project).some(i => i.code === 'authoring:object-graphic')).toBe(true);
    });
  });
});

describe("layoutPlacementValidate", () => {
  isolateTimers();
  // 나무·호수 타일 번호는 합본 마을 칩셋 기준이다 — 2026-10-07 정리 뒤 기본이 beodeul_city 라 옛 저장본처럼 시작 맵을 합본 마을에 둔다.
  const combinedTownProject = () => startOnRetiredCombinedTown(createBlankProject());
  const MAP = "map_blank_start";
  const CONIFER_TOP = 260;
  const CONIFER_BOTTOM = 290;
  describe("validateLayoutPlacement", () => {
    it("flags props on water as error", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      map.lowerTiles[5 * map.width + 5] = LAKE_AUTOTILE_TILE.BODY;
      map.upperTiles[5 * map.width + 5] = CONIFER_BOTTOM;
      const issues = validateLayoutPlacement(project, { mapId: MAP });
      expect(issues.some((i) => i.code === "layout-prop-on-water")).toBe(true);
      expect(layoutValidationBlocking(issues).length).toBeGreaterThan(0);
    });

    it("flags incomplete conifer pair", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
      // no bottom
      const issues = validateLayoutPlacement(project, { mapId: MAP });
      expect(issues.some((i) => i.code === "layout-tree-incomplete")).toBe(true);
    });

    it("passes complete conifer on grass (canopy upper + trunk lower)", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      map.lowerTiles[4 * map.width + 4] = TILE.GRASS;
      map.lowerTiles[5 * map.width + 4] = CONIFER_BOTTOM;
      map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
      map.upperTiles[5 * map.width + 4] = TILE.EMPTY;
      const issues = validateLayoutPlacement(project, {
        mapId: MAP,
        instruction: "나무 3그루 놔줘",
      });
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    });

    it("passes forest stack where canopy sits on trunk cell", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      // 그루1: top@4, trunk lower@5 / 그루2: top upper@5, trunk lower@6
      map.lowerTiles[5 * map.width + 4] = CONIFER_BOTTOM;
      map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
      map.lowerTiles[6 * map.width + 4] = CONIFER_BOTTOM;
      map.upperTiles[5 * map.width + 4] = CONIFER_TOP;
      const issues = validateLayoutPlacement(project, { mapId: MAP, instruction: "숲" });
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    });

    it("warns (does not block) when instruction asks for trees but none landed", () => {
      const project = combinedTownProject();
      const issues = validateLayoutPlacement(project, {
        mapId: MAP,
        instruction: "호수 주변에 나무 심어",
        toolNames: ["place_props"],
      });
      expect(issues.some((i) => i.code === "layout-tree-missing")).toBe(true);
      expect(layoutValidationBlocking(issues)).toEqual([]);
      expect(formatLayoutValidationSummary(issues)).toContain("나무");
    });
  });
  describe("repairLayoutPlacement", () => {
    it("물 위 나무를 육지로 옮겨 검증을 통과시킨다", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      map.lowerTiles[5 * map.width + 5] = LAKE_AUTOTILE_TILE.BODY;
      map.upperTiles[5 * map.width + 5] = CONIFER_BOTTOM;
      const repaired = repairLayoutPlacement(project, { mapId: MAP });
      expect(map.upperTiles[5 * map.width + 5]).toBe(CONIFER_BOTTOM);
      expect(repaired.project.maps[MAP].upperTiles[5 * map.width + 5]).toBe(TILE.EMPTY);
      expect(repaired.counts.relocated + repaired.counts.removed).toBeGreaterThan(0);
      expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
    });

    it("밑동 없는 수관에 밑동을 붙여 통과시킨다", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
      const repaired = repairLayoutPlacement(project, { mapId: MAP });
      expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
      expect(repaired.counts.trunksAdded + repaired.counts.removed).toBeGreaterThan(0);
    });

    it("지시만 있고 나무가 없으면 보식해서 통과시킨다", () => {
      const project = combinedTownProject();
      const repaired = repairLayoutPlacement(project, {
        mapId: MAP,
        instruction: "호수 주변에 나무 심어",
        toolNames: ["place_props"],
      });
      expect(repaired.counts.treesPlanted).toBeGreaterThan(0);
      expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
    });

    it("이미 통과하는 숲은 타일을 바꾸지 않는다", () => {
      const project = combinedTownProject();
      const map = project.maps[MAP];
      map.lowerTiles[4 * map.width + 4] = TILE.GRASS;
      map.lowerTiles[5 * map.width + 4] = CONIFER_BOTTOM;
      map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
      const beforeUpper = map.upperTiles.slice();
      const beforeLower = map.lowerTiles.slice();
      const repaired = repairLayoutPlacement(project, { mapId: MAP, instruction: "나무 3그루 놔줘" });
      expect(repaired.project.maps[MAP].upperTiles).toEqual(beforeUpper);
      expect(repaired.project.maps[MAP].lowerTiles).toEqual(beforeLower);
      expect(layoutRepairIdle(repaired.counts)).toBe(true);
      expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
    });

    it("region 을 주면 그 상자 안에만 보식한다 — 밖에 심으면 게이트는 여전히 0그루를 본다", () => {
      const project = combinedTownProject();
      const region = { x: 2, y: 2, width: 6, height: 6 };
      const repaired = repairLayoutPlacement(project, {
        mapId: MAP,
        instruction: "나무 놓아줘",
        toolNames: ["place_props"],
        region,
      });

      expect(repaired.counts.treesPlanted).toBeGreaterThan(0);

      const map = repaired.project.maps[MAP];
      const planted: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const index = y * map.width + x;
          if (LAYOUT_TREE_TILE_IDS.has(map.upperTiles[index]) || LAYOUT_TREE_TILE_IDS.has(map.lowerTiles[index])) {
            planted.push({ x, y });
          }
        }
      }

      expect(planted.length).toBeGreaterThan(0);
      for (const cell of planted) {
        expect(cell.x).toBeGreaterThanOrEqual(region.x);
        expect(cell.x).toBeLessThan(region.x + region.width);
        expect(cell.y).toBeGreaterThanOrEqual(region.y);
        expect(cell.y).toBeLessThan(region.y + region.height);
      }
    });
  });
  function layoutRepairIdle(counts: { relocated: number; removed: number; trunksAdded: number; treesPlanted: number }): boolean {
    return counts.relocated + counts.removed + counts.trunksAdded + counts.treesPlanted === 0;
  }
});
