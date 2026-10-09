import { describe, expect, it } from "vitest";
import { BATTLE_LOGICAL_HEIGHT, BATTLE_LOGICAL_WIDTH, calculateBattleStageScale } from "../src/player/battleStageScale";

describe("calculateBattleStageScale", () => {
  it.each([
    [640, 480, 1], [1280, 960, 2], [320, 240, 0.5],
    [640, 360, 0.75], [426, 240, 0.5], [256, 192, 0.4], [1000, 750, 1.5625],
  ])("fits %s×%s without shrinking to a half-step or cropping", (width, height, expected) => {
    const scale = calculateBattleStageScale(width, height);
    expect(scale).toBeCloseTo(expected);
    const drawnWidth = scale * BATTLE_LOGICAL_WIDTH;
    const drawnHeight = scale * BATTLE_LOGICAL_HEIGHT;
    expect(drawnWidth).toBeLessThanOrEqual(width);
    expect(drawnHeight).toBeLessThanOrEqual(height);
    expect(Math.min(width - drawnWidth, height - drawnHeight)).toBeCloseTo(0);
  });

  it.each([0, -10, NaN, Infinity])("uses a safe scale for invalid dimensions %s", value => {
    expect(calculateBattleStageScale(value, 480)).toBe(1);
    expect(calculateBattleStageScale(640, value)).toBe(1);
  });
});
