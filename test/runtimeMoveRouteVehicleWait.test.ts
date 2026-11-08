// 작가가 쓴 명령 경로(moveEvent)의 다음 칸을 지나가는 차가 덮고 있으면 걸음을 버리지 않고 잠깐 기다린다.
// 첫사랑 오프닝(2026-11-05 적대 VQA): 횡단보도를 뛰어 내려오던 남자가 차선의 밴에 막혀 걸음이 소비되어 7칸 못 미쳐 섰다(9회 중 5회).
// 서 있는 차(고장·정류장)는 3초만 기다리고 예전처럼 소비한다 — 영구 대기 없음.
import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { createTransitSim, type TransitSim } from "@/project/mapTransit";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { mockSprite } from "./runtimeEventPageFixtures";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

const MAP_ID = "map_vehicle_wait";

function npc(id: string, at: { x: number; y: number }): GameEvent {
  return {
    id, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: `${id}_base`, name: "NPC", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
    }],
  } as unknown as GameEvent;
}

function build(): { project: Project; map: GameMap } {
  const map = createBlankMap("차 대기", 12, 12);
  map.id = MAP_ID;
  map.lowerTiles = new Array(144).fill(TILE.GRASS);
  map.upperTiles = new Array(144).fill(-1);
  map.events = [npc("walker", { x: 5, y: 1 })];
  const project = withRetiredEasyRpgTilesets(createBlankProject());
  const town = project.tilesets[RETIRED_COMBINED_TOWN_TILESET_ID]!;
  map.tilesetId = town.id;
  map.tileSize = town.tileSize;
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 0 };
  return { project, map };
}

function parkedTruckSim(): TransitSim {
  const sim = createTransitSim({
    routes: [{ id: "ew", kind: "road", path: [{ x: -6, y: 4 }, { x: 20, y: 4 }], vehicles: ["mc-veh-truck-a"], headwaySec: 1000 }],
  } as unknown as Parameters<typeof createTransitSim>[0], { width: 12, height: 12 }, 0);
  // 경로 칸 i 의 x 는 -6 + i 이고 오른쪽으로 가는 길이 4 의 몸은 머리 칸 기준 x-3..x 를 덮는다 — 머리가 (5,4) 에 오는 pos 11 이어야 걷는 줄 x=5 의 (5,4)를 덮는다(pos 8 은 x -1..2 라 아무것도 막지 않는다).
  sim.vehicles.push({ key: 99, routeIndex: 0, def: sim.routes[0]!.vehicles[0]!, pos: 11, wait: 0, stopAt: null, served: [], blockedSec: 0 });
  return sim;
}

function scene(project: Project, map: GameMap, sim: TransitSim) {
  store.replace(project);
  const sceneMap = mapWithCommittedEvents(map);
  const s = {
    map: sceneMap,
    session: { ...startSession(project), currentMapId: sceneMap.id },
    eventPositions: initialRuntimeEventPositions(sceneMap.events),
    autonomousNPCs: new Map(),
    commandMoveRouteEventIds: new Set<string>(),
    pageMoveRouteKeys: new Set(),
    pageMoveRouteEventIds: new Set(),
    refreshRuntimeSurfaces: () => undefined,
    syncRuntimeState: () => undefined,
    eventSprites: new Map(sceneMap.events.map((event) => [event.id, mockSprite()])),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: 0, tileY: 11,
    transitSim: sim,
  } as unknown as Parameters<typeof registerAutonomousMover>[0] & { transitSim: TransitSim };
  (s as { registerAutonomousMover: unknown }).registerAutonomousMover = (id: string, moves: never, repeat: boolean) => registerAutonomousMover(s, id, moves, repeat);
  return s;
}

const DOWN = { kind: "move", dir: "down" } as const;
const walkDown = (n: number) => Array.from({ length: n }, () => DOWN);

function start(s: ReturnType<typeof scene>, steps: number) {
  s.registerAutonomousMover("walker", walkDown(steps) as never, false);
  s.commandMoveRouteEventIds.add("walker");
  const mover = s.autonomousNPCs.get("walker")!;
  mover.strategy = "sequence";
  mover.moveIntervalMs = 50;
  return mover;
}

function tick(s: ReturnType<typeof scene>, ms: number, frame = 50) {
  for (let t = 0; t < ms; t += frame) updateAutonomousNPCs(s as never, frame);
}

describe("명령 경로: 지나가는 차가 다음 칸을 덮으면 걸음을 잃지 않는다", () => {
  it("차가 비키면 남은 걸음을 전부 걸어 목적지에 선다", () => {
    const { project, map } = build();
    const sim = parkedTruckSim();
    const s = scene(project, map, sim);
    const mover = start(s, 6);
    tick(s, 2000);
    const y = s.eventPositions["walker"]?.y ?? 1;
    expect(y, "트럭이 (5,4)를 덮은 동안에는 그 앞에서 기다린다(걸음을 소비해 7칸 못 미쳐 서지 않는다)").toBeLessThan(4);
    expect(mover.step, "막힌 걸음이 보존되어 있다").toBeLessThan(6);
    sim.vehicles.length = 0;
    tick(s, 3000);
    expect(s.eventPositions["walker"]?.y, "차가 비킨 뒤 남은 경로를 끝까지 걸었다").toBe(7);
  });

  it("영구히 서 있는 차는 3초만 기다리고 예전처럼 걸음을 소비한다(멈춘 채 남지 않는다)", () => {
    const { project, map } = build();
    const sim = parkedTruckSim();
    const s = scene(project, map, sim);
    const mover = start(s, 6);
    // 차 대기는 걸음마다 3초다(막힌 걸음을 소비하면 transitWaitMs 가 0 으로 돌아간다): 칸 (5,4) 앞 y=3 에서 남은 4걸음 × 3초 + 걷는 시간.
    tick(s, 20000);
    expect(mover.step >= mover.moves.length || !s.autonomousNPCs.has("walker"), "경로가 소진되어 무버가 끝났다").toBe(true);
  });

  it("차가 아닌 것(지형)에 막힌 걸음은 예전처럼 소비한다", () => {
    const { project, map } = build();
    const sim = parkedTruckSim();
    sim.vehicles.length = 0;
    map.lowerTiles[3 * 12 + 5] = TILE.WATER;
    const s = scene(project, map, sim);
    const mover = start(s, 4);
    tick(s, 2000);
    expect(mover.transitWaitMs ?? 0, "차 대기가 아니다").toBe(0);
    expect(s.eventPositions["walker"]?.y ?? 1, "물 앞에서 걸음이 소비되어 경로가 진행됐다").toBeLessThan(4);
  });
});
