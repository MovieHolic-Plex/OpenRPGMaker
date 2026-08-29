// 스프라이트를 다시 놓는 경로가 **몸 중앙**을 유지하는지 — 2차 스펙 §7.
//
// 1차는 `footprintSpriteX` 를 최초 렌더(renderEvents) 한 곳에만 걸었다. 그래서 폭 2 이상
// 이벤트가 걷기 시작하면 타일 중앙으로 되돌아가며 반 칸 튀었다.
//
// 판별력 규칙: **짝수 폭**으로 프로브한다. 홀수 폭은 `footprintSpriteX === characterSpriteX`
// 라서 타일 중앙으로 되돌리는 버그를 통과시킨다 — 아무것도 증명하지 않는다.

import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "@/assets/bundled";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { minimapEventMarkerRect } from "@/player/minimap";
import { applyCameraControl } from "@/player/playSceneCamera";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { syncFollowerSprites } from "@/player/playSceneFollowers";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { addFollowerToSession, charsetFollowerGraphic } from "@/project/followers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { CharacterFootprint, EventPage, GameEvent } from "@/project/types";
import { mockSprite, movementScene, type MockSprite } from "./runtimeEventPageFixtures";

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
