import { describe, expect, it, vi, afterEach } from "vitest";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { createStarterHouseInteriorMap } from "@/project/defaults/starterHouseTransfer";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameMap } from "@/project/types";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { findBlockingRuntimeEventAtInMap,
findRuntimeEventAtInMap,
initialRuntimeEventPositions, } from "@/project/runtimeEventState"
import { event, mockSprite, pageWith } from "./runtimeEventPageFixtures";

describe("runtime NPC living map travel", () => {
  it("routes an NPC through map connections to a living destination on another map", () => {
    // Given: an NPC has a living destination in the starter house and an NPC-enabled door connection.
    const project = createBlankProject();
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("missing default source map");
    const targetMap = createStarterHouseInteriorMap(sourceMap.id);
    project.maps[targetMap.id] = targetMap;
    sourceMap.events = [event("traveler", 6, 10, [livingPage(targetMap.id, 4, 6)])];
    project.mapConnections = [
      {
        id: "link_starter_house",
        from: { mapId: sourceMap.id, x: 7, y: 10 },
        to: { mapId: targetMap.id, x: 4, y: 7, direction: "down" },
        npcEnabled: true,
        playerEnabled: true,
      },
    ];
    const scene = movementScene(project, sourceMap);

    // When: autonomous movement ticks enough times to step to the exit and transfer.
    registerPageMoveRoutes(scene);
    tick(scene, 8);

    // Then: the NPC is now tracked on the target map at the linked entry.
    expect(scene.session.eventLocations.traveler).toEqual({
      mapId: targetMap.id,
      x: 4,
      y: 7,
      direction: "down",
    });

    // When: the player later visits that target map, the same NPC continues to its actual living destination.
    scene.map = targetMap;
    scene.eventPositions = initialRuntimeEventPositions(targetMap.events);
    registerPageMoveRoutes(scene);
    tick(scene, 10);

    // Then: the NPC is no longer stranded at the doorway; it walks to the authored destination.
    expect(scene.session.eventLocations.traveler).toEqual({
      mapId: targetMap.id,
      x: 4,
      y: 6,
      direction: "up",
    });
  });

  it("keeps living NPCs safe when no NPC-enabled map connection exists", () => {
    // Given: an NPC wants another map, but the only connection is player-only.
    const project = createBlankProject();
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("missing default source map");
    const targetMap = createStarterHouseInteriorMap(sourceMap.id);
    project.maps[targetMap.id] = targetMap;
    sourceMap.events = [event("traveler", 6, 10, [livingPage(targetMap.id, 4, 6)])];
    project.mapConnections = [
      {
        id: "player_only_link",
        from: { mapId: sourceMap.id, x: 7, y: 10 },
        to: { mapId: targetMap.id, x: 4, y: 6 },
        npcEnabled: false,
        playerEnabled: true,
      },
    ];
    const scene = movementScene(project, sourceMap);

    // When: autonomous movement tries to resolve a living route.
    registerPageMoveRoutes(scene);
    tick(scene, 4);

    // Then: no unsafe teleport occurs and the NPC remains on its source map.
    expect(scene.session.eventLocations.traveler).toBeUndefined();
    expect(scene.eventPositions.traveler).toEqual({ x: 6, y: 10 });
  });

  it("persists transferred NPC locations and living progress through save/load", () => {
    // Given: a session has a transferred living NPC and a remembered destination index.
    const project = createBlankProject();
    const session = startSession(project);
    session.eventLocations.traveler = {
      mapId: "map_starter_house_interior",
      x: 4,
      y: 6,
      direction: "down",
    };
    session.npcTravelStates.traveler = { destinationIndex: 1 };

    // When: the play session is saved and restored.
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);

    // Then: cross-map NPC state survives the save boundary.
    expect(restored.eventLocations.traveler).toEqual(session.eventLocations.traveler);
    expect(restored.npcTravelStates.traveler).toEqual({ destinationIndex: 1 });
  });

  it("removes transferred-away NPCs from source-map blocking, action, and touch lookup", () => {
    // Given: source-map events have been transferred to another map but retain source-map-like coordinates.
    const project = createBlankProject();
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("missing default source map");
    const targetMap = createStarterHouseInteriorMap(sourceMap.id);
    project.maps[targetMap.id] = targetMap;
    sourceMap.events = [
      event("away-action", 6, 10, [pageWith({ trigger: { kind: "action" }, priority: "same" })]),
      event("away-touch", 7, 10, [pageWith({ trigger: { kind: "playerTouch" }, priority: "below" })]),
    ];
    const session = startSession(project);
    session.eventLocations["away-action"] = { mapId: targetMap.id, x: 6, y: 10, direction: "down" };
    session.eventLocations["away-touch"] = { mapId: targetMap.id, x: 7, y: 10, direction: "down" };
    const positions = initialRuntimeEventPositions(sourceMap.events);

    // When/Then: player movement lookups on the source map do not see transferred-away events as ghosts.
    expect(findBlockingRuntimeEventAtInMap(project, sourceMap, session, positions, 6, 10)).toBeUndefined();
    expect(findRuntimeEventAtInMap(project, sourceMap, session, positions, 6, 10, "action")).toBeUndefined();
    expect(findRuntimeEventAtInMap(project, sourceMap, session, positions, 7, 10, ["touch", "playerTouch"])).toBeUndefined();
  });
});

function livingPage(mapId: string, x: number, y: number): EventPage {
  return pageWith({
    movement: {
      type: "living",
      speed: 8,
      frequency: 8,
      living: {
        destinations: [{ mapId, x, y, direction: "down" }],
        repeat: false,
      },
    },
  });
}

function movementScene(project: ReturnType<typeof createBlankProject>, map: GameMap): Parameters<typeof registerPageMoveRoutes>[0] & Parameters<typeof updateAutonomousNPCs>[0] {
  store.replace(project);
  const eventSprites = new Map<string, ReturnType<typeof mockSprite>>();
  eventSprites.set("traveler", mockSprite());
  let scene: Parameters<typeof registerPageMoveRoutes>[0] & Parameters<typeof updateAutonomousNPCs>[0];
  scene = {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    pageMoveRouteKeys: new Set(),
    pageMoveRouteEventIds: new Set(),
    autonomousNPCs: new Map(),
    registerAutonomousMover: (eventId, moves, repeat) => {
      registerAutonomousMover(scene, eventId, moves, repeat);
    },
    eventSprites,
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: 0,
    tileY: 0,
  };
  return scene;
}

function tick(scene: Parameters<typeof updateAutonomousNPCs>[0], count: number): void {
  for (let index = 0; index < count; index += 1) updateAutonomousNPCs(scene, 1200);
}


// Count actual path-search entries, including failed ones, rather than wall-clock timing.
import * as terrain from "@/project/tilePassabilityComponents";
import { applyChangeTileStep } from "@/player/playSceneMapCommands";

afterEach(() => vi.restoreAllMocks());

function blockedTravelFixture(width = 3, height = 5) {
  const project = createBlankProject();
  const base = Object.values(project.tilesets)[0]!;
  project.tilesets.t = { ...base, id: "t", count: 2,
    passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
    priority: ["lower", "lower"], ledgeDirections: undefined };
  const map = { ...createBlankMap("m", width, height, "t"), id: "m",
    lowerTiles: Array(width * height).fill(0), upperTiles: Array(width * height).fill(-1) };
  project.maps = { m: map };
  project.startMapId = "m";
  map.events = [event("e0", 2, 2, [livingPage("m", 2, 4)]), event("e1", 2, 3, [livingPage("m", 2, 3)])];
  return { project, map };
}

function blockedScene() {
  const { project, map } = blockedTravelFixture();
  const scene = movementScene(project, map);
  scene.tileX = -1;
  scene.tileY = -1;
  registerPageMoveRoutes(scene);
  // Exercise the terrain-edit route replacement as in the reported end state.
  applyChangeTileStep(Object.assign(scene, { getMapId: () => scene.map.id }) as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 0, y: 0, tile: 1 } as never);
  registerPageMoveRoutes(scene);
  return scene;
}

function frames(scene: ReturnType<typeof movementScene>, count: number, refresh = true) {
  for (let i = 0; i < count; i++) {
    updateAutonomousNPCs(scene, 80);
    if (refresh) registerPageMoveRoutes(scene);
  }
}

describe("living NPC event-blocked rerouting", () => {
  it("reaches (2,4) around the arrived resident at (2,3) on the edited 3x5 map", () => {
    const scene = blockedScene();
    const bfs = vi.spyOn(terrain, "terrainMayReach");
    frames(scene, 7);
    const beforeThreshold = bfs.mock.calls.length;
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 2 });
    frames(scene, 1);
    const atThreshold = bfs.mock.calls.length;
    frames(scene, 16);
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 4 });
    expect(scene.eventPositions.e1).toMatchObject({ x: 2, y: 3 });
    expect(beforeThreshold).toBe(0);
    expect(atThreshold).toBe(1);
    expect(bfs).toHaveBeenCalledTimes(1);
  });

  it("waits without consuming the route when no detour exists; retries are cooldown bounded", () => {
    const { project, map } = blockedTravelFixture();
    for (let y = 0; y < 5; y++) map.lowerTiles[y * 3 + 1] = 1;
    const scene = movementScene(project, map);
    registerPageMoveRoutes(scene);
    const bfs = vi.spyOn(terrain, "terrainMayReach");
    frames(scene, 60);
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 2 });
    expect(scene.autonomousNPCs.get("e0")?.step).toBe(0);
    expect(bfs).toHaveBeenCalledTimes(5); // 640, 1680, 2720, 3760, 4800ms
    // Once the blocker leaves, the original waiting step remains usable.
    scene.eventPositions.e1 = { x: 0, y: 3 };
    frames(scene, 4, false);
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 4 });
  });

  it("does not accept an adjacent tile as arrival when the destination itself is occupied", () => {
    const { project, map } = blockedTravelFixture();
    map.events[0]!.pages = [livingPage("m", 2, 3)];
    const scene = movementScene(project, map);
    registerPageMoveRoutes(scene);
    const bfs = vi.spyOn(terrain, "terrainMayReach");
    frames(scene, 40);
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 2 });
    expect(scene.autonomousNPCs.get("e0")?.moves.length).toBe(1);
    expect(scene.session.npcTravelStates.e0).toBeUndefined();
    // 끝 칸 자체가 점유돼 있으면 어떤 우회로도 도착하지 못한다 — 맵 전체 BFS 를 돌리지 않는다.
    expect(bfs).toHaveBeenCalledTimes(0);
  });

  it("transient event blockage and player blockage do not add BFS calls", () => {
    const scene = blockedScene();
    const bfs = vi.spyOn(terrain, "terrainMayReach");
    frames(scene, 4, false);
    scene.eventPositions.e1 = { x: 0, y: 3 };
    scene.tileX = 2;
    scene.tileY = 3;
    frames(scene, 30, false);
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 2 });
    expect(bfs).toHaveBeenCalledTimes(0);
    scene.tileX = -1;
    frames(scene, 4, false);
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 4 });
  });

  it("avoids the whole blocking passage rectangle, not just the event anchor", () => {
    const { project, map } = blockedTravelFixture();
    map.events[1] = event("e1", 1, 3, [{ ...livingPage("m", 1, 3), footprint: { width: 2, height: 1 }, passRows: 1 }]);
    const scene = movementScene(project, map);
    registerPageMoveRoutes(scene);
    for (let i = 0; i < 32; i++) {
      frames(scene, 1);
      const p = scene.eventPositions.e0!;
      expect(p.y === 3 && p.x >= 1).toBe(false);
    }
    expect(scene.eventPositions.e0).toMatchObject({ x: 2, y: 4 });
  });

  it("retains the NPC transfer after rerouting around an event on the way to the exit", () => {
    const { project, map } = blockedTravelFixture();
    const target = { ...createBlankMap("target", 3, 5, "t"), id: "target", lowerTiles: Array(15).fill(0) };
    project.maps.target = target;
    map.events[0]!.pages = [livingPage("target", 1, 1)];
    project.mapConnections = [{ id: "exit", npcEnabled: true, playerEnabled: true,
      from: { mapId: "m", x: 2, y: 4 }, to: { mapId: "target", x: 1, y: 1 } }];
    const scene = movementScene(project, map);
    registerPageMoveRoutes(scene);
    frames(scene, 24);
    expect(scene.session.eventLocations.e0).toMatchObject({ mapId: "target", x: 1, y: 1 });
  });

  it("keeps 300 unblocked residents at exactly 300 initial BFS calls across movement and refreshes", () => {
    const { project, map } = blockedTravelFixture(12, 300);
    map.events = Array.from({ length: 300 }, (_, y) => event(`e${y}`, 0, y, [livingPage("m", 11, y)]));
    const scene = movementScene(project, map);
    scene.tileX = -1;
    scene.tileY = -1;
    const bfs = vi.spyOn(terrain, "terrainMayReach");
    registerPageMoveRoutes(scene);
    expect(bfs).toHaveBeenCalledTimes(300);
    frames(scene, 30);
    expect(bfs).toHaveBeenCalledTimes(300);
    for (let y = 0; y < 300; y++) expect(scene.eventPositions[`e${y}`]).toMatchObject({ x: 11, y });
  });
});
describe("living NPC reroute frame budget", () => {
  it("동시에 막힌 주민 20명이 한 프레임에 BFS 를 몰아 돌리지 않고 프레임마다 2명씩 나눠 푼다", () => {
    const width = 30;
    const height = 44;
    const { project, map } = blockedTravelFixture(width, height);
    // 주민 i: (2,2i) → (6,2i). (3,2i) 에 고정 이벤트가 있어 아랫줄로 돌아가야 한다.
    const fixed = (id: string, x: number, y: number) => event(id, x, y, [{ ...livingPage("m", x, y), movement: { type: "fixed" as const, speed: 3, frequency: 3 } }]);
    map.events = [];
    for (let i = 0; i < 20; i++) {
      map.events.push(event(`r${i}`, 2, 2 * i, [livingPage("m", 6, 2 * i)]));
      map.events.push(fixed(`b${i}`, 3, 2 * i));
    }
    const scene = movementScene(project, map);
    scene.tileX = -1;
    scene.tileY = -1;
    registerPageMoveRoutes(scene);
    const bfs = vi.spyOn(terrain, "terrainMayReach");
    const perFrame: number[] = [];
    for (let frame = 0; frame < 40; frame++) {
      const before = bfs.mock.calls.length;
      updateAutonomousNPCs(scene, 80);
      perFrame.push(bfs.mock.calls.length - before);
    }
    expect(Math.max(...perFrame)).toBeLessThanOrEqual(2);
    expect(bfs.mock.calls.length).toBeGreaterThanOrEqual(20);
    for (let frame = 0; frame < 200; frame++) updateAutonomousNPCs(scene, 80);
    for (let i = 0; i < 20; i++) expect(scene.eventPositions[`r${i}`], `r${i}`).toMatchObject({ x: 6, y: 2 * i });
  });
});
describe("living NPC reroute fairness", () => {
  it("우회 불가로 계속 실패하는 앞쪽 주민이 예산을 독점하지 않는다(이동 간격 1초)", () => {
    const { project, map } = blockedTravelFixture(12, 12);
    const fixed = (id: string, x: number, y: number) => event(id, x, y, [{ ...livingPage("m", x, y), movement: { type: "fixed" as const, speed: 3, frequency: 3 } }]);
    map.events = [];
    // 앞 두 명(a0,a1)은 목적지 앞길이 막혀 우회로가 없다. 세 번째(c)는 우회 가능하다.
    for (let x = 0; x < 12; x++) if (x !== 1 && x !== 3) map.lowerTiles[1 * 12 + x] = 1;
    map.events.push(event("a0", 1, 0, [livingPage("m", 1, 2)]), fixed("ba0", 1, 1));
    map.events.push(event("a1", 3, 0, [livingPage("m", 3, 2)]), fixed("ba1", 3, 1));
    map.events.push(event("c", 5, 6, [livingPage("m", 9, 6)]), fixed("bc", 6, 6));
    const scene = movementScene(project, map);
    scene.tileX = -1;
    scene.tileY = -1;
    registerPageMoveRoutes(scene);
    for (const mover of scene.autonomousNPCs.values()) mover.moveIntervalMs = 1000;
    for (let t = 0; t < 30_000; t += 16) updateAutonomousNPCs(scene, 16);
    expect(scene.eventPositions.c).toMatchObject({ x: 9, y: 6 });
  });
});
