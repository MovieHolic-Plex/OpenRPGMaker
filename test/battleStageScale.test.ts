// calculateBattleStageScale 회귀 테스트.
// 소수 배율 폴백은 0.5 단계로 양자화돼야 한다 — 임의 소수(예: 1.73)는 픽셀 폰트와
// 1-2px 창 테두리를 흐리게 만든다(디바이스 픽셀 격자에 걸리지 않는 배율).
import { describe, expect, it } from "vitest";
import {
  BATTLE_LOGICAL_HEIGHT,
  BATTLE_LOGICAL_WIDTH,
  calculateBattleStageScale,
} from "../src/player/battleStageScale";

describe("calculateBattleStageScale", () => {
  it("returns the exact integer when the container is an exact multiple of the logical stage", () => {
    expect(calculateBattleStageScale(640, 480)).toBe(1);
    expect(calculateBattleStageScale(1280, 960)).toBe(2);
    expect(calculateBattleStageScale(1920, 1440)).toBe(3);
  });

  it("keeps the integer when it fills at least 88% of the exact fit (boundary, just above)", () => {
    // exact = 727/640 ≈ 1.13594 → 1/exact ≈ 0.8804 ≥ 0.88 → 정수 1.
    expect(calculateBattleStageScale(727, 480)).toBe(1);
  });

  it("falls back to a fractional scale just below the 88% boundary", () => {
    // exact = 728/640 = 1.1375 → 1/exact ≈ 0.8791 < 0.88 → 소수 폴백.
    const scale = calculateBattleStageScale(728, 480);
    expect(scale).toBe(1); // 0.5 단계 양자화 후에도 1.0
  });

  it("quantizes fractional fallbacks to multiples of 0.5 that still fit the container", () => {
    const sizes: ReadonlyArray<readonly [number, number]> = [
      [1000, 750],
      [900, 700],
      [1100, 800],
      [780, 600],
      [1500, 1000],
      [655, 490],
      [703, 531],
    ];
    for (const [width, height] of sizes) {
      const scale = calculateBattleStageScale(width, height);
      expect(Number.isFinite(scale)).toBe(true);
      // 양자화: 0.5 의 배수여야 한다.
      expect((scale * 2) % 1).toBe(0);
      // 컨테이너를 넘치지 않아야 한다.
      expect(scale * BATTLE_LOGICAL_WIDTH).toBeLessThanOrEqual(width);
      expect(scale * BATTLE_LOGICAL_HEIGHT).toBeLessThanOrEqual(height);
    }
    // 대표 값 하나는 정확히 고정한다: 1000×750 → exact 1.5625 → 1.5 로 양자화.
    expect(calculateBattleStageScale(1000, 750)).toBe(1.5);
  });

  it("clamps to 0.5 when the container is smaller than the logical stage", () => {
    expect(calculateBattleStageScale(320, 240)).toBe(0.5);
  });

  it("returns a safe value for degenerate inputs", () => {
    expect(calculateBattleStageScale(0, 480)).toBe(1);
    expect(calculateBattleStageScale(640, 0)).toBe(1);
    expect(calculateBattleStageScale(-10, 480)).toBe(1);
    expect(calculateBattleStageScale(640, -10)).toBe(1);
    expect(calculateBattleStageScale(Number.NaN, 480)).toBe(1);
    expect(calculateBattleStageScale(640, Number.NaN)).toBe(1);
    expect(calculateBattleStageScale(Number.POSITIVE_INFINITY, 480)).toBe(1);
    expect(calculateBattleStageScale(640, Number.POSITIVE_INFINITY)).toBe(1);
  });
});
