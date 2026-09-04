import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultYieldToUi, YIELD_TO_UI_FALLBACK_MS } from "@/ai/yieldToUi";

describe("defaultYieldToUi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rAF가 멈춘 백그라운드 탭에서도 폴백 타임아웃 안에 resolve한다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);

    const start = Date.now();
    await defaultYieldToUi();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(YIELD_TO_UI_FALLBACK_MS - 20);
    expect(elapsed).toBeLessThan(YIELD_TO_UI_FALLBACK_MS + 5000);
  });

  it("rAF가 살아 있으면 폴백을 기다리지 않고 바로 resolve한다", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const start = Date.now();
    await defaultYieldToUi();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(YIELD_TO_UI_FALLBACK_MS);
  });
});
