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
    expect(layout.controlsY - layout.stick / 2 - 52).toBeGreaterThanOrEqual(stageBottom - 0.5);
    expect(layout.controlsY + layout.stick / 2).toBeLessThanOrEqual(h - safe.bottom);
    expect(layout.stick).toBeGreaterThanOrEqual(112);
    expect(layout.stick).toBeLessThanOrEqual(136);
  });

  it.each([
    ["iPhone 15 landscape", 852, 393, { top: 0, right: 59, bottom: 21, left: 59 }],
    ["Pixel 7 landscape", 915, 412, zero],
  ])("landscape %s: stage fills the height, controls overlay the edges", (_name, w, h, safe) => {
    const layout = calculateTouchLayout(w, h, 480, 270, safe);
    expect(layout.mode).toBe("landscape");
    expect(layout.stageLeft).toBeGreaterThanOrEqual(safe.left - 1);
    expect(layout.stageLeft + 480 * layout.scale).toBeLessThanOrEqual(w - safe.right + 1);
    expect(layout.stageTop + 270 * layout.scale).toBeLessThanOrEqual(h - safe.bottom + 0.5);
    // 화면 높이(안전 영역 뺀)를 채운다 — 예전에는 칸을 떼고 정수 1배라 79% 였다.
    expect(270 * layout.scale).toBeGreaterThanOrEqual((h - safe.top - safe.bottom) * 0.99);
  });

  it("portrait phones below 1x get the 320x300 window panel at 1x", () => {
    const layout = calculateTouchLayout(393, 659, 480, 270, zero, { scaleMode: "integer" });
    expect(layout.scale).toBeLessThan(1);
    expect(layout.panel?.scale).toBe(1);
    expect(layout.panel!.top).toBeGreaterThanOrEqual(layout.stageTop);
  });

  it("iPad mini uses the 1.5x step in portrait and landscape", () => {
    expect(calculateTouchLayout(768, 1024, 480, 270, zero, { scaleMode: "integer" }).scale).toBe(1.5);
    expect(calculateTouchLayout(1024, 768, 480, 270, zero, { scaleMode: "integer" }).scale).toBe(1.5);
    expect(calculateTouchLayout(1024, 768, 480, 270, zero, { scaleMode: "integer" }).panel).toBeNull();
  });

  // J33: 4:3 무대(320×240)는 폰 세로에서 1배를 넘어 예전엔 대사 독이 꺼지고 무대 아래 540px 가 비었다.
  it("4:3 stage above 1x on a portrait phone still docks the dialogue below the stage at stage scale", () => {
    const layout = calculateTouchLayout(390, 844, 320, 240, zero);
    expect(layout.scale).toBeGreaterThan(1);
    const stageBottom = layout.stageTop + 240 * layout.scale;
    expect(layout.dock).not.toBeNull();
    expect(layout.dock!.scale).toBeCloseTo(layout.scale);
    expect(layout.dock!.top).toBeGreaterThanOrEqual(stageBottom);
    // 독 아래에 조작(메뉴 줄 포함)이 그대로 들어간다.
    expect(layout.controlsY - layout.stick / 2 - 52).toBeGreaterThanOrEqual(layout.dock!.top + layout.dock!.height);
    expect(layout.controlsY + layout.stick / 2).toBeLessThanOrEqual(844);
  });
});
