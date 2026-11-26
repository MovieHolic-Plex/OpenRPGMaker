import { describe, expect, it, vi } from "vitest";
import { findChasePath, nextChaseDecision } from "@/player/chaseAi";
import { updateNpcSchedules, tickNpcSchedules, NPC_SCHEDULE_TICK_MS } from "@/player/npcSchedules";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { applyMapOverrides } from "@/player/playSceneMapRuntime";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { canMove, canMoveFootprint, getTileset, isPassable } from "@/project/collision";
import { createBlankMap, createBlankProject, createStarterMap } from "@/project/defaults";
import { TILE, COMBINED_TOWN_TILESET_ID, DEFAULT_TROOP_ID } from "@/project/defaults/constants";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { setMapTileOverride, startSession } from "@/project/session";
import { store } from "@/project/store";
import { invalidateTilePassabilityComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import { setPassageMark } from "@/project/tilesetPassage";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { EventPage, GameEvent, GameMap, Project, ClusterRule, TileGroupMetadata, StructureKitDef } from "@/project/types";
import { mockSprite } from "./runtimeEventPageFixtures";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { createTransitSim, type TransitSim } from "@/project/mapTransit";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { isolateTimers } from "./mergedTeardown";
import { SKY_ISLAND_CONCEPT_HINT, SKY_ISLAND_TILESET_ID, describesSkyIsland, formatSkyIslandNote, hasSkyIslandTileset, namesSkyIslandTileset, skyIslandPromptLines, skyIslandStyleFor, skyIslandTargetFor } from "@/ai/skyIslandPolicy";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import { SKY_MIN_SIZE, composeSkyIsland, skyPaletteFromTileset, type SkyComposeStyle } from "@/project/skyIslandComposer";
import data from "@/assets/skyIslandTileset.json";
import references from "@/assets/skyIslandReferences.json";
import { declaredIntent } from "./intentFixture";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { SKY_ISLAND_ID, createSkyIslandTileset } from "@/project/defaults/skyIsland";
import { existingMatches } from "@/editor/tools/objectGenTool";
import spec from "../tiledata/sky-island/objects/spec.json";
import ask from "../tiledata/sky-island/objects/ask.json";
import { createStarterHouseInteriorMap, STARTER_HOUSE_INTERIOR_ENTRY, STARTER_HOUSE_SLIME_POS, addStarterHouseDoor, STARTER_HOUSE_SLIME_EVENT_ID } from "@/project/defaults/starterHouseTransfer";
import { nearestPassableTile } from "@/player/playSceneMapCommands";

describe("setClusterRule", () => {
  isolateTimers();
  // 적대적 점검에서 확인된 런타임 결함 6건의 회귀 증거.
  //
  // 각 테스트는 고치기 **전 코드에서 실패**하도록 썼다. 성능 최적화가 만든 결함(1~3)과
  // 그 최적화가 드러낸 기존 결함(4~6)을 한 파일에 모은다 — 전부 "NPC 가 조용히 멈추거나
  // 프레임을 먹는" 같은 증상이라 같이 지켜야 뜻이 있다.
  describe("runtimeAdversarialDefects", () => {
    isolateTimers();
    const SIZE = 16;
    const MAP_ID = "map_adversarial";
    /** 좌우를 가르는 벽 열. 왼쪽(x=1)에서 오른쪽(x=SIZE-2)은 도달 불가다. */
    const WALL_X = 8;
    function walledMap(id = MAP_ID, size = SIZE): GameMap {
      const map = createBlankMap("적대 점검", size, size);
      map.id = id;
      map.lowerTiles = new Array(size * size).fill(TILE.GRASS);
      map.upperTiles = new Array(size * size).fill(-1);
      for (let y = 0; y < size; y += 1) map.lowerTiles[y * size + WALL_X] = TILE.WATER;
      return map;
    }
    function projectWith(map: GameMap): Project {
      // TILE.GRASS/WATER/PATH 는 옛 combined_town 칸 번호다 — 기본 칩셋이 beodeul_city 로 바뀐 뒤(PR #2335) 그 칩셋을 직접 깐다.
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const town = project.tilesets[RETIRED_COMBINED_TOWN_TILESET_ID]!;
      map.tilesetId = town.id;
      map.tileSize = town.tileSize;
      project.maps = { [map.id]: map };
      project.mapTree = { mapId: map.id, children: [] };
      project.startMapId = map.id;
      project.startPos = { x: 0, y: 0 };
      project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 };
      return project;
    }
    function baseMover(overrides: Partial<AutonomousMover> = {}): AutonomousMover {
      return {
        moves: [],
        step: 0,
        timer: 1000,
        repeat: false,
        strategy: "chase",
        facing: "down",
        directionFix: false,
        through: false,
        animationEnabled: true,
        opacity: 255,
        speedRank: 3,
        frequencyRank: 3,
        moveIntervalMs: 100,
        moveDurationMs: 300,
        activeMove: null,
        ...overrides,
      };
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. 통행 사각이 1x1 이면 pass 를 넘겨도 성분 색인을 쓴다
    //
    // 런타임 추격은 1x1 NPC 에도 pass 를 **객체로 항상** 넘긴다. 색인 게이트가 pass 의
    // 유무를 보면 모든 추격 NPC 에서 색인이 죽어 도달 불가 탐색이 맵 전체를 매번 훑는다.
    // ─────────────────────────────────────────────────────────────────────────────
    describe("성분 색인은 pass 유무가 아니라 사각 크기로 갈린다", () => {
      const UNIT_PASS = { footprint: { width: 1, height: 1 }, passRows: 1 } as const;

      it("1x1 통행 사각은 canMoveFootprint 가 canMove 와 완전히 같다 (색인 전제)", () => {
        const map = walledMap("map_unit_equiv", 12);
        const project = projectWith(map);
        // 통행 성질이 섞이도록 물·길·풀을 결정적으로 깐다.
        const palette = [TILE.GRASS, TILE.WATER, TILE.PATH];
        for (let index = 0; index < map.lowerTiles.length; index += 1) {
          map.lowerTiles[index] = palette[(index * 7 + 3) % palette.length] as number;
        }
        let checked = 0;
        for (let y = 0; y < map.height; y += 1) {
          for (let x = 0; x < map.width; x += 1) {
            for (const delta of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
              const nx = x + delta.x;
              const ny = y + delta.y;
              if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
              checked += 1;
              expect(
                canMoveFootprint(project, map, x, y, UNIT_PASS.footprint, nx, ny, UNIT_PASS.passRows),
                `(${x},${y})→(${nx},${ny}) 에서 1x1 발자국이 canMove 와 다르다 — 색인 전제가 깨진다`
              ).toBe(canMove(project, map, x, y, nx, ny));
            }
          }
        }
        expect(checked).toBeGreaterThan(400);
      });

      it("1x1 pass 를 넘긴 추격 실패도 색인을 만든다", () => {
        const map = walledMap("map_unit_arm");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);

        expect(findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS)).toEqual([]);
        expect(
          terrainMayReach(project, map, 1, 1, SIZE - 2, 1),
          "1x1 추격 실패가 색인을 만들지 않았다 — 런타임 추격 전체에서 색인이 죽는다"
        ).toBe(false);
      });

      it("1x1 pass 를 넘긴 추격은 색인을 읽어 탐색을 건너뛴다", () => {
        const map = walledMap("map_unit_read");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        // 첫 실패로 색인을 세운다.
        findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS);

        // 이 최적화는 답을 바꾸지 않고 **값만** 바꾸므로 결과로는 관찰할 수 없다. canMove 가
        // 호출마다 project.tilesets[map.tilesetId] 를 읽는 것을 세어 탐색을 돌았는지 가린다.
        const tilesets = project.tilesets;
        let reads = 0;
        (project as { tilesets: typeof tilesets }).tilesets = new Proxy(tilesets, {
          get(target, property, receiver) {
            if (property === map.tilesetId) reads += 1;
            return Reflect.get(target, property, receiver);
          },
        });
        const path = findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS);
        (project as { tilesets: typeof tilesets }).tilesets = tilesets;

        expect(path).toEqual([]);
        // 왼쪽 성분은 약 120칸이라 A* 를 돌면 통행 판정이 수백 번이다. 색인을 읽으면
        // 지문 검증에 쓰는 한두 번으로 끝난다.
        expect(reads, `색인이 있는데도 통행 판정을 ${reads}번 했다 — 탐색을 그대로 돌았다`).toBeLessThan(10);
      });

      it("1x1 보다 큰 통행 사각은 여전히 색인을 만들지도 읽지도 않는다", () => {
        const map = walledMap("map_wide_pass");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        const wide = { footprint: { width: 3, height: 3 }, passRows: 1 } as const;

        expect(findChasePath(project, map, { x: 1, y: 4 }, { x: SIZE - 2, y: 4 }, wide)).toEqual([]);
        expect(
          terrainMayReach(project, map, 1, 4, SIZE - 2, 4),
          "비대칭 통행 그래프의 답이 색인에 섞였다"
        ).toBe(true);
      });

      it("nextChaseDecision 경로(런타임과 같은 호출)도 색인을 만든다", () => {
        const map = walledMap("map_decision_arm");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        const mover = baseMover({ chaseRepathTimerMs: 1000 });

        const decision = nextChaseDecision({
          project,
          map,
          from: { x: 1, y: 1 },
          player: { x: SIZE - 2, y: 1 },
          deltaMs: 16,
          mover,
          pathfind: true,
          // playSceneAutonomous 가 넘기는 것과 같은 모양.
          pass: { footprint: { width: 1, height: 1 }, passRows: 1 },
        });

        expect(decision.kind).toBe("wait");
        expect(
          terrainMayReach(project, map, 1, 1, SIZE - 2, 1),
          "런타임과 같은 호출에서 색인이 만들어지지 않았다"
        ).toBe(false);
      });

      it("훑은 성분이 면적에 비해 작으면 색인을 만들지 않는다", () => {
        // 3x3 방 하나에 갇힌 자리에서 실패하면, 색인 빌드(면적 전체)가 방금 훑은 값보다 훨씬 비싸다.
        const map = createBlankMap("작은 성분", 40, 40);
        map.id = "map_small_component";
        map.lowerTiles = new Array(40 * 40).fill(TILE.WATER);
        map.upperTiles = new Array(40 * 40).fill(-1);
        for (let y = 1; y <= 3; y += 1) {
          for (let x = 1; x <= 3; x += 1) map.lowerTiles[y * 40 + x] = TILE.GRASS;
        }
        map.lowerTiles[20 * 40 + 20] = TILE.GRASS;
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);

        expect(findChasePath(project, map, { x: 2, y: 2 }, { x: 20, y: 20 })).toEqual([]);
        expect(
          terrainMayReach(project, map, 2, 2, 20, 20),
          "9칸을 훑고 1600칸 색인을 지었다 — 색인이 없을 때보다 느려진다"
        ).toBe(true);
      });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 2. 타일셋 통행 정의를 제자리에서 고쳐도 색인이 낡음을 잡는다
    //
    // setPassageMark 는 같은 TilesetDef 객체를 제자리에서 바꾼다. identity 비교만으로는
    // 못 잡고, 타일만 해싱한 지문도 못 잡는다.
    // ─────────────────────────────────────────────────────────────────────────────
    describe("색인 지문은 타일셋 통행 정의도 덮는다", () => {
      it("벽 타일을 통행 가능으로 바꾸면 추격이 다시 경로를 찾는다", () => {
        const map = walledMap("map_tileset_open");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        const from = { x: 1, y: 1 };
        const to = { x: SIZE - 2, y: 1 };

        expect(findChasePath(project, map, from, to)).toEqual([]);
        expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);

        // 타일 배열은 그대로다 — 타일셋 정의만 제자리에서 연다.
        const tileset = getTileset(project, map);
        expect(tileset).not.toBeNull();
        const sameTiles = map.lowerTiles;
        setPassageMark(tileset!, TILE.WATER, "o");
        expect(map.lowerTiles).toBe(sameTiles);

        expect(
          terrainMayReach(project, map, from.x, from.y, to.x, to.y),
          "타일셋 통행을 열었는데 색인이 여전히 도달 불가라고 우긴다"
        ).toBe(true);
        const path = findChasePath(project, map, from, to);
        expect(path.length, "벽 타일이 열렸는데 경로를 못 찾았다").toBeGreaterThan(0);
        expect(path[path.length - 1]).toEqual(to);
      });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 3. 스로틀 누적기는 초과분을 이월한다
    // ─────────────────────────────────────────────────────────────────────────────
    describe("시간표 스로틀은 프레임이 길어져도 주기를 늘리지 않는다", () => {
      /**
       * 점검이 실제로 돌았는지는 결과로 안 드러난다(이벤트가 없으면 아무것도 안 바뀐다).
       * updateNpcSchedules 의 첫 줄이 store.getCurrent() 라 그 호출 수가 곧 점검 횟수다.
       */
      function throttleScene(): Parameters<typeof tickNpcSchedules>[0] {
        const map = createBlankMap("스로틀", 8, 8);
        map.id = "map_throttle";
        map.events = [];
        const project = projectWith(map);
        store.replace(project);
        return {
          map,
          session: { ...startSession(project), currentMapId: map.id },
          eventPositions: {},
          autonomousNPCs: new Map(),
          commandMoveRouteEventIds: new Set(),
          registerAutonomousMover: () => undefined,
          refreshRuntimeSurfaces: () => undefined,
          syncRuntimeState: () => undefined,
        } as unknown as Parameters<typeof tickNpcSchedules>[0];
      }

      function countTicks(scene: Parameters<typeof tickNpcSchedules>[0], frames: readonly number[]): number {
        const spy = vi.spyOn(store, "getCurrent");
        for (const frameMs of frames) tickNpcSchedules(scene, false, frameMs);
        const ran = spy.mock.calls.length;
        spy.mockRestore();
        return ran;
      }

      it("99ms 프레임에서도 실효 주기가 100ms 에 붙는다", () => {
        const ran = countTicks(throttleScene(), new Array(100).fill(99));
        // 100 프레임 × 99ms = 9900ms. 100ms 주기면 99회다. 누적기를 0 으로 리셋하면 실효
        // 주기가 198ms 로 늘어 50회로 떨어진다 — 프레임이 길어질 때가 바로 이 스로틀이
        // 겨냥한 상황이므로 거기서 두 배로 느려지면 안 된다.
        expect(ran, `99ms 프레임에서 ${ran}회만 돌았다 — 실효 주기가 늘었다`).toBeGreaterThanOrEqual(99);
      });

      it("60ms 프레임에서도 주기가 120ms 로 늘지 않는다", () => {
        const ran = countTicks(throttleScene(), new Array(60).fill(60));
        // 60 × 60ms = 3600ms → 100ms 주기면 36회. 리셋이면 120ms 주기라 30회다.
        expect(ran, `60ms 프레임에서 ${ran}회만 돌았다`).toBeGreaterThanOrEqual(36);
      });

      it("오래 멈춘 뒤 몰아서 돌지 않는다", () => {
        // 5초짜리 프레임이 세 번 와도 점검은 세 번이다 — 이월을 한 주기 미만으로 자르므로
        // 밀린 시간을 몰아서 돌지 않는다(자르지 않으면 누적기가 무한히 자란다).
        const scene = throttleScene();
        expect(countTicks(scene, [5000, 5000, 5000]), "멈춘 시간을 몰아서 돌았다").toBe(3);
        expect(NPC_SCHEDULE_TICK_MS).toBe(100);
      });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 4~6. 시간표 사슬의 기존 결함
    // ─────────────────────────────────────────────────────────────────────────────
    type ScheduleScene = Parameters<typeof updateNpcSchedules>[0]
      & Parameters<typeof updateAutonomousNPCs>[0]
      & Parameters<typeof registerPageMoveRoutes>[0];
    function scheduledNpc(
      id: string,
      at: { x: number; y: number },
      home: { x: number; y: number },
      mapId: string
    ): GameEvent {
      return {
        id,
        x: home.x,
        y: home.y,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{ when: { hourRange: [6, 18] }, at: { mapId, x: at.x, y: at.y }, activity: "work" }],
        pages: [
          {
            id: `${id}_base`,
            name: "NPC",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          } satisfies EventPage,
        ],
      };
    }
    function scheduleScene(project: Project, projectMap: GameMap, playerAt = { x: 0, y: 0 }): ScheduleScene {
      store.replace(project);
      const system = project.system.timeSystem;
      const time = setGameTimeClock(initialGameTime(system)!, 8, 0, system!);
      const sceneMap = mapWithCommittedEvents(projectMap);
      let scene: ScheduleScene;
      scene = {
        map: sceneMap,
        session: { ...startSession(project), currentMapId: sceneMap.id, gameTime: time },
        eventPositions: initialRuntimeEventPositions(sceneMap.events),
        autonomousNPCs: new Map(),
        commandMoveRouteEventIds: new Set(),
        pageMoveRouteKeys: new Set(),
        pageMoveRouteEventIds: new Set(),
        registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
        refreshRuntimeSurfaces: () => undefined,
        syncRuntimeState: () => undefined,
        eventSprites: new Map(sceneMap.events.map((event) => [event.id, mockSprite()])),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
        tileX: playerAt.x,
        tileY: playerAt.y,
      } as ScheduleScene;
      return scene;
    }
    describe("지워진 시간표 NPC 가 이벤트 계층 재생성 루프를 만들지 않는다", () => {
      it("erase 된 NPC 는 시간표 점검에서 변경을 만들지 않는다", () => {
        const map = walledMap("map_erased");
        map.events = [scheduledNpc("npc_erased", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);
        scene.session.erasedEventIds = ["npc_erased"];

        let rebuilds = 0;
        (scene as { refreshRuntimeEntities?: () => void }).refreshRuntimeEntities = () => {
          rebuilds += 1;
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        for (let index = 0; index < 5; index += 1) updateNpcSchedules(scene);
        const warns = warn.mock.calls.length;
        warn.mockRestore();

        expect(
          rebuilds,
          "지워진 NPC 때문에 이벤트 계층이 재생성됐다 — 100ms 마다 영구 반복된다"
        ).toBe(0);
        expect(warns, "지워진 NPC 에 무버를 만들려 시도했다").toBe(0);
        expect(scene.autonomousNPCs.has("npc_erased")).toBe(false);
      });

      it("removeEvent 된 NPC 도 같다", () => {
        const map = walledMap("map_removed");
        map.events = [scheduledNpc("npc_removed", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);
        scene.session.removedEventIds = { [map.id]: ["npc_removed"] };

        let rebuilds = 0;
        (scene as { refreshRuntimeEntities?: () => void }).refreshRuntimeEntities = () => {
          rebuilds += 1;
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        for (let index = 0; index < 5; index += 1) updateNpcSchedules(scene);
        warn.mockRestore();

        expect(rebuilds, "지워진 NPC 때문에 이벤트 계층이 재생성됐다").toBe(0);
      });

      it("멀쩡한 시간표 NPC 는 그대로 경로를 받는다 (필터가 과하지 않다)", () => {
        const map = walledMap("map_alive");
        map.events = [scheduledNpc("npc_alive", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);

        updateNpcSchedules(scene);
        expect(scene.autonomousNPCs.has("npc_alive"), "소거 필터가 살아 있는 NPC 를 걸렀다").toBe(true);
      });
    });
    describe("시간표 목적지 판정과 경로 탐색이 같은 맵을 본다", () => {
      it("changeTile 로 목적지를 막으면 그 자리를 목표로 잡지 않는다", () => {
        const map = walledMap("map_target_sync");
        // 목적지는 벽 왼쪽(같은 성분)이라 원래는 도달 가능하다.
        map.events = [scheduledNpc("npc_sync", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);

        // 씬 맵에서만 목적지를 물로 막는다 — project.maps 는 그대로다.
        const targetIndex = 6 * SIZE + 4;
        setMapTileOverride(scene.session, map.id, "lower", targetIndex, TILE.WATER);
        applyMapOverrides({
          session: scene.session,
          map: scene.map,
          getMapId: () => map.id,
        } as unknown as Parameters<typeof applyMapOverrides>[0]);
        expect(scene.map.lowerTiles[targetIndex]).toBe(TILE.WATER);
        expect(project.maps[map.id]!.lowerTiles[targetIndex]).toBe(TILE.GRASS);

        updateNpcSchedules(scene);
        const mover = scene.autonomousNPCs.get("npc_sync");
        expect(
          mover,
          "막힌 목적지로 경로를 못 받아야 정상이지만, 비켜선 칸으로는 갈 수 있어야 한다"
        ).toBeDefined();
        // 정규화가 씬 맵을 봤다면 물 칸을 피해 인접한 통행 칸으로 목표를 옮긴다.
        // 원본 맵을 봤다면 물 칸을 그대로 목표로 잡고 routeTo 가 실패해 무버가 없다.
      });
    });
    describe("막힌 걸음을 소비하지 않아 순서 경로가 어긋나지 않는다", () => {
      it("플레이어가 길을 막으면 같은 걸음을 다시 시도한다", () => {
        const map = createBlankMap("막힌 걸음", 8, 8);
        map.id = MAP_ID;
        map.lowerTiles = new Array(64).fill(TILE.GRASS);
        map.upperTiles = new Array(64).fill(-1);
        map.events = [scheduledNpc("npc_blocked", { x: 4, y: 4 }, { x: 2, y: 4 }, map.id)];
        const project = projectWith(map);
        // 플레이어가 NPC 의 다음 칸(3,4)에 서 있다.
        const scene = scheduleScene(project, map, { x: 3, y: 4 });

        // 오른쪽으로 두 칸 가는 순서 경로를 직접 심는다.
        scene.registerAutonomousMover(
          "npc_blocked",
          [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }],
          false
        );
        const mover = scene.autonomousNPCs.get("npc_blocked");
        expect(mover).toBeDefined();
        mover!.strategy = "sequence";
        // 시간표·생활 이동의 계산된 경로만 재시도한다(configureScheduleMover 가 세우는 값).
        mover!.retryBlockedSteps = true;
        mover!.moveIntervalMs = 10;
        mover!.timer = 100;

        updateAutonomousNPCs(scene, 100);
        expect(
          mover!.step,
          "막힌 걸음을 소비했다 — 남은 계획 전부가 한 칸 어긋난다"
        ).toBe(0);
        expect(mover!.moves.length, "계획이 버려졌다").toBe(2);

        // 한계까지 막히면 예전처럼 소비해 영구 정지를 만들지 않는다.
        for (let index = 0; index < 20; index += 1) {
          mover!.timer = 100;
          updateAutonomousNPCs(scene, 100);
        }
        expect(
          mover!.step > 0 || mover!.moves.length === 0,
          "영구히 막힌 자리에서 무버가 멈춘 채 남았다 — 재계획이 안 일어난다"
        ).toBe(true);
      });

      it("길이 열리면 어긋남 없이 원래 계획대로 걷는다", () => {
        const map = createBlankMap("열린 길", 8, 8);
        map.id = MAP_ID;
        map.lowerTiles = new Array(64).fill(TILE.GRASS);
        map.upperTiles = new Array(64).fill(-1);
        map.events = [scheduledNpc("npc_resume", { x: 4, y: 4 }, { x: 2, y: 4 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map, { x: 3, y: 4 });

        scene.registerAutonomousMover(
          "npc_resume",
          [{ kind: "move", dir: "right" }, { kind: "move", dir: "down" }],
          false
        );
        const mover = scene.autonomousNPCs.get("npc_resume");
        mover!.strategy = "sequence";
        mover!.retryBlockedSteps = true;
        mover!.moveIntervalMs = 10;

        // 막힌 상태로 한 번 시도.
        mover!.timer = 100;
        updateAutonomousNPCs(scene, 100);
        expect(scene.eventPositions["npc_resume"]?.x ?? 2).toBe(2);

        // 플레이어가 비켜선다.
        (scene as { tileX: number }).tileX = 0;
        mover!.timer = 100;
        updateAutonomousNPCs(scene, 100);
        // 첫 걸음(right)이 소비되지 않았으므로 지금 오른쪽으로 간다 — down 이 아니다.
        expect(
          scene.eventPositions["npc_resume"]?.x,
          "막힌 걸음이 사라져 계획이 어긋났다 — 첫 걸음(right)을 건너뛰었다"
        ).toBe(3);
      });

      // 재시도 대상은 **계산된** 경로뿐이다. 작가가 쓴 custom 경로는 막히면 걸음을 소비하는
      // 기존 동작을 유지해야 한다 — test/runtimeMoveRouteCommands 가 그 계약을 지킨다.
      it("작가가 쓴 custom 경로는 재시도 대상이 아니고 시간표 경로는 대상이다", () => {
        const map = createBlankMap("경로 출처", 8, 8);
        map.id = MAP_ID;
        map.lowerTiles = new Array(64).fill(TILE.GRASS);
        map.upperTiles = new Array(64).fill(-1);
        const authored = scheduledNpc("npc_authored", { x: 4, y: 4 }, { x: 4, y: 4 }, map.id);
        authored.schedule = undefined;
        authored.pages![0].movement = {
          type: "custom",
          speed: 3,
          frequency: 3,
          route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
        };
        const scheduled = scheduledNpc("npc_scheduled", { x: 2, y: 6 }, { x: 6, y: 6 }, map.id);
        map.events = [authored, scheduled];
        const project = projectWith(map);
        const scene = scheduleScene(project, map, { x: 0, y: 0 });

        registerPageMoveRoutes(scene);
        updateNpcSchedules(scene);

        expect(
          scene.autonomousNPCs.get("npc_authored")?.retryBlockedSteps,
          "작가 경로가 재시도 대상이 됐다 — 기존 동작이 바뀐다"
        ).toBe(false);
        expect(
          scene.autonomousNPCs.get("npc_scheduled")?.retryBlockedSteps,
          "시간표 경로가 재시도 대상이 아니다 — A* 계획이 어긋난 채 걷는다"
        ).toBe(true);
      });
    });
  });
  // 작가가 쓴 명령 경로(moveEvent)의 다음 칸을 지나가는 차가 덮고 있으면 걸음을 버리지 않고 잠깐 기다린다.
  // 첫사랑 오프닝(2026-11-05 적대 VQA): 횡단보도를 뛰어 내려오던 남자가 차선의 밴에 막혀 걸음이 소비되어 7칸 못 미쳐 섰다(9회 중 5회).
  // 서 있는 차(고장·정류장)는 3초만 기다리고 예전처럼 소비한다 — 영구 대기 없음.
  describe("runtimeMoveRouteVehicleWait", () => {
    isolateTimers();
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
  });
  describe("setClusterRule", () => {
    isolateTimers();
    function clusterGroup(): TileGroupMetadata {
      return {
        defaultLayer: "lower",
        description: "클러스터 규칙 대상",
        id: "cluster-main",
        name: "클러스터",
        placementRules: "규칙 테스트",
        role: "building",
        tileIds: [260, 290],
      };
    }
    function contextWithGroup(): ToolContext {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      for (const map of Object.values(project.maps)) {
        map.lowerTiles.fill(TILE.GRASS);
        map.upperTiles.fill(TILE.EMPTY);
      }
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [clusterGroup()];
      return { project };
    }
    function rulesOf(ctx: ToolContext): readonly ClusterRule[] {
      return ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0]?.rules ?? [];
    }
    describe("set_cluster_rule", () => {
      it("규칙을 추가하고 같은 id면 갱신한다", () => {
        // Given: a project with one tile group.
        const ctx = contextWithGroup();

        // When: the same cluster rule id is written twice.
        const first = runTool(ctx, "set_cluster_rule", {
          groupId: "cluster-main",
          rule: { id: "roof-wall", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const second = runTool(ctx, "set_cluster_rule", {
          groupId: "cluster-main",
          rule: { id: "roof-wall", kind: "adjacency", message: "260 아래 290 필요", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "medium" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: the rule is updated in place.
        expect(first.ok, first.summary).toBe(true);
        expect(second.ok, second.summary).toBe(true);
        expect(rulesOf(ctx)).toEqual([
          { id: "roof-wall", kind: "adjacency", message: "260 아래 290 필요", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "medium" },
        ]);
      });

      it("없는 그룹과 잘못된 kind는 거부한다", () => {
        // Given: a project with one known group.
        const ctx = contextWithGroup();

        // When: invalid set_cluster_rule calls are made.
        const missing = runTool(ctx, "set_cluster_rule", {
          groupId: "missing",
          rule: { id: "ok", kind: "count", params: { max: 1 }, strength: "soft" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const invalidKind = runTool(ctx, "set_cluster_rule", {
          groupId: "cluster-main",
          rule: { id: "bad", kind: "diagonal", params: {}, strength: "hard" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: both calls fail without changing the group rules.
        expect(missing.ok).toBe(false);
        expect(missing.issues?.[0]?.code).toBe("group-not-found");
        expect(invalidKind.ok).toBe(false);
        expect(invalidKind.issues?.[0]?.code).toBe("invalid-args");
        expect(rulesOf(ctx)).toEqual([]);
      });

      it("upsert_tile_group stores rules and the registry exposes set_cluster_rule", () => {
        // Given: a blank project.
        const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createBlankProject()) };

        // When: a group is upserted with cluster rules.
        const result = runTool(ctx, "upsert_tile_group", {
          name: "규칙 그룹",
          role: "building",
          rules: [{ id: "max-two", kind: "count", params: { max: 2, perMap: true }, strength: "soft" }],
          tileIds: [260, 290],
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: rules are persisted and the new tool is catalog-visible.
        expect(result.ok, result.summary).toBe(true);
        const groupId = (result.data as { readonly groupId: string }).groupId;
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === groupId);
        expect(group?.rules).toEqual([{ id: "max-two", kind: "count", params: { max: 2, perMap: true }, strength: "soft" }]);
        expect(allTools().map((tool) => tool.name)).toContain("set_cluster_rule");
      });
    });
  });
  // 실내 오두막: tile_query 라벨 ↔ place_props material 일치, 상점 NPC 중복 방지.
  describe("shopNpcTableRegionFix", () => {
    isolateTimers();
    function interiorHutContext(): ToolContext {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const mapId = "map_rp_hut_v1";
      const w = 10;
      const h = 9;
      const size = w * h;
      project.maps[mapId] = {
        id: mapId,
        name: "연습 · 오두막 (10×9)",
        width: w,
        height: h,
        tilesetId: INTERIOR_ROOM_TILESET_ID,
        tileSize: 16,
        lowerTiles: new Array(size).fill(72),
        upperTiles: new Array(size).fill(TILE.EMPTY),
        events: [],
      };
      project.startMapId = mapId;
      return { project };
    }
    describe("interior shop NPC + table material path", () => {
      it("tile_query labels for start interior map resolve with place_props 사각 탁자", () => {
        const ctx = interiorHutContext();
        const labels = runTool(ctx, "tile_query", { ask: "labels", query: "탁자" }, { dryRun: true });
        expect(labels.ok, labels.summary).toBe(true);
        const data = labels.data as { tilesetId: string; labels: { label: string }[] };
        expect(data.tilesetId).toBe(INTERIOR_ROOM_TILESET_ID);
        const tableLabel = data.labels.find((l) => l.label.includes("사각") || l.label.includes("긴 탁자") || l.label.includes("원형"))?.label;
        expect(tableLabel, JSON.stringify(data.labels.slice(0, 8))).toBeTruthy();

        const place = runTool(
          ctx,
          "place_props",
          {
            mapId: "map_rp_hut_v1",
            area: { x: 2, y: 4, w: 5, h: 2 },
            material: tableLabel!,
            count: 1,
          },
          { dryRun: false },
        );
        expect(place.ok, place.summary).toBe(true);
      });

      it("places 사각 탁자 on interior wood floor (not outdoor grass-only footprint)", () => {
        const ctx = interiorHutContext();
        const place = runTool(
          ctx,
          "place_props",
          {
            mapId: "map_rp_hut_v1",
            area: { x: 2, y: 4, w: 5, h: 2 },
            material: "사각 탁자",
            count: 1,
          },
          { dryRun: false },
        );
        expect(place.ok, place.summary).toBe(true);
        const map = ctx.project.maps["map_rp_hut_v1"]!;
        expect(map.upperTiles.includes(328)).toBe(true);
        expect(place.summary).toMatch(/1\/1|1개/);
      });

      it("rejects combined-town table labels on interior map", () => {
        const ctx = interiorHutContext();
        const place = runTool(
          ctx,
          "place_props",
          {
            mapId: "map_rp_hut_v1",
            area: { x: 2, y: 4, w: 5, h: 2 },
            material: "가로 탁자 중",
            count: 1,
          },
          { dryRun: false },
        );
        expect(place.ok).toBe(false);
        expect(place.summary).toMatch(/라벨|찾지 못했|material/i);
      });

      it("merges nearby shop NPCs even when the second call uses a different explicit id", () => {
        const ctx = interiorHutContext();
        const mapId = "map_rp_hut_v1";
        const first = runTool(
          ctx,
          "place_npc",
          {
            mapId,
            x: 4,
            y: 5,
            id: "npc_shopkeeper_1",
            name: "상점 주인",
            pages: [{ lines: ["어서 오세요!"] }],
          },
          { dryRun: false },
        );
        expect(first.ok, first.summary).toBe(true);

        const second = runTool(
          ctx,
          "place_npc",
          {
            mapId,
            x: 4,
            y: 4,
            id: "npc_merchant_v1",
            name: "상인",
            graphic: { query: "merchant" },
            pages: [{ text: "어서 오세요!", conditions: [] }],
          },
          { dryRun: false },
        );
        expect(second.ok, second.summary).toBe(true);
        const data = second.data as { eventId: string; reused?: boolean };
        expect(data.eventId).toBe("npc_shopkeeper_1");
        expect(data.reused).toBe(true);
        expect(ctx.project.maps[mapId]!.events).toHaveLength(1);
      });

      it("allows a second distinct NPC when ids are explicit", () => {
        const ctx = interiorHutContext();
        const mapId = "map_rp_hut_v1";
        runTool(ctx, "place_npc", {
          mapId, x: 2, y: 4, id: "npc_a", name: "갑", pages: [{ lines: ["a"] }],
        }, { dryRun: false });
        const second = runTool(ctx, "place_npc", {
          mapId, x: 3, y: 4, id: "npc_b", name: "을", pages: [{ lines: ["b"] }],
        }, { dryRun: false });
        expect(second.ok, second.summary).toBe(true);
        expect(ctx.project.maps[mapId]!.events).toHaveLength(2);
      });
    });
  });
  describe("structureRuleTools", () => {
    isolateTimers();
    function contextWithGroup(): ToolContext {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [roofGroup()];
      return { project };
    }
    function roofGroup(): TileGroupMetadata {
      return {
        defaultLayer: "upper",
        description: "구조 규칙 테스트 지붕",
        id: "roof-main",
        name: "지붕",
        patternGrammar: {
          axis: "both",
          kind: "nine_slice_expandable",
          parts: [
            { role: "bottomLeft", tileIds: [1] },
            { role: "bottom", tileIds: [2] },
            { role: "bottomRight", tileIds: [3] },
          ],
          preserveCaps: true,
          repeat: "center",
        },
        placementRules: "벽 위에 배치",
        role: "roof",
        tileIds: [1, 2, 3],
      };
    }
    describe("structure rule tools", () => {
      it("set_group_junction adds and updates a rule for the same neighbor side", () => {
        // Given: a tileset group that can define roof-wall boundary behavior.
        const ctx = contextWithGroup();

        // When: the junction rule is written, then written again for the same neighbor side.
        const first = runTool(ctx, "set_group_junction", {
          groupId: "roof-main",
          junction: { action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const second = runTool(ctx, "set_group_junction", {
          groupId: "roof-main",
          junction: { action: "replace", atRoles: ["bottomLeft"], replaceWith: [4], side: "below", withRole: "wall" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: the rule is updated in place instead of duplicated.
        expect(first.ok, first.summary).toBe(true);
        expect(second.ok, second.summary).toBe(true);
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0];
        expect(group?.junctions).toEqual([
          { action: "replace", atRoles: ["bottomLeft"], replaceWith: [4], side: "below", withRole: "wall" },
        ]);
      });

      it("set_group_overlay adds and updates a rule for the same condition", () => {
        // Given: a tileset group that can add conditional roof overlays.
        const ctx = contextWithGroup();

        // When: the same overlay condition is written twice.
        const first = runTool(ctx, "set_group_overlay", {
          groupId: "roof-main",
          overlay: { tileIds: [5], when: "diagonalCorner" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const second = runTool(ctx, "set_group_overlay", {
          groupId: "roof-main",
          overlay: { tileIds: [6, 7], when: "diagonalCorner" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: the condition has the latest tile set.
        expect(first.ok, first.summary).toBe(true);
        expect(second.ok, second.summary).toBe(true);
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0];
        expect(group?.overlays).toEqual([{ tileIds: [6, 7], when: "diagonalCorner" }]);
      });

      it("rejects structure rules for an unknown group", () => {
        // Given: a tileset without the requested group id.
        const ctx = contextWithGroup();

        // When: a structure rule targets that id.
        const junction = runTool(ctx, "set_group_junction", {
          groupId: "missing",
          junction: { action: "omit", side: "below", withRole: "wall" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const overlay = runTool(ctx, "set_group_overlay", {
          groupId: "missing",
          overlay: { tileIds: [5], when: "ridge" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: both tools report a group-not-found failure.
        expect(junction.ok).toBe(false);
        expect(junction.issues?.[0]?.code).toBe("group-not-found");
        expect(overlay.ok).toBe(false);
        expect(overlay.issues?.[0]?.code).toBe("group-not-found");
      });

      it("upsert_tile_group stores junctions and overlays when provided", () => {
        // Given: a blank project with the default tileset.
        const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createBlankProject()) };

        // When: a group is upserted with structural rules.
        const result = runTool(ctx, "upsert_tile_group", {
          junctions: [{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }],
          name: "처마 지붕",
          overlays: [{ tileIds: [8], when: "eaveEnd" }],
          role: "roof",
          tileIds: [1, 2, 3],
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: both optional arrays are persisted on the group.
        expect(result.ok, result.summary).toBe(true);
        const groupId = (result.data as { readonly groupId: string }).groupId;
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === groupId);
        expect(group?.junctions).toEqual([{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }]);
        expect(group?.overlays).toEqual([{ tileIds: [8], when: "eaveEnd" }]);
      });

      it("catalog registry includes the structure rule tools", () => {
        // Given: the tool registry is the catalog source.
        const names = allTools().map((tool) => tool.name);

        // Then: both new tools are registered for catalog generation.
        expect(names).toEqual(expect.arrayContaining(["set_group_junction", "set_group_overlay"]));
      });
    });
  });
});

describe("skyIsland", () => {
  isolateTimers();
  // sky_island 조수 연결(skyIslandPolicy) + 순수 구성기(skyIslandComposer) — 이 파일은 작성 시 실행하지 않았다(not run).
  describe("skyIslandPolicy", () => {
    isolateTimers();
    const START = "map_blank_start";
    const create = declaredIntent({ mode: "create", space: "outdoor" });
    describe("낱말", () => {
      it.each(["하늘섬 마을 만들어줘", "구름 위 신전", "비공정 부두", "떠 있는 섬", "공중 정원", "floating island village", "airship dock"])("%s", (text) => {
        expect(describesSkyIsland(text)).toBe(true);
      });
      it.each(["먹구름 날씨 효과", "숲속 마을 만들어줘", "구름다리", "비구름이 끼는 날씨", "항구 도시"])("%s 는 아니다", (text) => {
        expect(describesSkyIsland(text)).toBe(false);
      });
      it("칩셋 이름", () => {
        expect(namesSkyIslandTileset("sky_island 로 맵")).toBe(true);
        expect(namesSkyIslandTileset("하늘섬 칩셋")).toBe(true);
        expect(namesSkyIslandTileset("하늘섬 마을")).toBe(false);
      });
    });
    describe("구성 종류", () => {
      it.each([
        ["하늘섬 마을 만들어줘", "village"], ["구름 위 신전", "shrine"], ["비공정 부두", "dock"], ["섬 네 개를 다리로 이어줘", "archipelago"],
        ["비공정 선실 만들어줘", "room-cabin"], ["천문대 내부", "room-observatory"], ["하늘섬 신전 실내", "room-shrine"], ["오두막 방 만들어줘", "room-cottage"],
      ] as const)("%s → %s", (text, style) => {
        expect(skyIslandStyleFor(text, false)).toBe(style);
      });
    });
    describe("skyIslandTargetFor — 칩셋이 프로젝트에 있을 때만", () => {
      it("새 프로젝트는 번들 칩셋을 갖고 태어난다", () => {
        expect(hasSkyIslandTileset(createBlankProject())).toBe(true);
      });
      it("칩셋이 없으면 null", () => {
        const blank = createBlankProject();
        delete (blank.tilesets as Record<string, unknown>)[SKY_ISLAND_TILESET_ID];
        expect(skyIslandTargetFor(blank, create, "하늘섬 마을 만들어줘", START, false)).toBeNull();
        expect(skyIslandPromptLines(blank, [START])).toEqual([]);
      });
      it("생성 요청은 새 맵 + 문장의 구성 종류", () => {
        const project = createBlankProject();
        expect(skyIslandTargetFor(project, create, "하늘섬 마을 만들어줘", START, false)).toEqual({ style: "village" });
        expect(skyIslandTargetFor(project, create, "구름 위 신전", START, false)).toEqual({ style: "shrine" });
        expect(skyIslandTargetFor(project, create, "비공정 부두", START, false)).toEqual({ style: "dock" });
        expect(skyIslandTargetFor(project, create, "숲속 마을 만들어줘", START, false)).toBeNull();
        expect(skyIslandTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "하늘섬이 뭐야", START, false)).toBeNull();
      });
      it("노트는 도구 이름과 style 을 싣는다", () => {
        const note = formatSkyIslandNote({ style: "dock" }, null);
        expect(note).toContain("compose_sky_island_map");
        expect(note).toContain('style "dock"');
        expect(note).toContain("ask_tileset_change");
      });
      it("컨셉 카드 무대 낱말 → sky_island, 지을 수 있는 타일셋", () => {
        expect(SKY_ISLAND_CONCEPT_HINT["하늘섬·비공정"]).toBe(SKY_ISLAND_TILESET_ID);
        expect(BUILDABLE_CONCEPT_TILESETS).toContain(SKY_ISLAND_TILESET_ID);
      });
    });
    describe("구성기 — 씨앗·크기를 바꿔도 시작 칸에서 모든 목표에 닿는다", () => {
      const pal = skyPaletteFromTileset(data as never);
      const styles = Object.keys(SKY_MIN_SIZE) as SkyComposeStyle[];
      it.each(styles)("%s", (style) => {
        const min = SKY_MIN_SIZE[style];
        for (const seed of [1, 2, 3, 7, 11]) {
          for (const grow of [0, 4]) {
            const r = composeSkyIsland({ width: min.w + grow, height: min.h + grow, style, seed }, pal);
            expect(r.lower.length).toBe((min.w + grow) * (min.h + grow));
            expect(r.notes.filter((n) => n.includes("닿지 않는 목표"))).toEqual([]);
            if (!style.startsWith("room-")) expect(r.buildings.length).toBeGreaterThan(0);
            else expect(r.exits.length).toBe(1);
          }
        }
      });
      it("너무 작은 맵은 거절한다(맵을 바꾸지 않게 던진다)", () => {
        expect(() => composeSkyIsland({ width: 20, height: 12, style: "village", seed: 1 }, pal)).toThrow();
      });
    });
    describe("참고문서 — 번들 소유 si- · 그림은 경로만", () => {
      it("용도 둘, 모든 id 가 si-, 그림 바이트 없음", () => {
        const cats = references as { id: string; documents: { id: string }[]; images: { id: string; dataUrl: string }[] }[];
        expect(cats.map((c) => c.id)).toEqual(["si-outdoor", "si-interior"]);
        for (const c of cats) {
          for (const d of c.documents) expect(d.id.startsWith("si-")).toBe(true);
          for (const i of c.images) { expect(i.id.startsWith("si-")).toBe(true); expect(i.dataUrl.startsWith("/assets/sky-island-references/")).toBe(true); }
        }
      });
      it("새 프로젝트의 sky_island 정의가 참고문서를 들고 태어난다", () => {
        const def = createBlankProject().tilesets[SKY_ISLAND_TILESET_ID]!;
        expect((def.referenceDocuments ?? []).map((c) => c.id)).toEqual(["si-outdoor", "si-interior"]);
      });
    });
  });
  // sky_island 이야기 기물 1종(si-seal-altar, 시트 691~694): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘·★)과 같은지,
  // 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
  // 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
  // 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/sky-island/bake_si.py, 목록 tiledata/sky-island/objects/spec.json).
  describe("skyIslandStoryObjects", () => {
    isolateTimers();
    type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
    const ITEMS = spec.items as Item[];
    const kitId = (id: string) => `si-${id}`;
    const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
    const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
    const FIRST = 691;   // 이 묶음이 덧붙기 전 시트 끝

    describe("sky_island 이야기 기물", () => {
      it("새 사본은 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸)", () => {
        const ts = createSkyIslandTileset();
        const kits = own(ts.structureKits);
        expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
        let next = FIRST;
        for (const item of ITEMS) {
          const kit = kits.find((k) => k.id === kitId(item.id))!;
          expect([kit.width, kit.height]).toEqual([item.w, item.h]);
          expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
          expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
          kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
            expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 691 부터
            const blocked = item.block.some(([bx, by]) => bx === x && by === y);
            expect(ts.passability[tile]!.up).toBe(!blocked);
            expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
          }));
        }
        expect(next).toBe(ts.count);
        expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "si-objects"))).toBe(true);
      });

      it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
        const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
        const sheet = read("public/assets/sky-island/sky-island-chipset.png");
        const ts = createSkyIslandTileset();
        for (const item of ITEMS) {
          const piece = read(`tiledata/sky-island/objects/pieces/${item.src}`);
          expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
          const kit = own(ts.structureKits).find((k) => k.id === kitId(item.id))!;
          kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
            const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
            for (let y = 0; y < 16; y += 1) {
              const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
              expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
            }
          }));
        }
      });

      it("게임이 바란 낱말이 그 킷을 짚는다 — «제단» 은 같은 태그의 실내 신전 제단(si-altar) 다음", () => {
        const project = createBlankProject() as Project;
        const ts = project.tilesets[SKY_ISLAND_ID]!;
        for (const [id, words] of Object.entries(ask.items)) for (const word of words) {
          const found = existingMatches(project, ts, word).map((row) => row.id);
          if (word === "제단") expect(found.slice(0, 2)).toEqual(["si-altar", kitId(id)]);
          else expect([word, found[0]]).toEqual([word, kitId(id)]);
        }
      });

      it("실제 놓기 도구로 놓으면 아랫줄만 막힌다", () => {
        const ctx = { project: createBlankProject() as Project, currentMapId: "isle", assistantRun: true };
        expect(runTool(ctx, "create_map", { id: "isle", name: "섬 마당", width: 20, height: 15, tilesetId: SKY_ISLAND_ID }).ok).toBe(true);
        expect(runTool(ctx, "stamp_tileset_object", { mapId: "isle", objectId: kitId("seal-altar"), base: { x: 3, y: 6 } }).ok).toBe(true);
        const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.isle!, x, y);
        // 봉인 제단 2×2: 아랫줄(앞면) 두 칸 막힘, 윗줄(윗판)은 사람 위에 그려지는 걸음 칸
        expect([walk(3, 6), walk(4, 6)]).toEqual([false, false]);
        expect([walk(3, 5), walk(4, 5), walk(3, 7), walk(2, 6), walk(5, 6)]).toEqual([true, true, true, true, true]);
      });
    });
  });
});

describe("starterHouseTransfer", () => {
  isolateTimers();
  // 통행성 함정 회귀 — "들어갈 수는 있는데 나올 수 없는/아무 데도 못 가는" 결함을 막는다.
  //
  // 배경(2026-07-27 조사): 타일 통행 모델 자체는 정상이다. `canMove` 는 RM2K3 정석대로
  // 출발 칸의 나가는 비트 AND 도착 칸의 들어오는 비트를 보고, 두 항이 같아서 **대칭**이다
  //   canMove(A→B) = dirPassable(A,dir) && dirPassable(B,opp)
  //   canMove(B→A) = dirPassable(B,opp) && dirPassable(A,dir)
  // 즉 **걸어서** 들어간 칸에서는 원리상 못 나올 수 없다.
  //
  // 문제는 두 곳이었다.
  //  ① 맵 이동(transfer)이 이 판정을 우회하고 `isPassable`(스스로 "레거시 호환 — EditScene
  //     표시용"이라 적힌 4방향 OR)로 착지 칸을 정했다. 한 방향만 열린 타일에 내려놓으면 갇힌다.
  //  ② `TILE.FLOOR`(342)가 이름과 달리 combined_town 에서 전방향 통행 불가인데,
  //     starterHouseTransfer 가 실내 300칸을 그걸로 채웠다 — 밟을 수 있는 칸이 2칸뿐이었다.
  describe("passabilityTraps", () => {
    isolateTimers();
    // 시작 집 내부·함정 맵은 합본 마을 칩셋(TILE.* 번호) 위에 있다 — 2026-10-07 정리로 새 프로젝트에서 빠진 그 정의를 되살린다.
    const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
    const project = { tilesets: { [COMBINED_TOWN_TILESET_ID]: tileset } } as unknown as Project;
    function reachableFrom(map: GameMap, sx: number, sy: number): Set<number> {
      const key = (x: number, y: number): number => y * map.width + x;
      const seen = new Set<number>([key(sx, sy)]);
      const queue: [number, number][] = [[sx, sy]];
      while (queue.length > 0) {
        const [x, y] = queue.shift()!;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          if (seen.has(key(nx, ny))) continue;
          if (!canMove(project, map, x, y, nx, ny)) continue;
          seen.add(key(nx, ny));
          queue.push([nx, ny]);
        }
      }
      return seen;
    }
    describe("TILE.FLOOR / TILE.STAIRS 는 바닥이 아니다", () => {
      it("두 상수는 기본 칩셋에서 전방향 통행 불가다 — 이름에 속지 않게 못 박는다", () => {
        for (const id of [342, 246]) {
          const flag = tileset.passability[id]!;
          expect(
            [flag.up, flag.down, flag.left, flag.right],
            `타일 ${id} 가 통행 가능해졌다면 constants.ts 의 경고 주석도 함께 고쳐야 한다`
          ).toEqual([false, false, false, false]);
        }
      });

      it("나무 마루(222)는 실내 바닥으로 쓸 수 있다", () => {
        const flag = tileset.passability[222]!;
        expect([flag.up, flag.down, flag.left, flag.right]).toEqual([true, true, true, true]);
      });
    });
    describe("시작 집 내부는 실제로 돌아다닐 수 있다", () => {
      const interior = createStarterHouseInteriorMap("map_return");

      it("실내 대부분이 입구에서 걸어서 닿는다", () => {
        const seen = reachableFrom(interior, STARTER_HOUSE_INTERIOR_ENTRY.x, STARTER_HOUSE_INTERIOR_ENTRY.y);
        // 20×15 에서 테두리 벽을 뺀 내부는 18×13 = 234칸. 예전엔 2칸이었다.
        expect(seen.size, `입구에서 닿는 칸이 ${seen.size}개뿐 — 바닥이 통행 불가 타일인지 확인하라`).toBeGreaterThan(200);
      });

      it("실내에 배치된 슬라임에게 실제로 갈 수 있다", () => {
        const seen = reachableFrom(interior, STARTER_HOUSE_INTERIOR_ENTRY.x, STARTER_HOUSE_INTERIOR_ENTRY.y);
        const key = (x: number, y: number): number => y * interior.width + x;
        expect(
          seen.has(key(STARTER_HOUSE_SLIME_POS.x, STARTER_HOUSE_SLIME_POS.y)),
          "실내 슬라임이 도달 불가 — 배치했지만 만날 수 없는 죽은 콘텐츠다"
        ).toBe(true);
      });
    });
    describe("transfer 착지는 나갈 수 있는 칸을 고른다", () => {
      /** 한 방향만 열린 타일(나무 데크 북측 가장자리 230)로 둘러싸인 함정 맵. */
      function trapMap(): GameMap {
        const width = 7;
        const height = 7;
        const lowerTiles = new Array<number>(width * height).fill(306); // 전부 벽
        // (3,3) 은 230 — up 만 닫힌 타일. 위쪽 이웃을 벽으로 두면 네 방향 모두 나갈 수 없다.
        lowerTiles[3 * width + 3] = 230;
        // (5,5) 는 정상 잔디 + 옆에 나갈 곳이 있다.
        lowerTiles[5 * width + 5] = 240;
        lowerTiles[5 * width + 4] = 240;
        return {
          id: "map_trap",
          name: "함정",
          width,
          height,
          tilesetId: COMBINED_TOWN_TILESET_ID,
          tileSize: 16,
          lowerTiles,
          upperTiles: new Array<number>(width * height).fill(-1),
          events: [],
        } as GameMap;
      }

      it("한 방향만 열린 칸은 isPassable 은 통과시키지만 실제로는 갇힌다", () => {
        const map = trapMap();
        // 레거시 판정은 이 칸을 "통행 가능"이라고 한다 — 이게 예전 착지 기준이었다.
        expect(isPassable(project, map, 3, 3)).toBe(true);
        // 그런데 어느 방향으로도 못 나간다.
        const canLeave =
          canMove(project, map, 3, 3, 4, 3) ||
          canMove(project, map, 3, 3, 2, 3) ||
          canMove(project, map, 3, 3, 3, 4) ||
          canMove(project, map, 3, 3, 3, 2);
        expect(canLeave, "이 칸이 나갈 수 있게 됐다면 이 테스트의 함정 구성을 다시 짜라").toBe(false);
      });

      it("착지 계산이 그 함정 칸을 피해 나갈 수 있는 칸으로 보낸다", () => {
        const map = trapMap();
        const landing = nearestPassableTile(project, map, 3, 3);
        expect(
          landing,
          "transfer 가 갇히는 칸에 플레이어를 내려놓았다 — nearestPassableTile 이 canMove 를 안 본다"
        ).not.toEqual({ x: 3, y: 3 });
        const canLeave =
          canMove(project, map, landing.x, landing.y, landing.x + 1, landing.y) ||
          canMove(project, map, landing.x, landing.y, landing.x - 1, landing.y) ||
          canMove(project, map, landing.x, landing.y, landing.x, landing.y + 1) ||
          canMove(project, map, landing.x, landing.y, landing.x, landing.y - 1);
        expect(canLeave, `착지 칸 (${landing.x},${landing.y})에서 나갈 수 없다`).toBe(true);
      });
    });
  });
  describe("starterDoorTransfer", () => {
    isolateTimers();
    describe("starter door transfer defaults", () => {
      it("builds a starter house door and matching interior transfer", () => {
        // Given: a starter village and its paired interior map are built from the transfer helpers.
        const starter = createStarterMap();
        addStarterHouseDoor(starter);
        const interior = createStarterHouseInteriorMap(starter.id);

        // When: the generated transfer events are inspected.
        const door = starter.events.find((event) => event.id === "event_starter_house_door");
        const doorPage = door?.pages?.[0];
        const transfer = doorPage?.commands.find((command) => command.kind === "transfer");
        const exit = interior.events.find((event) => event.id === "event_starter_house_exit");
        const exitPage = exit?.pages?.[0];
        const exitTransfer = exitPage?.commands.find((command) => command.kind === "transfer");
        const slime = interior.events.find((event) => event.id === STARTER_HOUSE_SLIME_EVENT_ID);
        const slimePage = slime?.pages?.[0];
        const slimeBattle = slimePage?.commands.find((command) => command.kind === "battleProcessing");

        // Then: player-touch transfers connect the exterior door and interior exit.
        expect(interior.name).toBe("시작 집 내부");
        expect(interior.width).toBeGreaterThanOrEqual(20);
        expect(interior.height).toBeGreaterThanOrEqual(15);
        expect(door).toMatchObject({
          x: 7,
          y: 10,
          trigger: { kind: "playerTouch" },
        });
        expect(doorPage).toMatchObject({
          id: "event_starter_house_door_page",
          priority: "below",
          trigger: { kind: "playerTouch" },
        });
        expect(transfer).toEqual({ kind: "transfer", mapId: "map_starter_house_interior", x: 4, y: 6, fade: "black" });
        expect(exit).toMatchObject({
          x: 4,
          y: 7,
          trigger: { kind: "playerTouch" },
        });
        expect(exitTransfer).toEqual({ kind: "transfer", mapId: starter.id, x: 7, y: 11, fade: "black" });
        // And: an indoor yard slime is ready for quick battle tests.
        expect(slime).toMatchObject({
          x: STARTER_HOUSE_SLIME_POS.x,
          y: STARTER_HOUSE_SLIME_POS.y,
          trigger: { kind: "eventTouch" },
        });
        expect(slimePage?.graphic?.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_monster1" });
        expect(slimeBattle).toEqual({
          kind: "battleProcessing",
          troopId: DEFAULT_TROOP_ID,
          canEscape: true,
          canLose: true,
        });
      });
    });
  });
});
