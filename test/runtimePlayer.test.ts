// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { updatePlayScene, startPlayerRoute } from "@/player/playSceneMovement";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { EventPage, GameEvent, MoveCommand } from "@/project/types";
import { DEFAULT_FALL_DURATION_MS, DEFAULT_FALL_HEIGHT_PX, DEFAULT_JUMP_DURATION_MS, DEFAULT_JUMP_PEAK_PX, fallLiftPx } from "@/player/characterHop";
import { isolateTimers } from "./mergedTeardown";

// 대각으로 걸을 때 모서리 칸의 사람(같은 층·겹침 금지)을 직선으로 가로지르지 않는다.
// 벽 모서리는 resolveDiagonalStep 이 이미 미끄러지지만, 인물은 목적지 칸에서만 봤다.
describe("runtimePlayerDiagonalCorner", () => {
  isolateTimers();
  const FRAME_MS = 1000 / 60;
  function solid(id: string, x: number, y: number, trigger: EventPage["trigger"] = { kind: "action" }): GameEvent {
    return {
      id,
      x,
      y,
      trigger,
      commands: [],
      pages: [{
        id: `${id}_p`,
        name: id,
        conditions: [],
        graphic: {},
        trigger,
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      }],
    };
  }
  function cornerScene(events: GameEvent[], input: { x: number; y: number; dir: "right" | "down" }): {
    scene: PlaySceneContext;
    ran: string[];
  } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.events = events;
    store.replace(project);
    const ran: string[] = [];
    const scene = {
      game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
      session: startSession(project),
      map,
      eventPositions: initialRuntimeEventPositions(map.events),
      player: {
        x: 0, y: 0, setFrame: () => undefined, setPosition: () => undefined, setVisible: () => undefined,
        setDepth: () => undefined, setOrigin: () => undefined,
      },
      playerSprite: { idleFrameFor: () => 1, walkFrameFor: () => 2, walkFrameCount: 3 },
      input_: {
        update: () => ({ x: input.x, y: input.y, dir: input.dir, dash: false, actionPressed: false, attackPressed: false, skillPressed: false }),
        resetEdges: () => undefined,
        clearDirectionTaps: () => undefined,
      },
      followerSprites: new Map(),
      autonomousNPCs: new Map(),
      tileX: 4,
      tileY: 4,
      movingFrom: { x: 4, y: 4 },
      movingTo: { x: 4, y: 4 },
      moving: false,
      moveProgress: 0,
      moveDurationMs: 160,
      logicTickAccumulatorMs: 0,
      dashing: false,
      facing: "down",
      walkFrame: 0,
      walkTimer: 0,
      lastActionTargetKey: "",
      playerRoute: null,
      playerHop: null,
      running: false,
      inputEnabled: true,
      runEvent: async (id: string) => { ran.push(id); },
      updateAutonomousNPCs: () => undefined,
      updateParallelEvents: () => undefined,
      updateTimers: () => undefined,
      updateFieldSpawns: () => undefined,
      syncRuntimeState: () => undefined,
    } as unknown as PlaySceneContext;
    return { scene, ran };
  }
  describe("대각 걸음은 모서리의 사람을 가로지르지 않는다", () => {
    it("오른쪽 모서리에 사람이 있으면 아래로 미끄러진다", () => {
      const { scene, ran } = cornerScene([solid("npc", 5, 4)], { x: 1, y: 1, dir: "right" });
      updatePlayScene(scene, FRAME_MS);
      expect(scene.moving).toBe(true);
      expect(scene.movingTo).toEqual({ x: 4, y: 5 });
      expect(scene.facing).toBe("down");
      expect(ran).toEqual([]);
    });

    it("발밑 이벤트(아래 층)는 모서리를 막지 않는다", () => {
      const rug = solid("rug", 5, 4);
      rug.pages![0]!.priority = "below";
      rug.pages![0]!.overlapForbidden = false;
      const { scene } = cornerScene([rug], { x: 1, y: 1, dir: "right" });
      updatePlayScene(scene, FRAME_MS);
      expect(scene.movingTo).toEqual({ x: 5, y: 5 });
    });

    it("양쪽 모서리가 사람이면 대각으로 들어가지 않고 바라보는 쪽에게 부딪힌다", () => {
      const { scene, ran } = cornerScene(
        [solid("side", 5, 4, { kind: "playerTouch" }), solid("ahead", 4, 5, { kind: "playerTouch" })],
        { x: 1, y: 1, dir: "right" },
      );
      updatePlayScene(scene, FRAME_MS);
      expect(scene.moving).toBe(false);
      expect(scene.tileX).toBe(4);
      expect(scene.tileY).toBe(4);
      expect(scene.facing).toBe("right");
      expect(ran).toEqual(["side"]);
    });

    it("대각 목적지 칸의 사람에게는 미끄러지지 않고 그 자리에서 부딪힌다", () => {
      const { scene, ran } = cornerScene([solid("npc", 5, 5, { kind: "playerTouch" })], { x: 1, y: 1, dir: "right" });
      updatePlayScene(scene, FRAME_MS);
      expect(scene.moving).toBe(false);
      expect(scene.tileX).toBe(4);
      expect(scene.tileY).toBe(4);
      expect(ran).toEqual(["npc"]);
    });

    it("정면의 사람에게 똑바로 걸으면 여전히 부딪혀 접촉이 발동한다", () => {
      const { scene, ran } = cornerScene([solid("npc", 5, 4, { kind: "playerTouch" })], { x: 1, y: 0, dir: "right" });
      updatePlayScene(scene, FRAME_MS);
      expect(scene.moving).toBe(false);
      expect(ran).toEqual(["npc"]);
    });
  });
});

describe("runtimePlayerHop", () => {
  isolateTimers();
  type PlayerMock = {
    x: number;
    y: number;
    depth: number;
    frame: string | number;
    origin: readonly [number, number];
    readonly height: number;
    readonly scaleY: number;
    setFrame(frame: string | number): void;
    setOrigin(x: number, y: number): void;
    setPosition(x: number, y: number): void;
    setDepth(depth: number): void;
  };
  function playerMock(): PlayerMock {
    return {
      x: 0,
      y: 0,
      depth: 0,
      frame: 0,
      origin: [0.5, 1],
      height: 32,
      scaleY: 1,
      setFrame(frame) {
        this.frame = frame;
        // Phaser 의 setFrame 은 displayOrigin 을 기본값으로 되돌린다 — 리프트 계약을 재현한다.
        this.origin = [0.5, 1];
      },
      setOrigin(x, y) {
        this.origin = [x, y];
      },
      setPosition(x, y) {
        this.x = x;
        this.y = y;
      },
      setDepth(depth) {
        this.depth = depth;
      },
    };
  }
  function hopScene(): { readonly scene: PlaySceneContext; readonly player: PlayerMock } {
    const project = createBlankProject();
    store.replace(project);
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    const player = playerMock();
    const scene = {
      game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
      session: startSession(project),
      map,
      eventPositions: initialRuntimeEventPositions(map.events),
      player,
      playerSprite: {
        idleFrameFor: () => 1,
        walkFrameFor: (_dir: string, frame: number) => 10 + frame,
        walkFrameCount: 3,
      },
      input_: {
        update: () => ({
          x: 0,
          y: 0,
          dir: null,
          dash: false,
          actionPressed: false,
          attackPressed: false,
          skillPressed: false,
        }),
        resetEdges: () => undefined,
      },
      followerSprites: new Map(),
      autonomousNPCs: new Map(),
      tileX: 4,
      tileY: 4,
      movingFrom: { x: 4, y: 4 },
      movingTo: { x: 4, y: 4 },
      moving: false,
      moveProgress: 0,
      moveDurationMs: 160,
      logicTickAccumulatorMs: 0,
      dashing: false,
      facing: "right",
      walkFrame: 0,
      walkTimer: 0,
      lastActionTargetKey: "",
      playerRoute: null,
      playerHop: null,
      running: false,
      inputEnabled: true,
      runEvent: async () => undefined,
      updateAutonomousNPCs: () => undefined,
      updateParallelEvents: () => undefined,
      updateTimers: () => undefined,
      updateFieldSpawns: () => undefined,
      syncRuntimeState: () => undefined,
    } as unknown as PlaySceneContext;
    return { scene, player };
  }
  /** 원점 Y 에 실린 리프트를 월드 px 로 되읽는다. */
  function liftPx(player: PlayerMock): number {
    return (player.origin[1] - 1) * player.height * player.scaleY;
  }
  function route(scene: PlaySceneContext, moves: MoveCommand[]): void {
    startPlayerRoute(scene, moves, false);
  }
  /** 논리 프레임(60Hz). 점프·낙하도 걸음과 같은 틱으로 진행되므로 시간이 아니라 프레임 수로 말한다. */
  const FRAME_MS = 1000 / 60;
  const frames = (count: number): number => count * FRAME_MS;
  const framesFor = (durationMs: number): number => Math.round(durationMs / FRAME_MS);
  describe("주인공 점프", () => {
    it("바라보는 방향으로 두 칸을 아크로 건너뛴다", () => {
      const { scene, player } = hopScene();
      route(scene, [{ kind: "jump", dx: 0, dy: 0 }]);
      const total = framesFor(DEFAULT_JUMP_DURATION_MS);

      updatePlayScene(scene, frames(1));
      expect(scene.moving).toBe(true);
      expect(scene.movingTo).toEqual({ x: 6, y: 4 });
      expect(scene.playerHop).not.toBeNull();

      updatePlayScene(scene, frames(total / 2 - 1));
      expect(liftPx(player)).toBeCloseTo(DEFAULT_JUMP_PEAK_PX, 6);
      // 접지 y 는 아크 내내 타일 경계에 남는다(depth·카메라·조명이 이 값을 읽는다).
      expect(player.y).toBe(5 * 16);

      updatePlayScene(scene, frames(total / 2));
      expect(scene.moving).toBe(false);
      expect(scene.playerHop).toBeNull();
      expect(liftPx(player)).toBe(0);
      expect(scene.tileX).toBe(6);
      expect(scene.tileY).toBe(4);
      expect(scene.session.x).toBe(6);
    });

    it("저작 좌표·높이를 그대로 쓴다", () => {
      const { scene, player } = hopScene();
      route(scene, [{ kind: "jump", dx: -1, dy: 2, heightPx: 40, durationMs: 400 }]);
      const total = framesFor(400);

      updatePlayScene(scene, frames(1));
      expect(scene.movingTo).toEqual({ x: 3, y: 6 });
      updatePlayScene(scene, frames(total / 2 - 1));
      expect(liftPx(player)).toBeCloseTo(40, 6);
      updatePlayScene(scene, frames(total / 2));
      expect(scene.tileX).toBe(3);
      expect(scene.tileY).toBe(6);
      expect(liftPx(player)).toBe(0);
    });

    it("맵 밖으로는 뛰지 않고 다음 명령으로 넘어간다", () => {
      const { scene } = hopScene();
      route(scene, [{ kind: "jump", dx: 0, dy: -99 }, { kind: "turn", dir: "up" }]);

      updatePlayScene(scene, frames(1));
      expect(scene.moving).toBe(false);
      expect(scene.playerHop).toBeNull();
      expect(scene.tileY).toBe(4);
      expect(scene.facing).toBe("up");
    });
  });
  describe("주인공 낙하 등장", () => {
    it("타일 이동 없이 위에서 떨어진다", () => {
      const { scene, player } = hopScene();
      route(scene, [{ kind: "dropIn" }]);
      const total = framesFor(DEFAULT_FALL_DURATION_MS);

      updatePlayScene(scene, frames(1));
      expect(scene.moving).toBe(false);
      expect(scene.playerHop).not.toBeNull();
      // 곡선 자체는 characterHop.test.ts 가 잠근다 — 여기서는 런타임이 그 곡선을 프레임 진행률로 쓰는지만 본다.
      expect(liftPx(player)).toBe(Math.round(fallLiftPx(1 / total, DEFAULT_FALL_HEIGHT_PX)));

      const midpoint = Math.floor(total / 2);
      updatePlayScene(scene, frames(midpoint - 1));
      expect(liftPx(player)).toBe(Math.round(fallLiftPx(midpoint / total, DEFAULT_FALL_HEIGHT_PX)));
      expect(scene.tileX).toBe(4);
      expect(scene.tileY).toBe(4);

      updatePlayScene(scene, frames(total - midpoint));
      expect(scene.playerHop).toBeNull();
      expect(liftPx(player)).toBe(0);
      expect(player.origin).toEqual([0.5, 1]);
    });

    it("낙하가 끝날 때까지 다음 이동 명령을 소비하지 않는다", () => {
      const { scene } = hopScene();
      route(scene, [{ kind: "dropIn", durationMs: 200 }, { kind: "move", dir: "right" }]);
      const total = framesFor(200);

      updatePlayScene(scene, frames(1));
      updatePlayScene(scene, frames(total / 2 - 1));
      // 아직 공중이므로 다음 걸음이 시작되지 않았다.
      expect(scene.moving).toBe(false);
      expect(scene.tileX).toBe(4);

      updatePlayScene(scene, frames(total / 2));
      expect(scene.playerHop).toBeNull();
      updatePlayScene(scene, frames(1));
      expect(scene.moving).toBe(true);
      expect(scene.movingTo).toEqual({ x: 5, y: 4 });
    });
  });
});
