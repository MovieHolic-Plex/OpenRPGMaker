import { describe, it, expect } from "vitest";
import {
  fogOpacity,
  isWeatherActive,
  NO_WEATHER,
  parseWeather,
  stormFlashOpacity,
  weatherParticleCount,
} from "@/player/weather/weatherModel";

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
