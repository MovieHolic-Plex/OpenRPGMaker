/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPlaySurface } from "@/player/playSurface";

type ResizeCallback = () => void;

let resizeCallbacks: ResizeCallback[] = [];
let animationFrames: FrameRequestCallback[] = [];
let previousResizeObserver: typeof globalThis.ResizeObserver | undefined;
let previousRaf: typeof globalThis.requestAnimationFrame;
let previousCancelRaf: typeof globalThis.cancelAnimationFrame;

// 뷰포트 크기는 happy-dom 이 0 으로 보고한다. 실측한 테스트 플레이 창 본문(1214x640)을
// 직접 물려 스케일 계산 경로만 결정론적으로 굳힌다.
function stubViewportBounds(viewport: HTMLElement, width: number, height: number): void {
  Object.defineProperty(viewport, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

beforeEach(() => {
  resizeCallbacks = [];
  animationFrames = [];
  previousResizeObserver = globalThis.ResizeObserver;
  previousRaf = globalThis.requestAnimationFrame;
  previousCancelRaf = globalThis.cancelAnimationFrame;
  class TestResizeObserver {
    constructor(private readonly callback: ResizeCallback) {}
    observe(): void {
      resizeCallbacks.push(this.callback);
    }
    unobserve(): void {}
    disconnect(): void {
      resizeCallbacks = resizeCallbacks.filter((entry) => entry !== this.callback);
    }
  }
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof globalThis.ResizeObserver;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
});

afterEach(() => {
  if (previousResizeObserver) globalThis.ResizeObserver = previousResizeObserver;
  globalThis.requestAnimationFrame = previousRaf;
  globalThis.cancelAnimationFrame = previousCancelRaf;
});

describe("createPlaySurface scale mode", () => {
  it("keeps the integer scale by default for the shipped player", () => {
    const surface = createPlaySurface({ width: 320, height: 240 });
    stubViewportBounds(surface.viewport, 1214, 640);

    surface.sync();

    expect(surface.viewport.dataset.scale).toBe("2.000");
    expect(surface.viewport.style.getPropertyValue("--play-scale")).toBe("2");
    surface.cleanup();
  });

  it("fills the host with the unfloored contain scale in fit mode", () => {
    const surface = createPlaySurface({ width: 320, height: 240 }, "fit");
    stubViewportBounds(surface.viewport, 1214, 640);

    surface.sync();

    expect(Number(surface.viewport.dataset.scale)).toBeCloseTo(8 / 3, 3);
    expect(surface.viewport.style.getPropertyValue("--play-stage-top")).toBe("0px");
    surface.cleanup();
  });

  it("applies the fit mode on the initial animation-frame apply and on resize sync", () => {
    const surface = createPlaySurface({ width: 320, height: 240 }, "fit");
    stubViewportBounds(surface.viewport, 640, 480);

    // 최초 적용(requestAnimationFrame) 경로.
    expect(animationFrames).toHaveLength(1);
    for (const frame of animationFrames.splice(0)) frame(0);
    expect(Number(surface.viewport.dataset.scale)).toBeCloseTo(2, 3);

    // ResizeObserver 경로: 창을 늘리면 분수 배율도 그대로 반영돼야 한다.
    stubViewportBounds(surface.viewport, 1214, 640);
    expect(resizeCallbacks).toHaveLength(1);
    for (const callback of resizeCallbacks) callback();
    expect(Number(surface.viewport.dataset.scale)).toBeCloseTo(8 / 3, 3);

    surface.cleanup();
    expect(resizeCallbacks).toHaveLength(0);
  });
});
