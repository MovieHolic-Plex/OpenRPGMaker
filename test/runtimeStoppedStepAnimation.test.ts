// 「정지 시 애니메이션」은 걷지 않는 이벤트에도 발 그림이 바뀌어야 한다.
// 무버가 없는 페이지(횃불·깃발)는 자율 이동 루프에 안 들어가 가운데 프레임에 얼어 있었다.
import { describe, expect, it } from "vitest";
import { charsetWalkFrameIndex } from "@/player/charsetMotion";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { npcMoveDurationMs, npcWalkFrameMsForStep } from "@/project/characterMotion";
import type { EventAnimationType } from "@/project/types";
import { mockSprite, movementScene } from "./runtimeEventPageFixtures";

function standingScene(animationType: EventAnimationType | undefined, speed = 3) {
  const scene = movementScene({
    ...(animationType ? { animationType } : {}),
    graphic: {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
      direction: "down",
      pattern: 0,
    },
    movement: { type: "fixed", speed, frequency: 3 },
  });
  const sprite = mockSprite(0, 0, "tex_easyrpg_charset_people1");
  const runtime = {
    ...scene,
    tileX: 0,
    tileY: 0,
    eventSprites: new Map([["npc", sprite]]),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
  } as Parameters<typeof updateAutonomousNPCs>[0];
  return { scene, sprite, runtime };
}

function frameAfter(animationType: EventAnimationType | undefined, elapsedMs: number, speed = 3): string | number | null {
  const { sprite, runtime } = standingScene(animationType, speed);
  updateAutonomousNPCs(runtime, 0);
  if (elapsedMs > 0) updateAutonomousNPCs(runtime, elapsedMs);
  return sprite.frame;
}

describe("정지 시 애니메이션", () => {
  const frameMs = npcWalkFrameMsForStep(npcMoveDurationMs(3));

  it("보통 유형은 서 있는 동안 프레임을 바꾸지 않는다", () => {
    const { sprite, runtime } = standingScene("normal");
    updateAutonomousNPCs(runtime, 0);
    updateAutonomousNPCs(runtime, frameMs * 3);
    expect(sprite.frame).toBeNull();
  });

  it("정지 시 애니메이션은 무버 없이 걷기 주기를 돈다", () => {
    expect(frameAfter("step", 0)).toBe(charsetWalkFrameIndex(0, "down", 1));
    expect(frameAfter("step", frameMs)).toBe(charsetWalkFrameIndex(0, "down", 2));
    expect(frameAfter("fixedDirectionStep", frameMs)).toBe(charsetWalkFrameIndex(0, "down", 2));
    expect(frameAfter("fourFrame", frameMs)).toBe(charsetWalkFrameIndex(0, "down", 2));
  });

  it("이동 속도가 빠르면 제자리 애니메이션도 빨리 넘어간다", () => {
    const slow = frameAfter("step", 100, 1);
    const fast = frameAfter("step", 100, 8);
    expect(slow).toBe(charsetWalkFrameIndex(0, "down", 1));
    expect(fast).toBe(charsetWalkFrameIndex(0, "down", 1 + Math.floor(100 / npcWalkFrameMsForStep(npcMoveDurationMs(8)))));
    expect(fast).not.toBe(slow);
  });

  it("이동 경로의 애니메이션 OFF 와 명령 프레임은 제자리 애니메이션이 덮지 않는다", () => {
    const held = standingScene("step");
    held.scene.registerAutonomousMover("npc", [], false);
    const mover = held.scene.autonomousNPCs.get("npc");
    expect(mover).toBeTruthy();
    mover!.animationEnabled = false;
    held.sprite.frame = 7;
    updateAutonomousNPCs(held.runtime, frameMs * 2);
    expect(held.sprite.frame).toBe(7);

    const overridden = standingScene("step");
    overridden.sprite.frame = 48;
    (overridden.runtime as { eventGraphicPatternOverrides?: Map<string, number> }).eventGraphicPatternOverrides = new Map([["npc", 48]]);
    updateAutonomousNPCs(overridden.runtime, frameMs * 2);
    expect(overridden.sprite.frame).toBe(48);
  });
});
