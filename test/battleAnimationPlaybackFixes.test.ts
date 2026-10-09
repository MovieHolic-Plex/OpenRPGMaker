/** @vitest-environment happy-dom */
/**
 * 전투 이펙트 재생의 세 가지 계약.
 *
 * 1. 배속을 켜면 이펙트도 같이 빨라진다 — 예전에는 시퀀서만 배율을 먹고 애니메이션은
 *    상수 120ms 라, 3배속에서 이펙트만 원속도로 남아 다음 행동 위로 겹쳤다.
 * 2. 재생이 끝나면 그림을 걷는다 — 예전에는 clearInterval 만 해서 마지막 컷이 약 1초 남았다.
 * 3. flash.target 을 지킨다 — 예전에는 대상 지정을 무시하고 무조건 화면 전체를 번쩍였다.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { battleAnimationFrameMs, mountBattleAnimationPlayback } from "@/player/battleAnimationDom";
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import type { BattleAnimationFlash, BattleAnimationTiming } from "@/project/types";

const TARGET_ID = "enemy_1";

function sceneWithTarget(speed?: string): { scene: HTMLElement; target: HTMLElement } {
  const scene = document.createElement("section");
  scene.className = "battle-scene";
  if (speed) scene.dataset.battleSpeed = speed;
  const target = document.createElement("div");
  target.dataset.testid = TARGET_ID;
  scene.append(target);
  document.body.append(scene);
  return { scene, target };
}

/** 3프레임짜리 최소 레코드. 시트가 있어야 재생 경로를 탄다. */
function seedAnimation(
  timings: BattleAnimationTiming[],
  options: { readonly resourceId?: string; readonly frameCount?: number } = {}
): void {
  const frameCount = options.frameCount ?? 3;
  const project = createBlankProject();
  project.database.battleAnimations = [
    normalizeBattleAnimationRecord({
      id: "anim_test",
      name: "테스트",
      resourceId: options.resourceId ?? "scarloxy-battle-anim-scratch",
      sheet: { frameWidth: 96, frameHeight: 96, columns: frameCount },
      frames: Array.from({ length: frameCount }, (_unused, pattern) => ({
        cells: [{ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
      })),
      timings,
    }),
  ];
  store.replace(project);
}

function snapshotWith(): never | Record<string, unknown> {
  return {
    lastAnimation: {
      animationId: "anim_test",
      targetId: TARGET_ID,
      name: "테스트",
      soundResourceIds: [],
      flashTargets: [],
      screenShake: false,
      frameCount: 3,
    },
  };
}

function flashTiming(target: BattleAnimationFlash["target"]): BattleAnimationTiming {
  return { frameIndex: 0, flash: { target, color: { red: 120, green: 180, blue: 255, gray: 0 }, durationFrames: 4 } };
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.useRealTimers();
});

describe("battleAnimationFrameMs — 배속이 이펙트에도 걸린다", () => {
  it("배율이 없으면 기본 간격", () => {
    const { scene } = sceneWithTarget();
    expect(battleAnimationFrameMs(scene)).toBe(BATTLE_ANIMATION_FRAME_MS);
    expect(battleAnimationFrameMs(null)).toBe(BATTLE_ANIMATION_FRAME_MS);
  });

  it("배율이 커질수록 간격이 짧아진다", () => {
    const fast = battleAnimationFrameMs(sceneWithTarget("3.0").scene);
    document.body.innerHTML = "";
    const mid = battleAnimationFrameMs(sceneWithTarget("1.8").scene);
    expect(fast).toBeLessThan(mid);
    expect(mid).toBeLessThan(BATTLE_ANIMATION_FRAME_MS);
  });

  it("에디터가 제공하는 3단계가 서로 다른 간격이 된다", () => {
    const values = ["1.0", "1.8", "3.0"].map((speed) => {
      document.body.innerHTML = "";
      return battleAnimationFrameMs(sceneWithTarget(speed).scene);
    });
    expect(new Set(values).size).toBe(3);
  });

  it("비정상 배율은 기본 간격으로 떨어진다", () => {
    for (const bad of ["0", "-2", "abc", ""]) {
      document.body.innerHTML = "";
      expect(battleAnimationFrameMs(sceneWithTarget(bad).scene)).toBe(BATTLE_ANIMATION_FRAME_MS);
    }
  });

  it("하한 아래 배율에서도 간격이 무한정 늘지 않는다", () => {
    // 시퀀서와 같은 하한(0.2)을 쓴다 — 여기만 다르면 서로 어긋난다.
    expect(battleAnimationFrameMs(sceneWithTarget("0.01").scene)).toBe(BATTLE_ANIMATION_FRAME_MS / 0.2);
  });
});

describe("flash.target 라우팅", () => {
  it('target="target" 은 대상만 물들이고 화면은 건드리지 않는다', () => {
    seedAnimation([flashTiming("target")]);
    const { scene, target } = sceneWithTarget();

    mountBattleAnimationPlayback(snapshotWith() as never, scene);

    expect(target.classList.contains("battle-animation-target-flash")).toBe(true);
    expect(scene.classList.contains("battle-screen-flash")).toBe(false);
    // 저작한 색이 대상 노드로 간다.
    expect(target.style.getPropertyValue("--battle-flash-color")).toContain("120, 180, 255");
  });

  it('target="screen" 은 화면 전체를 번쩍인다', () => {
    seedAnimation([flashTiming("screen")]);
    const { scene, target } = sceneWithTarget();

    mountBattleAnimationPlayback(snapshotWith() as never, scene);

    expect(scene.classList.contains("battle-screen-flash")).toBe(true);
    expect(target.classList.contains("battle-animation-target-flash")).toBe(false);
    expect(scene.style.getPropertyValue("--battle-flash-color")).toContain("120, 180, 255");
  });

  it("대상 노드를 못 찾으면 화면 플래시로 떨어져 연출이 사라지지 않는다", () => {
    seedAnimation([flashTiming("target")]);
    const scene = document.createElement("section");
    scene.className = "battle-scene";
    document.body.append(scene); // 대상 노드 없음

    mountBattleAnimationPlayback(snapshotWith() as never, scene);

    expect(scene.classList.contains("battle-screen-flash")).toBe(true);
  });

  it("destroy 하면 대상 플래시 흔적이 남지 않는다", () => {
    seedAnimation([flashTiming("target")]);
    const { scene, target } = sceneWithTarget();

    const playback = mountBattleAnimationPlayback(snapshotWith() as never, scene);
    expect(target.classList.contains("battle-animation-target-flash")).toBe(true);

    playback?.destroy();
    expect(target.classList.contains("battle-animation-target-flash")).toBe(false);
  });
});

describe("재생 종료", () => {
  it("생성 이펙트는 75ms마다 다음 프레임으로 넘어간다", () => {
    vi.useFakeTimers();
    seedAnimation([], { resourceId: "generated-battle-anim-slash-steel", frameCount: 8 });
    const { scene } = sceneWithTarget();

    const playback = mountBattleAnimationPlayback(snapshotWith() as never, scene)!;
    expect(playback.element.dataset.currentFrame).toBe("0");
    vi.advanceTimersByTime(75);
    expect(playback.element.dataset.currentFrame).toBe("1");
  });

  it("생성 이펙트의 플래시 지속시간도 75ms 프레임 단위를 쓴다", () => {
    seedAnimation([flashTiming("target")], {
      resourceId: "generated-battle-anim-slash-steel",
      frameCount: 8,
    });
    const { scene, target } = sceneWithTarget();

    mountBattleAnimationPlayback(snapshotWith() as never, scene);

    expect(target.style.getPropertyValue("--battle-flash-duration")).toBe("300ms");
  });

  it("마지막 프레임까지 돌면 그림을 걷는다", () => {
    vi.useFakeTimers();
    seedAnimation([]);
    const { scene } = sceneWithTarget();

    const playback = mountBattleAnimationPlayback(snapshotWith() as never, scene);
    const element = playback!.element;
    expect(element.querySelectorAll(".battle-animation-frame").length).toBe(3);

    // 3프레임 × 120ms 를 넘겨 재생을 끝낸다.
    vi.advanceTimersByTime(BATTLE_ANIMATION_FRAME_MS * 4);

    expect(element.dataset.playbackFinished).toBe("true");
    const visible = [...element.querySelectorAll<HTMLElement>(".battle-animation-frame")].filter((f) => !f.hidden);
    expect(visible, "재생이 끝났는데 마지막 컷이 화면에 남아 있다").toHaveLength(0);
  });

  it("종료 시 화면 효과 클래스도 함께 걷힌다", () => {
    vi.useFakeTimers();
    seedAnimation([flashTiming("screen")]);
    const { scene } = sceneWithTarget();

    mountBattleAnimationPlayback(snapshotWith() as never, scene);
    expect(scene.classList.contains("battle-screen-flash")).toBe(true);

    vi.advanceTimersByTime(BATTLE_ANIMATION_FRAME_MS * 4);
    expect(scene.classList.contains("battle-screen-flash")).toBe(false);
  });
});
