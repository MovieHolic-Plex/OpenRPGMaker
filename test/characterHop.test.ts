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
  hopAirScale,
  hopBaseScaleOf,
  hopLandingSquashScale,
  hopOriginY,
  hopPerspectiveScale,
  hopSpeedRatio,
  hopStretchScale,
  applyHopScale,
  FALL_PERSPECTIVE_MAX,
  HOP_PERSPECTIVE_MAX,
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
import { TILE_SIZE } from "@/assets/bundled";

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

  it("낙하는 헤드스타트로 시작 속도를 갖는다 — 위에서 머무는 구간이 없다", () => {
    // 초속 0 이던 1-p² 는 앞 절반에 25% 만 내려와 화면 위에서 어물거렸다.
    const firstHalfRatio = (fallLiftPx(0, 128) - fallLiftPx(0.5, 128)) / 128;
    expect(firstHalfRatio).toBeGreaterThan(0.35);
    // 첫 프레임부터 눈에 보이게 움직인다(60fps 기준 620ms 의 한 프레임 ≈ p 0.027).
    expect(fallLiftPx(0.027, 128)).toBeLessThan(126);
    // 그래도 단조 하강이고 가속이 유지된다.
    expect(fallLiftPx(0.75, 128)).toBeLessThan(fallLiftPx(0.5, 128));
    expect(hopSpeedRatio(fallHop({}), 1)).toBeGreaterThan(hopSpeedRatio(fallHop({}), 0));
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

  it("높이가 커지면 먼지 구름도 커진다 — 흔들림·소리와 같은 세기를 쓴다", () => {
    const low = landingImpactPlan(fallHop({ heightPx: TILE_SIZE + 2 }));
    const high = landingImpactPlan(fallHop({}));
    // 하한 바로 위(18px)는 기존 크기에서 거의 안 움직이고, 포화(4 칸) 이상은 뚜렷하게 크다.
    expect(low?.dustEndScale).toBeGreaterThanOrEqual(1.6);
    expect(low?.dustEndScale).toBeLessThan(1.7);
    expect(low?.dustRingEndScale).toBeGreaterThanOrEqual(2.6);
    expect(low?.dustRingEndScale).toBeLessThan(2.75);
    expect(high?.dustEndScale).toBeCloseTo(2.6, 6);
    expect(high?.dustRingEndScale).toBeCloseTo(4.4, 6);
    // 링은 항상 코어보다 넓다 — 두 겹이 구분돼야 터지는 타이밍이 보인다.
    expect(high?.dustRingEndScale).toBeGreaterThan(high?.dustEndScale ?? 0);
    // 4 칸에서 포화하므로 8 칸과 12 칸은 같다.
    expect(landingImpactPlan(fallHop({ heightPx: TILE_SIZE * 12 }))?.dustEndScale).toBeCloseTo(2.6, 6);
  });

  it("모션 축소 환경에서는 흔들림·먼지를 버리고 소리만 남긴다", () => {
    const plan = landingImpactPlan(fallHop({}), { reducedMotion: true });
    expect(plan).toMatchObject({ shakeMs: 0, shakeRatio: 0, dust: false, se: DEFAULT_LANDING_SE });
    // 먼지를 안 낼 때 크기는 0 이다 — 호출부가 실수로 스프라이트를 만들지 않게.
    expect(plan?.dustEndScale).toBe(0);
    expect(plan?.dustRingEndScale).toBe(0);
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

  it("기준 높이를 주면 그 높이 전 구간에서 그림자가 자란다", () => {
    // 회귀: 기준이 없으면 128px 낙하의 중반(64px)이 이미 포화라 "다가온다" 를 못 준다.
    expect(shadowScaleForLift(64)).toBe(shadowScaleForLift(128));
    // 기준을 주면 중반이 최소·최대 사이에 있다.
    const mid = shadowScaleForLift(64, 128);
    expect(mid).toBeGreaterThan(shadowScaleForLift(128, 128));
    expect(mid).toBeLessThan(shadowScaleForLift(0, 128));
    expect(shadowAlphaForLift(64, 128)).toBeGreaterThan(shadowAlphaForLift(128, 128));
    // 기준이 기본 페이드 범위보다 작으면(제자리 홉) 기존 곡선과 값이 같다.
    expect(shadowScaleForLift(8, 12)).toBe(shadowScaleForLift(8));
  });
});

describe("hop squash and stretch", () => {
  it("빠를 때 세로로 늘고, 착지에서 납작해진다", () => {
    const fall = fallHop({});
    const start = hopStretchScale(fall, 0);
    const impact = hopStretchScale(fall, 1);
    expect(start.y).toBeGreaterThan(1);
    expect(impact.y).toBeGreaterThan(start.y);
    // 세로로 늘린 만큼 가로는 줄어든다 — 부피가 유지되는 것처럼 보이게.
    expect(impact.x).toBeLessThan(1);

    const squash = hopLandingSquashScale(fall);
    expect(squash.y).toBeLessThan(1);
    expect(squash.x).toBeGreaterThan(1);
  });

  it("점프는 이·착지에서 늘고 최고점에서 중립이다", () => {
    const jump = jumpHop({ heightPx: 48 });
    expect(hopSpeedRatio(jump, 0.5)).toBe(0);
    expect(hopStretchScale(jump, 0.5)).toEqual({ x: 1, y: 1 });
    expect(hopStretchScale(jump, 0).y).toBeGreaterThan(1);
    expect(hopStretchScale(jump, 1).y).toBeGreaterThan(1);
  });

  it("낮은 홉은 거의 늘어나지 않는다", () => {
    // 기본 제자리 홉(12px)은 3 칸 게이트의 1/4 이라 과장되지 않는다.
    const small = hopStretchScale(jumpHop({}), 0);
    expect(small.y).toBeGreaterThan(1);
    expect(small.y).toBeLessThan(1.06);
    expect(hopLandingSquashScale(jumpHop({ heightPx: 0 }))).toEqual({ x: 1, y: 1 });
  });

  it("스케일은 기준 배율에 곱해서 얹는다 — 저작 배율이 살아남는다", () => {
    const calls: Array<readonly [number, number]> = [];
    const sprite = {
      scaleX: 2,
      scaleY: 2,
      setOrigin: () => undefined,
      setScale(x: number, y: number) {
        calls.push([x, y]);
      },
    };
    const base = hopBaseScaleOf(sprite);
    expect(base).toEqual({ x: 2, y: 2 });
    applyHopScale(sprite, base, { x: 0.9, y: 1.2 });
    expect(calls.at(-1)).toEqual([1.8, 2.4]);
    // setScale 이 없는 목 스프라이트에서는 조용히 빠진다(리프트만 남는다).
    expect(() => applyHopScale({ setOrigin: () => undefined }, base, { x: 1, y: 1 })).not.toThrow();
  });
});

describe("hop perspective scale", () => {
  it("높을 때 크고, 접지에서 정확히 1 로 닫힌다", () => {
    // 기본 낙하 높이(8 칸) = 낙하 게이트 상한이라 시작 배율이 정확히 ×3 이다.
    const fall = fallHop({ heightPx: DEFAULT_FALL_HEIGHT_PX });
    expect(hopPerspectiveScale(fall, DEFAULT_FALL_HEIGHT_PX)).toEqual({
      x: 1 + FALL_PERSPECTIVE_MAX,
      y: 1 + FALL_PERSPECTIVE_MAX,
    });
    expect(hopPerspectiveScale(fall, 0)).toEqual({ x: 1, y: 1 });
    // 정규화 리프트에 선형 — 절반 높이면 증가분도 절반이다.
    const half = hopPerspectiveScale(fall, DEFAULT_FALL_HEIGHT_PX / 2);
    expect(half.y).toBeCloseTo(1 + FALL_PERSPECTIVE_MAX / 2, 6);
    // 원근은 등방 확대다 — 스트레치처럼 가로를 줄이지 않는다.
    expect(half.x).toBe(half.y);
  });

  it("낮게 저작한 낙하는 그만큼 비례해 덜 받는다 — 2 칸 낙하가 ×3 으로 부풀지 않는다", () => {
    const shallow = fallHop({ heightPx: TILE_SIZE * 2 });
    // 8 칸 게이트의 1/4 이라 시작 배율은 1 + 2×0.25 = 1.5 다.
    expect(hopPerspectiveScale(shallow, TILE_SIZE * 2).y).toBeCloseTo(1 + FALL_PERSPECTIVE_MAX * 0.25, 6);
  });

  it("점프는 낙하보다 훨씬 약한 원근을 받는다 — 뛸 때마다 화면이 줌하지 않게", () => {
    // 같은 4 칸 높이라도 점프는 점프 상수(0.35/4 칸), 낙하는 낙하 상수(2/8 칸) 를 쓴다.
    const height = TILE_SIZE * 4;
    expect(hopPerspectiveScale(jumpHop({ heightPx: height }), height).y).toBeCloseTo(1 + HOP_PERSPECTIVE_MAX, 6);
    expect(hopPerspectiveScale(fallHop({ heightPx: height }), height).y).toBeCloseTo(
      1 + FALL_PERSPECTIVE_MAX * 0.5,
      6
    );
  });

  it("리프트가 범위를 벗어나도 배율은 1..1+MAX 안에 머문다", () => {
    const fall = fallHop({ heightPx: DEFAULT_FALL_HEIGHT_PX });
    expect(hopPerspectiveScale(fall, -10)).toEqual({ x: 1, y: 1 });
    expect(hopPerspectiveScale(fall, 999).y).toBeCloseTo(1 + FALL_PERSPECTIVE_MAX, 6);
    // 높이 0 인 홉은 0 으로 나누지 않고 중립을 낸다.
    expect(hopPerspectiveScale(fallHop({ heightPx: 0 }), 0)).toEqual({ x: 1, y: 1 });
  });

  it("낮은 홉은 원근을 거의 안 받는다 — 제자리 점프가 줌처럼 보이지 않게", () => {
    // 기본 제자리 홉(12px)은 4 칸 게이트의 3/16 이라 최고점에서도 7% 밑이다.
    const jump = jumpHop({});
    const apex = hopPerspectiveScale(jump, DEFAULT_JUMP_PEAK_PX);
    expect(apex.y).toBeGreaterThan(1);
    expect(apex.y).toBeLessThan(1.07);
  });

  it("체공 배율은 스트레치 × 원근이고, 낙하 동안 단조 감소한다", () => {
    const fall = fallHop({ heightPx: 64 });
    const start = hopAirScale(fall, 0);
    expect(start.y).toBeCloseTo(hopStretchScale(fall, 0).y * hopPerspectiveScale(fall, 64).y, 6);
    // 원근이 가로를 밀어 올려서, 시작 프레임은 스트레치만 있을 때와 달리 가로도 1 보다 크다.
    expect(hopStretchScale(fall, 0).x).toBeLessThan(1);
    expect(start.x).toBeGreaterThan(1);
    // 떨어지는 동안 계속 작아진다 — "가까이 있던 것이 멀어진다" 가 아니라 원근이 풀리는 것.
    const samples = [0, 0.25, 0.5, 0.75, 1].map((p) => hopAirScale(fall, p).y);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeLessThan(samples[index - 1]);
    }
    // 접지 프레임은 스트레치만 남는다(원근 1) — 착지 스쿼시가 접지 크기에서 시작한다.
    expect(hopAirScale(fall, 1)).toEqual(hopStretchScale(fall, 1));
  });
});
