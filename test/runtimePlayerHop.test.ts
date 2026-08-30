import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { MoveCommand } from "@/project/types";
import { startPlayerRoute, updatePlayScene } from "@/player/playSceneMovement";
import {
  DEFAULT_FALL_DURATION_MS,
  DEFAULT_FALL_HEIGHT_PX,
  DEFAULT_JUMP_DURATION_MS,
  DEFAULT_JUMP_PEAK_PX,
  fallLiftPx,
} from "@/player/characterHop";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { PlaySceneContext } from "@/player/playSceneTypes";

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

describe("주인공 점프", () => {
  it("바라보는 방향으로 두 칸을 아크로 건너뛴다", () => {
    const { scene, player } = hopScene();
    route(scene, [{ kind: "jump", dx: 0, dy: 0 }]);

    updatePlayScene(scene, 0);
    expect(scene.moving).toBe(true);
    expect(scene.movingTo).toEqual({ x: 6, y: 4 });
    expect(scene.playerHop).not.toBeNull();

    updatePlayScene(scene, DEFAULT_JUMP_DURATION_MS / 2);
    expect(liftPx(player)).toBeCloseTo(DEFAULT_JUMP_PEAK_PX, 6);
    // 접지 y 는 아크 내내 타일 경계에 남는다(depth·카메라·조명이 이 값을 읽는다).
    expect(player.y).toBe(5 * 16);

    updatePlayScene(scene, DEFAULT_JUMP_DURATION_MS / 2);
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

    updatePlayScene(scene, 0);
    expect(scene.movingTo).toEqual({ x: 3, y: 6 });
    updatePlayScene(scene, 200);
    expect(liftPx(player)).toBeCloseTo(40, 6);
    updatePlayScene(scene, 200);
    expect(scene.tileX).toBe(3);
    expect(scene.tileY).toBe(6);
    expect(liftPx(player)).toBe(0);
  });

  it("맵 밖으로는 뛰지 않고 다음 명령으로 넘어간다", () => {
    const { scene } = hopScene();
    route(scene, [{ kind: "jump", dx: 0, dy: -99 }, { kind: "turn", dir: "up" }]);

    updatePlayScene(scene, 0);
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

    updatePlayScene(scene, 0);
    expect(scene.moving).toBe(false);
    expect(scene.playerHop).not.toBeNull();
    expect(liftPx(player)).toBe(DEFAULT_FALL_HEIGHT_PX);

    updatePlayScene(scene, DEFAULT_FALL_DURATION_MS / 2);
    // 곡선 자체는 characterHop.test.ts 가 잠근다 — 여기서는 런타임이 그 곡선을 쓰는지만 본다.
    expect(liftPx(player)).toBe(Math.round(fallLiftPx(0.5, DEFAULT_FALL_HEIGHT_PX)));
    expect(scene.tileX).toBe(4);
    expect(scene.tileY).toBe(4);

    updatePlayScene(scene, DEFAULT_FALL_DURATION_MS / 2);
    expect(scene.playerHop).toBeNull();
    expect(liftPx(player)).toBe(0);
    expect(player.origin).toEqual([0.5, 1]);
  });

  it("낙하가 끝날 때까지 다음 이동 명령을 소비하지 않는다", () => {
    const { scene } = hopScene();
    route(scene, [{ kind: "dropIn", durationMs: 200 }, { kind: "move", dir: "right" }]);

    updatePlayScene(scene, 0);
    updatePlayScene(scene, 100);
    // 아직 공중이므로 다음 걸음이 시작되지 않았다.
    expect(scene.moving).toBe(false);
    expect(scene.tileX).toBe(4);

    updatePlayScene(scene, 100);
    expect(scene.playerHop).toBeNull();
    updatePlayScene(scene, 0);
    expect(scene.moving).toBe(true);
    expect(scene.movingTo).toEqual({ x: 5, y: 4 });
  });
});
