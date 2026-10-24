import { describe, expect, it } from "vitest";
import { calculateTouchLayout } from "@/player/playSurface";

const zero = { top: 0, right: 0, bottom: 0, left: 0 };

describe("calculateTouchLayout (mobile touch play, 2026-10-24)", () => {
  it.each([
    ["iPhone 15 Safari portrait", 393, 659, { top: 0, right: 0, bottom: 0, left: 0 }],
    ["iPhone top-level with home bar", 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }],
    ["Galaxy Z Fold 7 unfolded", 984, 1016, zero],
    ["Pixel 7 in the store iframe", 412, 795, zero],
  ])("portrait %s: stage on top, controls fully on screen below it", (_name, w, h, safe) => {
    const layout = calculateTouchLayout(w, h, 480, 270, safe);
    expect(layout.mode).toBe("portrait");
    const stageBottom = layout.stageTop + 270 * layout.scale;
    expect(layout.stageTop).toBeGreaterThanOrEqual(safe.top);
    // 조이스틱 위쪽(메뉴 줄 포함)은 무대 아래, 아래쪽은 안전 영역 위.
    expect(layout.controlsY - layout.stick / 2 - 44).toBeGreaterThanOrEqual(stageBottom - 0.5);
    expect(layout.controlsY + layout.stick / 2).toBeLessThanOrEqual(h - safe.bottom);
    expect(layout.stick).toBeGreaterThanOrEqual(112);
    expect(layout.stick).toBeLessThanOrEqual(136);
  });

  it.each([
    ["iPhone 15 landscape", 852, 393, { top: 0, right: 59, bottom: 21, left: 59 }],
    ["Pixel 7 landscape", 915, 412, zero],
  ])("landscape %s: stage between the side gutters", (_name, w, h, safe) => {
    const layout = calculateTouchLayout(w, h, 480, 270, safe);
    expect(layout.mode).toBe("landscape");
    expect(layout.stageLeft).toBeGreaterThanOrEqual(layout.gutter - 1);
    expect(layout.stageLeft + 480 * layout.scale).toBeLessThanOrEqual(w - layout.gutter + 1);
    expect(layout.stageTop + 270 * layout.scale).toBeLessThanOrEqual(h - safe.bottom + 0.5);
  });
});
