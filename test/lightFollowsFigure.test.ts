import { describe, expect, it } from "vitest";
import { lightingGradientParams, type LightingMaskContext } from "@/player/lighting";
import { lightAtTile, lightFalloffAt } from "@/project/lightingRules";
import { isNpcSight, withinSightRange } from "@/project/npcBehavior";
import type { LightingState } from "@/project/types";

const context = (resolveAnchor: LightingMaskContext["resolveAnchor"]): LightingMaskContext => ({
  viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0, resolveAnchor,
});
const lamp: LightingState = { ambient: 0.8, color: "#000000", sources: [{ id: "lamp", at: { eventId: "ev_guard" }, radius: 3.5, intensity: 0.8 }] };

describe("event-anchored light follows the figure", () => {
  it("dims with the carrier's opacity and goes out with it", () => {
    const at = (fade?: number) => () => ({ x: 4, y: 4, ...(fade === undefined ? {} : { fade }) });
    expect(lightingGradientParams(lamp, context(at())).gradients[0]?.intensity).toBeCloseTo(0.8);
    expect(lightingGradientParams(lamp, context(at(0.5))).gradients[0]?.intensity).toBeCloseTo(0.4);
    expect(lightingGradientParams(lamp, context(() => undefined)).gradients).toEqual([]);
    expect(lightAtTile(lamp, 4, 5, at(0))).toBe(false);
    expect(lightAtTile(lamp, 4, 5, at(1))).toBe(true);
  });
});

describe("hard-edged sight light and circular sight agree", () => {
  it("keeps the hard edge readable at the rim while the inside falls off like a lantern", () => {
    // 끝 가까이에도 빛이 남아 테두리가 읽힌다(부드러운 곡선은 거의 0).
    expect(lightFalloffAt(0.9, "hard")).toBeGreaterThan(0.2);
    expect(lightFalloffAt(0.9)).toBeLessThan(0.1);
    // 안쪽은 고른 판이 아니라 들고 있는 사람 곁이 밝다.
    expect(lightFalloffAt(0.1, "hard")).toBeGreaterThan(lightFalloffAt(0.5, "hard") * 2);
    // 안쪽 낙차(가운데 → 끝 띠 직전)가 끝 계단보다 훨씬 커야 판이 아니라 등불로 읽힌다.
    expect(lightFalloffAt(0.05, "hard") - lightFalloffAt(0.92, "hard")).toBeGreaterThan(lightFalloffAt(0.92, "hard") * 3);
    expect(lightFalloffAt(0.5, "hard")).toBeGreaterThan(lightFalloffAt(0.85, "hard"));
    // 끝 띠는 짧다 — 반지름 94% 너머에서 끊긴다.
    expect(lightFalloffAt(0.99, "hard")).toBeLessThan(0.05);
    const hard = lightingGradientParams({ ...lamp, sources: [{ ...lamp.sources[0]!, at: { x: 1, y: 1 }, edge: "hard" }] }, context((a) => (a === "player" || "eventId" in a ? undefined : a)));
    expect(hard.gradients[0]?.edge).toBe("hard");
  });

  it("circle sight sees exactly the cells whose centre is inside the range + 0.5 lamp", () => {
    const range = 3;
    for (let dx = -5; dx <= 5; dx += 1) for (let dy = -5; dy <= 5; dy += 1) {
      expect(withinSightRange(dx, dy, range, "circle")).toBe(Math.hypot(dx, dy) <= range + 0.5);
    }
    // 맨해튼은 빛 한가운데 대각선(2,2)을 못 보고, 원은 본다.
    expect(withinSightRange(2, 2, range, undefined)).toBe(false);
    expect(withinSightRange(2, 2, range, "circle")).toBe(true);
    expect(withinSightRange(3, 2, range, "circle")).toBe(false);
  });

  it("validates the sight shape", () => {
    expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "circle" })).toBe(true);
    expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "square" })).toBe(false);
  });
});
