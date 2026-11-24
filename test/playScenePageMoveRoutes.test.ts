import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "@/assets/bundled";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { minimapEventMarkerRect } from "@/player/minimap";
import { applyCameraControl } from "@/player/playSceneCamera";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { syncFollowerSprites } from "@/player/playSceneFollowers";
import { registerPageMoveRoutes, npcMoveDurationMs, npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { addFollowerToSession, charsetFollowerGraphic } from "@/project/followers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { CharacterFootprint, EventPage, GameEvent, MoveCommand, GameMap, NpcScheduleEntry, Project } from "@/project/types";
import { mockSprite, movementScene, type MockSprite, event, pageWith } from "./runtimeEventPageFixtures";
import { DEFAULT_FALL_DURATION_MS, DEFAULT_FALL_HEIGHT_PX, DEFAULT_JUMP_DURATION_MS, DEFAULT_JUMP_PEAK_PX, fallLiftPx } from "@/player/characterHop";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { isolateTimers } from "./mergedTeardown";

// 스프라이트를 다시 놓는 경로가 **몸 중앙**을 유지하는지 — 2차 스펙 §7.
//
// 1차는 `footprintSpriteX` 를 최초 렌더(renderEvents) 한 곳에만 걸었다. 그래서 폭 2 이상
// 이벤트가 걷기 시작하면 타일 중앙으로 되돌아가며 반 칸 튀었다.
//
// 판별력 규칙: **짝수 폭**으로 프로브한다. 홀수 폭은 `footprintSpriteX === characterSpriteX`
// 라서 타일 중앙으로 되돌리는 버그를 통과시킨다 — 아무것도 증명하지 않는다.
describe("renderFootprintCenter", () => {
  isolateTimers();
  /** 오른쪽으로 한 걸음 걷는 자율 이동 NPC. 발자국만 바꿔 가며 두 번 돌린다. */
  function walkingScene(footprint?: CharacterFootprint): {
    readonly runtimeScene: Parameters<typeof updateAutonomousNPCs>[0];
    readonly sprite: MockSprite;
    readonly intervalMs: number;
    readonly durationMs: number;
  } {
    const scene = movementScene({
      footprint,
      movement: {
        type: "custom",
        speed: 3,
        frequency: 3,
        route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
      },
    });
    registerPageMoveRoutes(scene);
    const sprite = mockSprite();
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      // 플레이어는 멀리 둔다 — 접촉이 걸리면 걸음이 시작되지 않아 프로브가 무의미해진다.
      tileX: 15,
      tileY: 15,
      eventSprites: new Map([["npc", sprite]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
      showRuntimeOverlay: () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");
    return { runtimeScene, sprite, intervalMs: mover.moveIntervalMs, durationMs: mover.moveDurationMs };
  }
  describe("자율 이동 — 걸음 보간이 몸 중앙을 유지한다", () => {
    it("폭 2 는 걸음 시작·중간·끝 모두 발자국 중앙이다", () => {
      const body = { width: 2, height: 1 } as const;
      const { runtimeScene, sprite, intervalMs, durationMs } = walkingScene(body);

      // 걸음 시작: 출발 칸(1,1) 의 몸 중앙 = (1+1)*16 = 32. 타일 중앙이라면 24 였다.
      updateAutonomousNPCs(runtimeScene, intervalMs);
      expect(sprite.x).toBe(footprintSpriteX(1, body));
      expect(sprite.x).toBe(2 * TILE_SIZE);
      expect(sprite.x).not.toBe(characterSpriteX(1));

      // 절반 보간: x = 1.5 → (1.5+1)*16 = 40.
      updateAutonomousNPCs(runtimeScene, durationMs / 2);
      expect(sprite.x).toBe(footprintSpriteX(1.5, body));
      expect(sprite.x).toBe(40);

      // 도착: x = 2 → (2+1)*16 = 48.
      updateAutonomousNPCs(runtimeScene, durationMs);
      expect(sprite.x).toBe(footprintSpriteX(2, body));
      expect(sprite.x).toBe(3 * TILE_SIZE);
      expect(sprite.y).toBe(characterSpriteY(1));
    });

    it("발자국 없는 NPC 는 타일 중앙 그대로다(항등)", () => {
      const { runtimeScene, sprite, intervalMs, durationMs } = walkingScene();

      updateAutonomousNPCs(runtimeScene, intervalMs);
      expect(sprite.x).toBe(characterSpriteX(1));

      updateAutonomousNPCs(runtimeScene, durationMs / 2);
      expect(sprite.x).toBe(characterSpriteX(1.5));

      updateAutonomousNPCs(runtimeScene, durationMs);
      expect(sprite.x).toBe(characterSpriteX(2));
    });
  });
  class CameraStub {
    panCalls: { readonly x: number; readonly y: number }[] = [];
    setZoom(): void {}
    setBounds(): void {}
    centerOn(): void {}
    startFollow(): void {}
    stopFollow(): void {}
    once(eventName: string, listener: () => void): void {
      if (eventName === "camerapancomplete") this.pending = listener;
    }
    pan(x: number, y: number): void {
      this.panCalls.push({ x, y });
      this.pending?.();
    }
    private pending: (() => void) | undefined;
  }
  function cameraSceneWithEvent(footprint?: CharacterFootprint): {
    readonly scene: PlaySceneContext;
    readonly camera: CameraStub;
  } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const page: EventPage = {
      id: "p1",
      name: "골렘",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
      ...(footprint ? { footprint } : {}),
    };
    const event: GameEvent = { id: "golem", x: 5, y: 7, trigger: { kind: "action" }, commands: [], pages: [page] };
    map.events = [event];
    store.replace(project);
    const camera = new CameraStub();
    const scene = {
      cameras: { main: camera },
      player: { x: 160, y: 120 },
      // 스프라이트를 일부러 비운다 — 뷰 폴백 경로가 이 테스트의 대상이다.
      eventSprites: new Map(),
      session: startSession(store.getCurrent()),
      map: store.getCurrent().maps[project.startMapId]!,
      eventPositions: initialRuntimeEventPositions(map.events),
      syncRuntimeState: () => undefined,
    } as unknown as PlaySceneContext;
    return { scene, camera };
  }
  describe("카메라 — 스프라이트 없는 이벤트도 몸 중앙을 겨눈다", () => {
    it("폭 4 몸은 앵커가 아니라 몸 중앙으로 팬한다", async () => {
      const body = { width: 4, height: 2 } as const;
      const { scene, camera } = cameraSceneWithEvent(body);

      await applyCameraControl(scene, {
        mode: "pan",
        target: { kind: "event", eventId: "golem" },
        durationMs: 120,
        wait: true,
        returnToPlayer: false,
      });

      // 앵커 5 · 폭 4 → left 4, 중심 6 칸 경계 = 96. 타일 중앙이라면 88 이었다.
      expect(camera.panCalls[0]?.x).toBe(footprintSpriteX(5, body));
      expect(camera.panCalls[0]?.x).toBe(6 * TILE_SIZE);
      expect(camera.panCalls[0]?.x).not.toBe(characterSpriteX(5));
      expect(camera.panCalls[0]?.y).toBe(characterSpriteY(7));
    });

    it("발자국 없는 이벤트는 타일 중앙 그대로다(항등)", async () => {
      const { scene, camera } = cameraSceneWithEvent();

      await applyCameraControl(scene, {
        mode: "pan",
        target: { kind: "event", eventId: "golem" },
        durationMs: 120,
        wait: true,
        returnToPlayer: false,
      });

      expect(camera.panCalls[0]?.x).toBe(characterSpriteX(5));
    });
  });
  describe("미니맵 — 표식이 몸 사각을 덮는다", () => {
    function event(footprint?: CharacterFootprint): GameEvent {
      return {
        id: "e",
        x: 5,
        y: 7,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
            ...(footprint ? { footprint } : {}),
          },
        ],
      };
    }

    it("3x3 은 3칸 크기 표식이 되고 좌상단이 몸 사각 좌상단이다", () => {
      // inset = floor(16*0.2) = 3. 몸 사각 좌상단 (4,5) → 64,80.
      expect(minimapEventMarkerRect(event({ width: 3, height: 3 }), TILE_SIZE)).toEqual({
        x: 67,
        y: 83,
        w: 48 - 6,
        h: 48 - 6,
      });
    });

    it("발자국 없는 이벤트는 한 칸 표식 그대로다(항등)", () => {
      expect(minimapEventMarkerRect(event(), TILE_SIZE)).toEqual({ x: 83, y: 115, w: 10, h: 10 });
    });

    it("작은 타일에서도 inset 은 최소 1 이다 — 표식이 사라지면 안 된다", () => {
      const rect = minimapEventMarkerRect(event(), 4);
      expect(rect).toEqual({ x: 21, y: 29, w: 2, h: 2 });
    });
  });
  describe("동료 — 배율을 따라간다", () => {
    function followerScene(scale?: number): {
      readonly scene: PlaySceneContext;
      readonly sprites: Map<string, MockSprite>;
    } {
      const project = createBlankProject();
      store.replace(project);
      const session = startSession(store.getCurrent());
      const graphic = charsetFollowerGraphic("tex_easyrpg_charset_animal", 0);
      addFollowerToSession(store.getCurrent(), session, {
        name: "야옹이",
        graphic: scale === undefined ? graphic : { ...graphic, scale },
      });
      const sprites = new Map<string, MockSprite>();
      const scene = {
        session,
        map: store.getCurrent().maps[session.currentMapId]!,
        followerSprites: sprites,
        add: { sprite: (x: number, y: number, texture: string) => mockSprite(x, y, texture) },
      } as unknown as PlaySceneContext;
      return { scene, sprites };
    }

    it("배율을 지정한 동료는 그 배율로 그려진다", () => {
      const scales: number[] = [];
      const { scene, sprites } = followerScene(3);
      syncFollowerSprites(scene);
      for (const sprite of sprites.values()) {
        Object.assign(sprite, { setScale: (value: number) => scales.push(value) });
      }
      // 두 번째 동기화에서 기존 스프라이트 경로(setPosition 분기)를 태운다.
      syncFollowerSprites(scene);
      expect(scales).toEqual([3]);
    });

    it("배율 없는 동료는 1 이다(항등)", () => {
      const scales: number[] = [];
      const { scene, sprites } = followerScene();
      syncFollowerSprites(scene);
      for (const sprite of sprites.values()) {
        Object.assign(sprite, { setScale: (value: number) => scales.push(value) });
      }
      syncFollowerSprites(scene);
      expect(scales).toEqual([1]);
    });
  });
});

// 애니메이션 유형의 방향 고정 계열은 자율 이동에서도 방향을 바꾸지 않아야 한다.
// 조사 시 회전 경로는 canActionTurn(playSceneMovement.ts)으로 이미 이 규칙을 지키는데,
// 자율 이동 경로는 mover.directionFix(이동 루트 명령 전용)만 봐서 규칙이 갈라져 있었다.
describe("runtimeAnimationTypeDirectionFix", () => {
  isolateTimers();
  describe("이동 속도·빈도가 런타임 타이밍에 전달된다", () => {
    it("속도 1 과 8 은 서로 다른 이동 지속시간으로 무버에 전달된다", () => {
      const slow = movementScene({ movement: { type: "random", speed: 1, frequency: 1 } });
      const fast = movementScene({ movement: { type: "random", speed: 8, frequency: 8 } });
      registerPageMoveRoutes(slow);
      registerPageMoveRoutes(fast);

      const slowMover = slow.autonomousNPCs.get("npc");
      const fastMover = fast.autonomousNPCs.get("npc");
      expect(slowMover?.moveDurationMs).toBe(npcMoveDurationMs(1));
      expect(fastMover?.moveDurationMs).toBe(npcMoveDurationMs(8));
      expect(slowMover!.moveDurationMs).toBeGreaterThan(fastMover!.moveDurationMs);
      expect(slowMover?.moveIntervalMs).toBe(npcMoveIntervalMs(1));
      expect(fastMover?.moveIntervalMs).toBe(npcMoveIntervalMs(8));
      expect(slowMover!.moveIntervalMs).toBeGreaterThan(fastMover!.moveIntervalMs);
      expect(slowMover?.speedRank).toBe(1);
      expect(fastMover?.speedRank).toBe(8);
    });
  });
  describe("애니메이션 유형과 자율 이동 방향 고정", () => {
    it("fixedDirection 페이지는 자율 이동 중에도 페이지 방향을 유지한다", () => {
      const scene = movementScene({
        animationType: "fixedDirection",
        graphic: { direction: "up" },
        movement: { type: "random", speed: 4, frequency: 8 },
      });
      registerPageMoveRoutes(scene);
      expect(scene.autonomousNPCs.get("npc")?.directionFix).toBe(true);

      const runtimeScene = {
        ...scene,
        tileX: 9,
        tileY: 9,
        eventSprites: new Map(),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      } as Parameters<typeof updateAutonomousNPCs>[0];
      for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, 16);

      expect(scene.autonomousNPCs.get("npc")?.facing).toBe("up");
    });

    it("normal 페이지는 자율 이동 방향을 따라 돈다", () => {
      const scene = movementScene({
        animationType: "normal",
        graphic: { direction: "up" },
        movement: { type: "custom", speed: 4, frequency: 8, route: { moves: [{ kind: "move", dir: "right" }], repeat: true } },
      });
      registerPageMoveRoutes(scene);
      expect(scene.autonomousNPCs.get("npc")?.directionFix).toBe(false);

      const runtimeScene = {
        ...scene,
        tileX: 9,
        tileY: 9,
        eventSprites: new Map(),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      } as Parameters<typeof updateAutonomousNPCs>[0];
      for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, 16);

      expect(scene.autonomousNPCs.get("npc")?.facing).toBe("right");
    });
  });
});

describe("runtimeCharacterHop", () => {
  isolateTimers();
  function hopScene(moves: MoveCommand[]): {
    readonly runtimeScene: Parameters<typeof updateAutonomousNPCs>[0];
    readonly scene: ReturnType<typeof movementScene>;
    readonly sprite: MockSprite;
  } {
    const scene = movementScene({
      movement: { type: "custom", speed: 3, frequency: 3, route: { moves, repeat: false } },
    });
    registerPageMoveRoutes(scene);
    const sprite = mockSprite();
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map([["npc", sprite]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    return { runtimeScene, scene, sprite };
  }
  /** 원점 Y 에 실린 리프트를 월드 px 로 되읽는다(목 스프라이트는 높이를 안 주므로 32 기준). */
  function liftPx(sprite: MockSprite): number {
    const originY = sprite.origin?.[1] ?? 1;
    return (originY - 1) * 32;
  }
  function startRoute(runtimeScene: Parameters<typeof updateAutonomousNPCs>[0], scene: ReturnType<typeof movementScene>): void {
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");
    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);
  }
  describe("NPC 점프 아크", () => {
    it("점프는 접지 좌표·depth 를 고정한 채 원점만 띄운다", () => {
      const { runtimeScene, scene, sprite } = hopScene([{ kind: "jump", dx: 2, dy: 0 }]);
      startRoute(runtimeScene, scene);

      // 시작 프레임: 아크 양 끝이 0 이라 아직 접지다.
      expect(liftPx(sprite)).toBe(0);
      const groundY = sprite.y;
      const depth = sprite.depth;

      updateAutonomousNPCs(runtimeScene, DEFAULT_JUMP_DURATION_MS / 2);
      expect(liftPx(sprite)).toBeCloseTo(DEFAULT_JUMP_PEAK_PX, 6);
      // 핵심 계약: 리프트는 y 나 depth 를 건드리지 않는다(한 줄 위 캐릭터 뒤로 숨지 않는다).
      expect(sprite.y).toBe(groundY);
      expect(sprite.depth).toBe(depth);

      updateAutonomousNPCs(runtimeScene, DEFAULT_JUMP_DURATION_MS / 2);
      expect(liftPx(sprite)).toBe(0);
      expect(sprite.origin).toEqual([0.5, 1]);
      // 두 칸 건너뛴 자리에 정확히 접지한다.
      expect(scene.eventPositions.npc).toMatchObject({ x: 3, y: 1 });
      expect(sprite.x).toBe(3 * 16 + 8);
      expect(sprite.y).toBe(2 * 16);
    });

    it("점프는 이동 속도가 아니라 저작 지속 시간으로 난다", () => {
      const { runtimeScene, scene, sprite } = hopScene([
        { kind: "jump", dx: 0, dy: 1, heightPx: 40, durationMs: 1_000 },
      ]);
      startRoute(runtimeScene, scene);
      const mover = scene.autonomousNPCs.get("npc");
      if (!mover) throw new Error("missing autonomous mover");
      // 이동 속도만큼 흘려도(기본 320ms 대) 1초 점프는 끝나지 않는다.
      updateAutonomousNPCs(runtimeScene, mover.moveDurationMs);
      expect(mover.activeMove).not.toBeNull();
      updateAutonomousNPCs(runtimeScene, 500 - mover.moveDurationMs);
      expect(liftPx(sprite)).toBeCloseTo(40, 6);
      updateAutonomousNPCs(runtimeScene, 500);
      expect(mover.activeMove).toBeNull();
      expect(liftPx(sprite)).toBe(0);
    });
  });
  describe("NPC 낙하 등장(dropIn)", () => {
    it("타일 이동 없이 화면 위에서 접지까지 떨어진다", () => {
      const { runtimeScene, scene, sprite } = hopScene([{ kind: "dropIn" }]);
      startRoute(runtimeScene, scene);

      // 첫 프레임부터 8칸 위에 있다 — 화면 밖에서 등장한다.
      expect(liftPx(sprite)).toBe(DEFAULT_FALL_HEIGHT_PX);
      expect(scene.eventPositions.npc).toMatchObject({ x: 1, y: 1 });

      updateAutonomousNPCs(runtimeScene, DEFAULT_FALL_DURATION_MS / 2);
      const midLift = liftPx(sprite);
      expect(midLift).toBeLessThan(DEFAULT_FALL_HEIGHT_PX);
      expect(midLift).toBeGreaterThan(0);
      // 곡선 자체는 characterHop.test.ts 가 잠근다 — 여기서는 런타임이 그 곡선을 쓰는지만 본다.
      expect(midLift).toBe(Math.round(fallLiftPx(0.5, DEFAULT_FALL_HEIGHT_PX)));

      updateAutonomousNPCs(runtimeScene, DEFAULT_FALL_DURATION_MS / 2);
      expect(liftPx(sprite)).toBe(0);
      expect(sprite.origin).toEqual([0.5, 1]);
      // 제자리 낙하라 타일은 그대로다.
      expect(scene.eventPositions.npc).toMatchObject({ x: 1, y: 1 });
      expect(sprite.x).toBe(1 * 16 + 8);
      expect(sprite.y).toBe(2 * 16);
    });

    it("저작 높이·지속 시간을 그대로 쓴다", () => {
      const { runtimeScene, scene, sprite } = hopScene([
        { kind: "dropIn", heightPx: 64, durationMs: 200 },
      ]);
      startRoute(runtimeScene, scene);
      expect(liftPx(sprite)).toBe(64);
      updateAutonomousNPCs(runtimeScene, 200);
      expect(liftPx(sprite)).toBe(0);
      expect(scene.autonomousNPCs.get("npc")?.activeMove).toBeNull();
    });

    it("체공 중에는 걸음 프레임을 돌리지 않는다", () => {
      const { runtimeScene, scene, sprite } = hopScene([{ kind: "dropIn" }]);
      startRoute(runtimeScene, scene);
      const airborneFrame = sprite.frame;
      updateAutonomousNPCs(runtimeScene, DEFAULT_FALL_DURATION_MS / 3);
      expect(sprite.frame).toBe(airborneFrame);
      updateAutonomousNPCs(runtimeScene, DEFAULT_FALL_DURATION_MS / 3);
      expect(sprite.frame).toBe(airborneFrame);
    });
  });
});

describe("runtimeNpcMapTransfer", () => {
  isolateTimers();
  describe("runtime NPC map transfer route commands", () => {
    it("moves an NPC between maps as part of its autonomous route", () => {
      const scene = movementScene({
        movement: {
          type: "custom",
          speed: 8,
          frequency: 8,
          route: {
            moves: [
              { kind: "setThrough", enabled: true },
              { kind: "move", dir: "right" },
              { kind: "npcTransfer", mapId: "map_runtime_target", x: 3, y: 2, direction: "down" },
              { kind: "setThrough", enabled: false },
            ],
            repeat: false,
          },
        },
      });
      const targetMap = { ...scene.map, id: "map_runtime_target", name: "Target", events: [] };
      const project = store.getCurrent();
      project.maps[targetMap.id] = targetMap;
      registerPageMoveRoutes(scene);
      const sprite = mockSprite();
      const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
        ...scene,
        tileX: 9,
        tileY: 9,
        eventSprites: new Map([["npc", sprite]]),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      };
      const mover = scene.autonomousNPCs.get("npc");
      if (!mover) throw new Error("missing autonomous mover");

      for (let guard = 0; guard < 8 && scene.autonomousNPCs.get("npc")?.moves.length; guard += 1) {
        updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);
        if (mover.activeMove) updateAutonomousNPCs(runtimeScene, mover.moveDurationMs);
      }

      expect(scene.eventPositions.npc).toBeUndefined();
      expect(scene.session.eventLocations?.npc).toEqual({
        mapId: "map_runtime_target",
        x: 3,
        y: 2,
        direction: "down",
      });
      expect(scene.autonomousNPCs.has("npc")).toBe(false);
    });

    it("keeps NPC transfers safe for missing maps and blocked target tiles", () => {
      const missingMapScene = movementScene({
        movement: {
          type: "custom",
          speed: 8,
          frequency: 8,
          route: { moves: [{ kind: "npcTransfer", mapId: "missing_map", x: 4, y: 4 }], repeat: false },
        },
      });
      registerPageMoveRoutes(missingMapScene);
      const missingMapMover = missingMapScene.autonomousNPCs.get("npc");
      if (!missingMapMover) throw new Error("missing autonomous mover");
      updateAutonomousNPCs({
        ...missingMapScene,
        tileX: 9,
        tileY: 9,
        eventSprites: new Map([["npc", mockSprite()]]),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      }, missingMapMover.moveIntervalMs);

      expect(missingMapScene.eventPositions.npc).toEqual({ x: 1, y: 1 });
      expect(missingMapScene.session.eventLocations?.npc).toBeUndefined();

      const blockedTargetScene = movementScene({
        movement: {
          type: "custom",
          speed: 8,
          frequency: 8,
          route: { moves: [{ kind: "npcTransfer", mapId: "map_runtime_blocked_target", x: 3, y: 2 }], repeat: false },
        },
      });
      const project = store.getCurrent();
      const targetMap = { ...blockedTargetScene.map, id: "map_runtime_blocked_target", name: "Blocked Target", events: [] };
      targetMap.lowerTiles[2 * targetMap.width + 3] = 1;
      project.maps[targetMap.id] = targetMap;
      registerPageMoveRoutes(blockedTargetScene);
      const blockedTargetMover = blockedTargetScene.autonomousNPCs.get("npc");
      if (!blockedTargetMover) throw new Error("missing autonomous mover");
      updateAutonomousNPCs({
        ...blockedTargetScene,
        tileX: 9,
        tileY: 9,
        eventSprites: new Map([["npc", mockSprite()]]),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      }, blockedTargetMover.moveIntervalMs);

      expect(blockedTargetScene.session.eventLocations?.npc?.mapId).toBe("map_runtime_blocked_target");
      expect(blockedTargetScene.session.eventLocations?.npc).not.toMatchObject({ x: 3, y: 2 });
    });
  });
});

// 명령 "이동 루트 설정"이 끝난 뒤 페이지 이동(무작위/접근/추격/사용자 지정)이 되살아나야 한다.
// 명령 무버가 제거될 때 pageMoveRouteKeys/EventIds 는 남아 있으므로, 재등록 판정이 키만 보면
// "이미 등록됨" 분기로 들어가 무버 없이 continue 하고 NPC 가 맵 재로드까지 영구 정지한다.
describe("runtimePageMovementAfterCommandRoute", () => {
  isolateTimers();
  describe("명령 이동 루트 이후의 페이지 이동 복귀", () => {
    it("명령 루트가 끝난 NPC 는 페이지 이동 무버를 다시 얻는다", () => {
      const scene = movementScene({ movement: { type: "random", speed: 4, frequency: 8 } });
      registerPageMoveRoutes(scene);
      expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("random");

      const commandMoveRouteEventIds = new Set<string>(["npc"]);
      registerAutonomousMover(scene, "npc", [], false);
      const runtimeScene = {
        ...scene,
        commandMoveRouteEventIds,
        tileX: 9,
        tileY: 9,
        eventSprites: new Map(),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      } as Parameters<typeof updateAutonomousNPCs>[0];

      updateAutonomousNPCs(runtimeScene, 16);
      expect(scene.autonomousNPCs.has("npc")).toBe(false);
      expect(scene.pageMoveRouteEventIds.has("npc")).toBe(true);

      registerPageMoveRoutes(scene);

      expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("random");
    });
  });
});

// 일정을 가진 NPC 도 페이지 이동 유형(무작위/접근/추격/사용자 지정)을 쓸 수 있어야 한다.
// 일정은 "언제 어디에 있어야 하는가"만 소유한다. 일정 행이 있다는 사실만으로 이동 유형을
// 통째로 버리면, 시간 시스템이 켜진 프로젝트의 주민은 무작위를 줘도 영원히 제자리에 선다.
// 일정 경로가 실제로 무버를 몰고 있는 동안에만 페이지 이동 등록을 양보한다.
describe("runtimeSchedulePageMovementCoexist", () => {
  isolateTimers();
  function projectWith(schedule: NpcScheduleEntry[], movement: EventPage["movement"]): { project: Project; map: GameMap } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.id = "map_start";
    project.maps = { map_start: map };
    project.startMapId = "map_start";
    project.mapTree = { mapId: "map_start", children: [] };
    project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60 };
    const npc: GameEvent = { ...event("npc", 1, 1, [pageWith({ movement })]), schedule };
    map.events = [npc];
    return { project, map };
  }
  function moveScene(project: Project, map: GameMap): Parameters<typeof registerPageMoveRoutes>[0] {
    store.replace(project);
    let scene: Parameters<typeof registerPageMoveRoutes>[0];
    scene = {
      map,
      session: { ...startSession(project), currentMapId: map.id },
      eventPositions: initialRuntimeEventPositions(map.events),
      pageMoveRouteKeys: new Set(),
      pageMoveRouteEventIds: new Set(),
      autonomousNPCs: new Map(),
      commandMoveRouteEventIds: new Set(),
      registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
      eventSprites: new Map([["npc", mockSprite()]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
      tileX: 0,
      tileY: 0,
    } as Parameters<typeof registerPageMoveRoutes>[0];
    return scene;
  }
  describe("일정과 페이지 이동 공존", () => {
    it("일정이 무버를 몰고 있지 않으면 무작위 이동이 등록된다", () => {
      const { project, map } = projectWith(
        [{ when: { timePhase: "night" }, at: { mapId: "map_start", x: 4, y: 4 } }],
        { type: "random", speed: 3, frequency: 3 },
      );
      const scene = moveScene(project, map);

      registerPageMoveRoutes(scene);

      expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("random");
    });

    it("일정 경로가 무버를 몰고 있는 동안에는 페이지 이동이 끼어들지 않는다", () => {
      const { project, map } = projectWith(
        [{ when: {}, at: { mapId: "map_start", x: 4, y: 4 } }],
        { type: "random", speed: 3, frequency: 3 },
      );
      const scene = moveScene(project, map);
      scene.registerAutonomousMover("npc", [{ kind: "move", dir: "right" }], false);
      scene.commandMoveRouteEventIds.add("npc");

      registerPageMoveRoutes(scene);

      expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("sequence");
      expect(scene.pageMoveRouteEventIds.has("npc")).toBe(false);
    });
  });
});

// 스폰된 이벤트(필드 몬스터·spawnEvent 명령 산출물)의 플레이어 상대 이동 보증.
// 이 이벤트들은 map.events 에 없고 런타임 좌표만 가지므로, 위치 조회가 map.events 에만
// 의존하면 dx=dy=0 이 되어 접근/도주가 영구히 정지한다.
describe("runtimeSpawnedEventMovement", () => {
  isolateTimers();
  const TICK_MS = 16;
  function runtimeSceneFor(scene: ReturnType<typeof movementScene>, player: { x: number; y: number }) {
    return {
      ...scene,
      tileX: player.x,
      tileY: player.y,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    } as Parameters<typeof updateAutonomousNPCs>[0];
  }
  describe("스폰된 이벤트의 플레이어 상대 자율 이동", () => {
    it("접근 이동 스폰 몬스터는 플레이어 쪽으로 이동한다", () => {
      const scene = movementScene({ movement: { type: "approach", speed: 4, frequency: 8 } });
      scene.session.spawnedEvents = {
        mon_spawned: { templateMapId: scene.map.id, templateEventId: "npc", mapId: scene.map.id, x: 3, y: 3 },
      };
      scene.eventPositions.mon_spawned = { x: 3, y: 3, direction: "down" };
      registerPageMoveRoutes(scene);
      const approachMover = scene.autonomousNPCs.get("mon_spawned");
      expect(approachMover?.speedRank).toBe(4);
      expect(approachMover?.moveDurationMs).toBe(npcMoveDurationMs(4));
      expect(approachMover?.frequencyRank).toBe(8);
      expect(approachMover?.moveIntervalMs).toBe(npcMoveIntervalMs(8));

      const runtimeScene = runtimeSceneFor(scene, { x: 8, y: 3 });
      for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, TICK_MS);

      expect(scene.eventPositions.mon_spawned.x).toBeGreaterThan(3);
    });

    it("도주 이동 스폰 몬스터는 플레이어에게서 멀어진다", () => {
      const scene = movementScene({
        movement: {
          type: "custom",
          speed: 4,
          frequency: 8,
          route: { moves: [{ kind: "moveAwayFromPlayer" }], repeat: true },
        },
      });
      scene.session.spawnedEvents = {
        mon_flee: { templateMapId: scene.map.id, templateEventId: "npc", mapId: scene.map.id, x: 5, y: 3 },
      };
      scene.eventPositions.mon_flee = { x: 5, y: 3, direction: "down" };
      registerPageMoveRoutes(scene);

      const runtimeScene = runtimeSceneFor(scene, { x: 2, y: 3 });
      for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, TICK_MS);

      expect(scene.eventPositions.mon_flee.x).toBeGreaterThan(5);
    });
  });
});
