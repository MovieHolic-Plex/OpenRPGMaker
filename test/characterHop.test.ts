import { describe, expect, it } from "vitest";
import {
  applyCharacterLift,
  characterHopLiftPx,
  clampHopDurationMs,
  clampHopLiftPx,
  clearCharacterLift,
  DEFAULT_FALL_HEIGHT_PX,
  DEFAULT_JUMP_DURATION_MS,
  DEFAULT_JUMP_PEAK_PX,
  fallHop,
  fallLiftPx,
  hopOriginY,
  jumpArcLiftPx,
  jumpHop,
  MAX_HOP_LIFT_PX,
  MIN_HOP_DURATION_MS,
} from "@/player/characterHop";
import {
  DEFAULT_LANDING_SE,
  landingImpactPlan,
  MIN_IMPACT_LIFT_PX,
} from "@/player/characterLanding";
import { shadowAlphaForLift, shadowScaleForLift } from "@/player/characterShadow";

describe("character hop curves", () => {
  it("점프 아크는 양 끝이 접지이고 중간이 최고점이다", () => {
    expect(jumpArcLiftPx(0, 12)).toBe(0);
    expect(jumpArcLiftPx(1, 12)).toBe(0);
    expect(jumpArcLiftPx(0.5, 12)).toBe(12);
    // 대칭성: 상승 구간과 하강 구간의 같은 거리에서 높이가 같다.
    expect(jumpArcLiftPx(0.25, 12)).toBeCloseTo(jumpArcLiftPx(0.75, 12), 6);
    // 단조 상승 → 단조 하강.
    expect(jumpArcLiftPx(0.3, 12)).toBeGreaterThan(jumpArcLiftPx(0.1, 12));
    expect(jumpArcLiftPx(0.9, 12)).toBeLessThan(jumpArcLiftPx(0.7, 12));
  });

  it("낙하는 시작 높이에서 접지까지 가속하며 내려온다", () => {
    expect(fallLiftPx(0, 128)).toBe(128);
    expect(fallLiftPx(1, 128)).toBe(0);
    // 등가속이라 전반부보다 후반부에서 더 많이 떨어진다.
    const firstHalf = fallLiftPx(0, 128) - fallLiftPx(0.5, 128);
    const secondHalf = fallLiftPx(0.5, 128) - fallLiftPx(1, 128);
    expect(secondHalf).toBeGreaterThan(firstHalf);
  });

  it("진행도와 값을 범위 밖으로 줘도 안전하다", () => {
    expect(jumpArcLiftPx(-1, 12)).toBe(0);
    expect(jumpArcLiftPx(2, 12)).toBe(0);
    expect(fallLiftPx(Number.NaN, 128)).toBe(128);
    expect(clampHopLiftPx(-5)).toBe(0);
    expect(clampHopLiftPx(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampHopLiftPx(MAX_HOP_LIFT_PX * 10)).toBe(MAX_HOP_LIFT_PX);
    expect(clampHopDurationMs(0)).toBe(MIN_HOP_DURATION_MS);
    expect(clampHopDurationMs(Number.NaN)).toBe(DEFAULT_JUMP_DURATION_MS);
  });

  it("저작 명령의 빈 옵션은 기본값이 되고, 낙하만 임팩트가 켜진다", () => {
    const jump = jumpHop({});
    expect(jump).toMatchObject({ kind: "jump", liftPx: DEFAULT_JUMP_PEAK_PX, impact: false });
    const fall = fallHop({});
    expect(fall).toMatchObject({ kind: "fall", liftPx: DEFAULT_FALL_HEIGHT_PX, impact: true });
    expect(jumpHop({ heightPx: 40, durationMs: 10, se: "se_x" })).toMatchObject({
      liftPx: 40,
      durationMs: MIN_HOP_DURATION_MS,
      se: "se_x",
    });
    expect(characterHopLiftPx(fall, 0)).toBe(DEFAULT_FALL_HEIGHT_PX);
    expect(characterHopLiftPx(jump, 0)).toBe(0);
  });
});

describe("origin lift channel", () => {
  it("리프트를 원점 Y 로 환산할 때 스케일로 나눈다", () => {
    // 기본(32px, 배율 1): 16px 을 띄우면 원점이 절반 더 늘어난다.
    expect(hopOriginY(16, 32, 1)).toBe(1.5);
    // 배율 2 인 큰 보스도 화면상 16px 만 뜬다 — 원점 증가분이 절반이다.
    expect(hopOriginY(16, 32, 2)).toBe(1.25);
    expect(hopOriginY(0, 32, 1)).toBe(1);
    expect(hopOriginY(16, 0, 1)).toBe(1);
  });

  it("스프라이트가 높이를 안 주면 캐릭셋 32px 로 계산한다", () => {
    const calls: Array<readonly [number, number]> = [];
    const sprite = {
      setOrigin(x: number, y: number) {
        calls.push([x, y]);
      },
    };
    applyCharacterLift(sprite, 16);
    clearCharacterLift(sprite);
    expect(calls).toEqual([
      [0.5, 1.5],
      [0.5, 1],
    ]);
  });

  it("스프라이트가 없어도 조용히 넘어간다", () => {
    expect(() => applyCharacterLift(undefined, 16)).not.toThrow();
    expect(() => clearCharacterLift(undefined)).not.toThrow();
  });
});

describe("landing impact plan", () => {
  it("임팩트가 없는 점프는 계획을 만들지 않는다", () => {
    expect(landingImpactPlan(jumpHop({}))).toBeNull();
  });

  it("저작 효과음만 있으면 흔들림 없이 소리만 낸다", () => {
    const plan = landingImpactPlan(jumpHop({ se: "se_hop" }));
    expect(plan).toMatchObject({ shakeMs: 0, dust: false, se: "se_hop" });
  });

  it("한 칸 이하 높이에서는 임팩트를 내지 않는다", () => {
    expect(landingImpactPlan(fallHop({ heightPx: MIN_IMPACT_LIFT_PX }))).toBeNull();
  });

  it("높이가 커지면 흔들림이 세지고 기본 효과음이 붙는다", () => {
    const low = landingImpactPlan(fallHop({ heightPx: 24 }));
    const high = landingImpactPlan(fallHop({}));
    expect(low?.se).toBe(DEFAULT_LANDING_SE);
    expect(high?.shakeMs).toBeGreaterThan(low?.shakeMs ?? 0);
    expect(high?.shakeRatio).toBeGreaterThan(low?.shakeRatio ?? 0);
    expect(high?.dust).toBe(true);
  });

  it("모션 축소 환경에서는 흔들림·먼지를 버리고 소리만 남긴다", () => {
    const plan = landingImpactPlan(fallHop({}), { reducedMotion: true });
    expect(plan).toMatchObject({ shakeMs: 0, shakeRatio: 0, dust: false, se: DEFAULT_LANDING_SE });
  });
});

describe("airborne shadow curve", () => {
  it("높이가 커지면 그림자가 작고 옅어진다", () => {
    expect(shadowScaleForLift(0)).toBeGreaterThan(shadowScaleForLift(16));
    expect(shadowScaleForLift(16)).toBeGreaterThan(shadowScaleForLift(32));
    expect(shadowAlphaForLift(0)).toBeGreaterThan(shadowAlphaForLift(32));
    // 포화 후에는 더 줄지 않는다(아주 높은 낙하에서 그림자가 사라지지 않는다).
    expect(shadowScaleForLift(999)).toBe(shadowScaleForLift(32));
    expect(shadowAlphaForLift(999)).toBeGreaterThan(0);
  });
});
