// test/titleParticles.test.ts
// 타이틀 파티클 순수 모델 검증 — fakeDom 에는 canvas 2D API 가 없으므로
// 렌더러 대신 좌표 모델의 결정론/개수/경계를 직접 검증한다.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TITLE_PARTICLE_DENSITY,
  TITLE_FIREFLY_MAX,
  TITLE_PARTICLE_MAX,
  TITLE_PARTICLE_STAGE,
  createTitleParticlesCanvas,
  titleParticleCount,
  titleParticlePositions,
} from "@/player/titleParticles";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("title particle pure model", () => {
  it("is a deterministic function of (preset, density, t)", () => {
    const a = titleParticlePositions({ preset: "snow", density: 60 }, 1234);
    const b = titleParticlePositions({ preset: "snow", density: 60 }, 1234);
    expect(b).toEqual(a);

    const later = titleParticlePositions({ preset: "snow", density: 60 }, 1734);
    expect(later).not.toEqual(a);

    const fireA = titleParticlePositions({ preset: "fireflies", density: 100 }, 987);
    const fireB = titleParticlePositions({ preset: "fireflies", density: 100 }, 987);
    expect(fireB).toEqual(fireA);
  });

  it("maps density 0..100 to particle counts with the weather-model contract", () => {
    // 눈/비는 날씨 관례 상한 96 을 그대로 쓴다.
    expect(titleParticleCount("snow", 100)).toBe(TITLE_PARTICLE_MAX);
    expect(titleParticleCount("rain", 50)).toBe(TITLE_PARTICLE_MAX / 2);
    expect(titleParticleCount("snow", 0)).toBe(0);
    // 밀도 생략 = 기본 50.
    expect(titleParticleCount("snow", undefined)).toBe(
      titleParticleCount("snow", DEFAULT_TITLE_PARTICLE_DENSITY),
    );
    // 클램프: 0..100 밖 입력도 안전.
    expect(titleParticleCount("rain", 999)).toBe(TITLE_PARTICLE_MAX);
    expect(titleParticleCount("rain", -5)).toBe(0);
    // 반딧불은 별도 낮은 상한.
    expect(titleParticleCount("fireflies", 100)).toBe(TITLE_FIREFLY_MAX);
    expect(titleParticleCount("fireflies", 25)).toBe(Math.round(TITLE_FIREFLY_MAX * 0.25));
  });

  it("keeps every particle inside the extended 320x240 stage bounds over time", () => {
    const { width, height } = TITLE_PARTICLE_STAGE;
    for (const preset of ["snow", "rain", "fireflies"] as const) {
      for (const t of [0, 500, 5000, 123456]) {
        for (const point of titleParticlePositions({ preset, density: 100 }, t)) {
          // 눈/비는 화면 가장자리 밖 -16/-24 여유폭까지 허용(날씨 오버레이와 동일 눈금).
          expect(point.x).toBeGreaterThanOrEqual(-24);
          expect(point.x).toBeLessThanOrEqual(width + 24);
          expect(point.y).toBeGreaterThanOrEqual(-24);
          expect(point.y).toBeLessThanOrEqual(height + 24);
          expect(point.opacity).toBeGreaterThan(0);
          expect(point.opacity).toBeLessThanOrEqual(1);
          expect(point.size).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gives fireflies a visible pulse (opacity varies over time for the same particle)", () => {
    const at = (t: number): number => titleParticlePositions({ preset: "fireflies", density: 10 }, t)[0]?.opacity ?? 0;
    const samples = new Set([at(0), at(400), at(800), at(1200)]);
    expect(samples.size).toBeGreaterThan(1);
  });

  it("creates a canvas without starting rAF when no 2D context exists (fakeDom contract)", () => {
    const restoreDom = installFakeDom();
    try {
      const canvas = renderWithFakeDom(() =>
        createTitleParticlesCanvas({ preset: "rain", density: 30 }) as unknown as HTMLElement,
      );
      expect(canvas).toBeInstanceOf(FakeElement);
      expect(canvas.tagName).toBe("CANVAS");
      expect(findByTestId(canvas, "title-particles") ?? canvas).toBeTruthy();
      expect(canvas.dataset.testid).toBe("title-particles");
      expect(canvas.dataset.titleParticlePreset).toBe("rain");
      expect(canvas.dataset.titleParticleDensity).toBe("30");
    } finally {
      restoreDom();
    }
  });
});
