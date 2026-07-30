import { describe, expect, it } from "vitest";
import { viewportCenterWorld, type CameraViewport } from "@/editor/cameraStability";

/**
 * Phaser Camera.centerOn(x, y) 의 역연산:
 *   scrollX = x - (width / 2) / zoom
 * 리사이즈 후 centerOn(focal) 을 적용했을 때 새 뷰포트의 중심이 focal 과 일치하는지(= 중심 보존) 검증.
 */
function centerOnScroll(focal: { x: number; y: number }, width: number, height: number, zoom: number) {
  return {
    scrollX: focal.x - width / (2 * zoom),
    scrollY: focal.y - height / (2 * zoom),
  };
}

describe("cameraStability — viewport center preservation on resize", () => {
  it("computes the viewport center world point at zoom 1", () => {
    const center = viewportCenterWorld({ scrollX: 100, scrollY: 50, width: 800, height: 600, zoom: 1 });
    expect(center).toEqual({ x: 500, y: 350 });
  });

  it("scales the visible span by zoom (center = scroll + size/(2*zoom))", () => {
    const center = viewportCenterWorld({ scrollX: 0, scrollY: 0, width: 800, height: 600, zoom: 2 });
    // 800/(2*2)=200, 600/(2*2)=150
    expect(center).toEqual({ x: 200, y: 150 });
  });

  it("guards zoom<=0 against divide-by-zero by treating it as 1", () => {
    const center = viewportCenterWorld({ scrollX: 10, scrollY: 20, width: 400, height: 200, zoom: 0 });
    expect(center).toEqual({ x: 210, y: 120 });
    expect(Number.isFinite(center.x)).toBe(true);
    expect(Number.isFinite(center.y)).toBe(true);
  });

  it("preserves the exact center when the viewport shrinks (AI panel opens on the side)", () => {
    // 리사이즈 전: scroll 100, 폭 1200 → 중심 700
    const before: CameraViewport = { scrollX: 100, scrollY: 80, width: 1200, height: 600, zoom: 1 };
    const focal = viewportCenterWorld(before);
    expect(focal).toEqual({ x: 700, y: 380 });

    // 사이드 패널이 열려 폭이 800 로 줄었다고 가정. centerOn(focal) 후 새 scroll:
    const after = centerOnScroll(focal, 800, 600, 1);
    const afterCenter = viewportCenterWorld({ scrollX: after.scrollX, scrollY: after.scrollY, width: 800, height: 600, zoom: 1 });
    expect(afterCenter).toEqual(focal);
  });

  it("preserves the center across an asymmetric width-only shrink", () => {
    const before: CameraViewport = { scrollX: 240, scrollY: 0, width: 960, height: 540, zoom: 1 };
    const focal = viewportCenterWorld(before);

    const after = centerOnScroll(focal, 640, 540, 1);
    const afterCenter = viewportCenterWorld({ scrollX: after.scrollX, scrollY: after.scrollY, width: 640, height: 540, zoom: 1 });
    expect(afterCenter).toEqual(focal);
    expect(Math.abs(afterCenter.x - focal.x)).toBeLessThan(1e-9);
  });

  it("preserves the center at zoom 2 across a resize", () => {
    const before: CameraViewport = { scrollX: 0, scrollY: 0, width: 1600, height: 1000, zoom: 2 };
    const focal = viewportCenterWorld(before); // (400, 250)

    const after = centerOnScroll(focal, 1000, 600, 2);
    const afterCenter = viewportCenterWorld({ scrollX: after.scrollX, scrollY: after.scrollY, width: 1000, height: 600, zoom: 2 });
    expect(afterCenter).toEqual(focal);
  });
});
