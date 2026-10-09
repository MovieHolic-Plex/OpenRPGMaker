import { describe, expect, it } from "vitest";
import { applyEasing, EASING_NAMES, normalizeEasing, phaserEaseName } from "@/project/easing";
import { easedTweenProgress, tweenProgress } from "@/player/pictures/pictureTween";

describe("연출 이징", () => {
  it("모든 곡선은 0 에서 시작해 1 에서 끝난다 — 끝 판정이 곡선 때문에 어긋나지 않는다", () => {
    for (const name of EASING_NAMES) {
      expect(applyEasing(name, 0)).toBe(0);
      expect(applyEasing(name, 1)).toBeCloseTo(1, 10);
    }
  });

  it("곡선마다 중간 진행이 다르다(출발 느림 < 일정 < 멈춤 느림)", () => {
    expect(applyEasing("easeIn", 0.25)).toBeCloseTo(0.0625, 10);
    expect(applyEasing("linear", 0.25)).toBe(0.25);
    expect(applyEasing("easeOut", 0.25)).toBeCloseTo(0.4375, 10);
    expect(applyEasing("easeInOut", 0.5)).toBeCloseTo(0.5, 10);
    expect(applyEasing(undefined, 0.3)).toBe(0.3);
  });

  it("범위 밖·비정상 t 는 끝값으로 클램프한다", () => {
    expect(applyEasing("easeOut", -1)).toBe(0);
    expect(applyEasing("easeIn", 2)).toBe(1);
    expect(applyEasing("easeInOut", Number.NaN)).toBeCloseTo(1, 10);
  });

  it("linear 와 모르는 값은 저장하지 않는다 — 옛 JSON 바이트가 그대로다", () => {
    expect(normalizeEasing("linear")).toBeUndefined();
    expect(normalizeEasing("bounce")).toBeUndefined();
    expect(normalizeEasing(undefined)).toBeUndefined();
    expect(normalizeEasing("easeOut")).toBe("easeOut");
  });

  it("카메라는 같은 곡선의 Phaser 이름을 쓴다", () => {
    expect(phaserEaseName(undefined)).toBe("Linear");
    expect(phaserEaseName("easeIn")).toBe("Quad.easeIn");
    expect(phaserEaseName("easeOut")).toBe("Quad.easeOut");
    expect(phaserEaseName("easeInOut")).toBe("Sine.easeInOut");
  });

  it("그림 트윈은 시간으로 끝을 판정하고 곡선은 보간에만 건다", () => {
    const progress = tweenProgress(400, 1600);
    expect(progress).toBe(0.25);
    expect(easedTweenProgress(progress, "easeIn")).toBeCloseTo(0.0625, 10);
    expect(easedTweenProgress(tweenProgress(1600, 1600), "easeIn")).toBe(1);
  });
});
