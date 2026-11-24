import { describe, expect, it } from "vitest";
import { advanceWeatherTransition, parseWeather, resolveMapWeather, fogOpacity, isWeatherActive, NO_WEATHER, stormFlashOpacity, weatherParticleCount } from "@/player/weather/weatherModel";
import { syncWeatherLayer, weatherRenderPlan } from "@/player/playSceneWeather";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { isolateTimers } from "./mergedTeardown";

describe("feature16WorldClimate", () => {
  isolateTimers();
  describe("feature16 map climate resolution", () => {
    it.each(["rain", "snow", "storm", "fog"])("suppresses %s indoors and restores the same global weather outside", (kind) => {
      const global = Object.freeze(parseWeather(`${kind},0.8`));
      expect(resolveMapWeather(global, { mode: "indoor" })).toEqual({ kind: "none", intensity: 0 });
      expect(resolveMapWeather(global)).toBe(global);
      expect(resolveMapWeather(global, { mode: "inherit" })).toBe(global);
      expect(resolveMapWeather(global, { mode: "fixed", weather: "snow", intensity: 0.2 })).toEqual({ kind: "snow", intensity: 0.2 });
      expect(global.kind).toBe(kind);
    });
    it("lets global transitions advance under the indoor override", () => {
      const transition = { from: parseWeather("rain,0.2"), to: parseWeather("snow,0.8"), elapsedMs: 0, durationMs: 1000 };
      const halfway = advanceWeatherTransition(transition, 500);
      expect(resolveMapWeather(halfway.params, { mode: "indoor" }).intensity).toBe(0);
      const final = advanceWeatherTransition(transition, 500);
      expect(resolveMapWeather(final.params)).toEqual(parseWeather("snow,0.8"));
      expect(final.done).toBe(true);
    });
  });
  it("actual layer hides immediately on entry and restores without touching session weather", () => {
    let visible = false;
    const graphics: object = new Proxy({}, { get: () => () => graphics });
    const scene = {
      map: { climate: { mode: "indoor" } }, session: { m2Runtime: { screen: { weather: "rain,0.8" } } },
      // 층은 이제 줌·밀도를 상쇄하려 위치·배율도 맞춘다(playSceneWeather syncWeatherLayer) — 대역도 그 두 메서드를 받는다.
      weatherLayer: { setVisible: (next: boolean) => { visible = next; }, setPosition: () => undefined, setScale: () => undefined }, weatherGraphics: graphics,
      weatherClockMs: 0, weatherTransition: null,
      cameras: { main: { width: 320, height: 240 } },
    } as unknown as PlaySceneContext;
    syncWeatherLayer(scene); expect(visible).toBe(false);
    scene.map.climate = undefined;
    syncWeatherLayer(scene); expect(visible).toBe(true);
    expect(scene.session.m2Runtime?.screen.weather).toBe("rain,0.8");
  });
});

describe("weatherModel", () => {
  isolateTimers();
  describe("parseWeather", () => {
    it("none/빈값/미지정은 날씨 없음", () => {
      expect(parseWeather("none")).toEqual(NO_WEATHER);
      expect(parseWeather("")).toEqual(NO_WEATHER);
      expect(parseWeather(undefined)).toEqual(NO_WEATHER);
    });

    it("종류만 있으면 기본 강도 0.5", () => {
      expect(parseWeather("rain")).toEqual({ kind: "rain", intensity: 0.5 });
      expect(parseWeather("storm")).toEqual({ kind: "storm", intensity: 0.5 });
      expect(parseWeather("snow")).toEqual({ kind: "snow", intensity: 0.5 });
      expect(parseWeather("fog")).toEqual({ kind: "fog", intensity: 0.5 });
    });

    it("0~10 눈금 강도를 0~1 로 정규화", () => {
      expect(parseWeather("rain,8")).toEqual({ kind: "rain", intensity: 0.8 });
      expect(parseWeather("snow 10")).toEqual({ kind: "snow", intensity: 1 });
    });

    it("이미 0~1 소수면 그대로 강도", () => {
      expect(parseWeather("fog,0.4")).toEqual({ kind: "fog", intensity: 0.4 });
    });

    it("강도 0 이면 날씨 없음", () => {
      expect(parseWeather("rain,0")).toEqual(NO_WEATHER);
    });

    it("한국어 별칭 지원", () => {
      expect(parseWeather("비")).toEqual({ kind: "rain", intensity: 0.5 });
      expect(parseWeather("폭풍,7")).toEqual({ kind: "storm", intensity: 0.7 });
      expect(parseWeather("눈,3")).toEqual({ kind: "snow", intensity: 0.3 });
      expect(parseWeather("안개")).toEqual({ kind: "fog", intensity: 0.5 });
    });
  });
  describe("weatherParticleCount", () => {
    it("강도에 비례한 파티클 수(rain/snow)", () => {
      expect(weatherParticleCount({ kind: "rain", intensity: 1 }, 80)).toBe(80);
      expect(weatherParticleCount({ kind: "storm", intensity: 0.5 }, 80)).toBe(40);
      expect(weatherParticleCount({ kind: "rain", intensity: 0.5 }, 80)).toBe(40);
    });

    it("활성 상태면 최소 1개", () => {
      expect(weatherParticleCount({ kind: "snow", intensity: 0.001 }, 80)).toBe(1);
    });

    it("안개/없음은 파티클 0", () => {
      expect(weatherParticleCount({ kind: "fog", intensity: 1 }, 80)).toBe(0);
      expect(weatherParticleCount(NO_WEATHER, 80)).toBe(0);
    });
  });
  describe("stormFlashOpacity", () => {
    it("RNG 없이 timeMs와 intensity만으로 결정론적 flash를 계산한다", () => {
      const params = { kind: "storm" as const, intensity: 0.8 };
      const seriesA = [0, 120, 290, 1000, 2520].map((timeMs) => stormFlashOpacity(params, timeMs));
      const seriesB = [0, 120, 290, 1000, 2520].map((timeMs) => stormFlashOpacity(params, timeMs));

      expect(seriesA).toEqual(seriesB);
      expect(stormFlashOpacity(params, 120)).toBeGreaterThan(0);
      expect(stormFlashOpacity(params, 1000)).toBe(0);
    });
  });
  describe("fogOpacity / isWeatherActive", () => {
    it("안개 강도에 따라 불투명도(상한 0.6)", () => {
      expect(fogOpacity({ kind: "fog", intensity: 1 })).toBe(0.6);
      expect(fogOpacity({ kind: "rain", intensity: 1 })).toBe(0);
    });

    it("활성 판정", () => {
      expect(isWeatherActive({ kind: "rain", intensity: 0.5 })).toBe(true);
      expect(isWeatherActive(NO_WEATHER)).toBe(false);
    });
  });
  describe("Phaser weather render contract", () => {
    it("drives precipitation, fog, visibility, and deterministic storm flash from the model", () => {
      expect(weatherRenderPlan({ kind: "rain", intensity: 0.5 }, 0, 96)).toMatchObject({
        active: true,
        kind: "rain",
        particleCount: 48,
        fogOpacity: 0,
        stormFlashOpacity: 0,
      });
      expect(weatherRenderPlan({ kind: "snow", intensity: 0.25 }, 0, 96)).toMatchObject({
        active: true,
        kind: "snow",
        particleCount: 24,
      });
      expect(weatherRenderPlan({ kind: "fog", intensity: 1 }, 0, 96)).toMatchObject({
        active: true,
        kind: "fog",
        particleCount: 0,
        fogOpacity: 0.6,
      });
      expect(weatherRenderPlan({ kind: "storm", intensity: 0.8 }, 120, 96).stormFlashOpacity).toBeGreaterThan(0);
      expect(weatherRenderPlan(NO_WEATHER, 0, 96)).toEqual({
        active: false,
        kind: "none",
        particleCount: 0,
        fogOpacity: 0,
        stormFlashOpacity: 0,
      });
    });
  });
});
