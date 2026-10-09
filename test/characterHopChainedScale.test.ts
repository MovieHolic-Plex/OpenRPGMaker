// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyHopFrame, finishHop, type HopVisualScene } from "@/player/characterHopRuntime";
import { HOP_SQUASH_MS } from "@/player/characterHop";

type ScaleSprite = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  readonly height: number;
  setOrigin(x: number, y: number): void;
  setScale(x: number, y: number): void;
};

/* 기존 통합 모의는 setScale 을 갖지 않아 applyHopScale 이 조용히 no-op 이었다. 그래서
   배율 채널 두 개(스쿼시·원근)가 출하 경로에서 전혀 검증되지 않았고, 아래 결함이 그 틈으로
   들어왔다. 이 모의는 setScale 을 실제로 기록한다. */
function scaleSprite(): ScaleSprite {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    height: 32,
    setOrigin() {},
    setScale(x: number, y: number) { this.scaleX = x; this.scaleY = y; },
  };
}

function sceneWithTweens(): {
  scene: HopVisualScene;
  killed: object[];
  runPendingTween: () => void;
} {
  const killed: object[] = [];
  let pending: (() => void) | null = null;
  const displayObject = {
    setDepth() { return this; }, setAlpha() { return this; }, setScale() { return this; },
    setPosition() { return this; }, setVisible() { return this; }, destroy() {},
    setOrigin() { return this; }, setTint() { return this; }, setBlendMode() { return this; },
  };
  const scene = {
    characterHopScales: new Map(),
    cameras: { main: { shake() {} } },
    textures: { exists: () => true, addCanvas: () => undefined },
    add: { image: () => displayObject, graphics: () => displayObject, sprite: () => displayObject },
    tweens: {
      killTweensOf(target: object) {
        killed.push(target);
        pending = null;
      },
      add(config: { targets?: unknown; onComplete?: () => void }) {
        pending = () => config.onComplete?.();
        return { stop() { pending = null; } };
      },
    },
  } as unknown as HopVisualScene;
  return { scene, killed, runPendingTween: () => pending?.() };
}

describe("연속 체공 배율", () => {
  /* 착지 스쿼시 트윈은 HOP_SQUASH_MS 동안 스프라이트를 눌러 두는데, 경로는 !scene.playerHop 이면
     다음 프레임에 바로 다음 체공을 시작한다. 기준 배율을 풀에서 지운 채로 두면 다음 체공이
     캐시 미스로 눌린 값을 읽어 영구 기준으로 굳고, 남은 맵 동안 캐릭터가 찌그러진다.
     트윈을 끊는 것만으로는 안 된다 — 스프라이트가 눌린 값에 그대로 머문다. */
  it("착지 눌림 중에도 기준 배율이 풀에 남아 다음 체공이 눌린 값을 기준으로 잡지 않는다", () => {
    const { scene, killed } = sceneWithTweens();
    const sprite = scaleSprite();
    const fall = { kind: "fall", liftPx: 128, durationMs: 400, impact: true } as const;

    applyHopFrame(scene, "__player", sprite as never, 0, 0, fall, 0.5);
    finishHop(scene, "__player", sprite as never, 0, 0, fall);

    const kept = scene.characterHopScales.get("__player");
    expect(kept).toEqual({ x: 1, y: 1 });

    // 다음 체공은 캐시를 맞춰 참 기준(1)을 쓰고, 살아 있던 트윈을 끊는다
    const jump = { kind: "jump", liftPx: 64, durationMs: 300, impact: true } as const;
    applyHopFrame(scene, "__player", sprite as never, 0, 0, jump, 0.5);
    expect(killed).toContain(sprite);
    expect(scene.characterHopScales.get("__player")).toEqual({ x: 1, y: 1 });
  });

  it("스쿼시 지속시간이 0 보다 커서 트윈이 착지보다 오래 산다", () => {
    expect(HOP_SQUASH_MS).toBeGreaterThan(0);
  });
});
