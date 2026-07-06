import { describe, it, expect } from "vitest";
import {
  blindBars,
  mosaicBlockSize,
  mosaicCoverAlpha,
  parseTransitionKind,
  transitionProgress,
  usesOverlayTransition,
} from "@/player/transitions/transitionModel";

describe("parseTransitionKind", () => {
  it("알려진 종류만 통과, 그 외 기본 fade", () => {
    expect(parseTransitionKind("mosaic")).toBe("mosaic");
    expect(parseTransitionKind("blinds")).toBe("blinds");
    expect(parseTransitionKind("fade")).toBe("fade");
    expect(parseTransitionKind("bogus")).toBe("fade");
    expect(parseTransitionKind(undefined)).toBe("fade");
  });

  it("오버레이 연출 여부", () => {
    expect(usesOverlayTransition("mosaic")).toBe(true);
    expect(usesOverlayTransition("blinds")).toBe(true);
    expect(usesOverlayTransition("fade")).toBe(false);
  });
});

describe("transitionProgress", () => {
  it("0~1 정규화, duration<=0 이면 1", () => {
    expect(transitionProgress(0, 0)).toBe(1);
    expect(transitionProgress(250, 500)).toBe(0.5);
    expect(transitionProgress(999, 500)).toBe(1);
  });
});

describe("mosaic", () => {
  it("out 은 진행할수록 블록/덮힘 증가, in 은 감소", () => {
    expect(mosaicBlockSize(0, "out")).toBe(0);
    expect(mosaicBlockSize(1, "out")).toBe(48);
    expect(mosaicBlockSize(0, "in")).toBe(48);
    expect(mosaicBlockSize(1, "in")).toBe(0);
    expect(mosaicCoverAlpha(1, "out")).toBe(1);
    expect(mosaicCoverAlpha(1, "in")).toBe(0);
  });
});

describe("blindBars", () => {
  it("count 개의 막대, out 진행도만큼 두께 채움", () => {
    const bars = blindBars(1, "out", 4);
    expect(bars).toHaveLength(4);
    expect(bars[0]).toEqual({ top: 0, height: 0.25 });
    expect(bars[3]).toEqual({ top: 0.75, height: 0.25 });
  });

  it("out 진행도 0 이면 막대 두께 0", () => {
    const bars = blindBars(0, "out", 4);
    expect(bars.every((bar) => bar.height === 0)).toBe(true);
  });

  it("in 은 열림(진행할수록 두께 감소)", () => {
    const closed = blindBars(0, "in", 4);
    expect(closed[0]!.height).toBeCloseTo(0.25);
    const opened = blindBars(1, "in", 4);
    expect(opened.every((bar) => bar.height === 0)).toBe(true);
  });
});
