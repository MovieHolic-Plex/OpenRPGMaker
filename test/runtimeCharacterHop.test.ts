import { describe, expect, it } from "vitest";
import type { MoveCommand } from "@/project/types";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import {
  DEFAULT_FALL_DURATION_MS,
  DEFAULT_FALL_HEIGHT_PX,
  DEFAULT_JUMP_DURATION_MS,
  DEFAULT_JUMP_PEAK_PX,
} from "@/player/characterHop";
import { mockSprite, movementScene, type MockSprite } from "./runtimeEventPageFixtures";

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
    // 등가속이라 절반 시점에는 아직 시작 높이의 3/4 지점이다.
    expect(midLift).toBeCloseTo(DEFAULT_FALL_HEIGHT_PX * 0.75, 6);

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
