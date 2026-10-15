// poke-depth PR5: 날씨. 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import { normalizeSkillWeather, weatherDamagePercent, weatherResidualDamage, weatherResidualLine } from "@/battle/weather";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";

describe("normalizeSkillWeather", () => {
  it("drops unknown kinds and non-objects", () => {
    expect(normalizeSkillWeather(undefined)).toBeUndefined();
    expect(normalizeSkillWeather("rain")).toBeUndefined();
    expect(normalizeSkillWeather({ kind: "fog" })).toBeUndefined();
  });
  it("clamps turns to 3..8 and omits the default 5", () => {
    expect(normalizeSkillWeather({ kind: "rain" })).toEqual({ kind: "rain" });
    expect(normalizeSkillWeather({ kind: "rain", turns: 5 })).toEqual({ kind: "rain" });
    expect(normalizeSkillWeather({ kind: "hail", turns: 1 })).toEqual({ kind: "hail", turns: 3 });
    expect(normalizeSkillWeather({ kind: "sun", turns: 99 })).toEqual({ kind: "sun", turns: 8 });
  });
  it("is omitted from skill records that do not set it (unchanged bytes)", () => {
    expect("weather" in normalizeSkillRecord({ id: "s", name: "s" })).toBe(false);
    expect(normalizeSkillRecord({ id: "s", name: "s", weather: { kind: "sandstorm", turns: 3 } }).weather).toEqual({ kind: "sandstorm", turns: 3 });
  });
});

describe("weather effects", () => {
  it("sun and rain swap fire and water", () => {
    expect(weatherDamagePercent("sun", "fire")).toBe(150);
    expect(weatherDamagePercent("sun", "water")).toBe(50);
    expect(weatherDamagePercent("rain", "water")).toBe(150);
    expect(weatherDamagePercent("rain", "fire")).toBe(50);
    expect(weatherDamagePercent("rain", "grass")).toBe(100);
    expect(weatherDamagePercent("sandstorm", "fire")).toBe(100);
    expect(weatherDamagePercent(undefined, "fire")).toBe(100);
    expect(weatherDamagePercent("sun", undefined)).toBe(100);
  });
  it("sandstorm and hail deal 1/16 (min 1) except to immune types", () => {
    expect(weatherResidualDamage("sandstorm", 160, ["normal"])).toBe(10);
    expect(weatherResidualDamage("sandstorm", 5, ["normal"])).toBe(1);
    expect(weatherResidualDamage("sandstorm", 160, ["rock", "water"])).toBe(0);
    expect(weatherResidualDamage("sandstorm", 160, ["ground"])).toBe(0);
    expect(weatherResidualDamage("hail", 160, ["ice"])).toBe(0);
    expect(weatherResidualDamage("hail", 160, ["rock"])).toBe(10);
    expect(weatherResidualDamage("rain", 160, ["normal"])).toBe(0);
    expect(weatherResidualDamage(undefined, 160, ["normal"])).toBe(0);
  });
  it("uses the right josa in the residual line", () => {
    expect(weatherResidualLine("sandstorm", "숯비늘")).toBe("숯비늘은 모래바람에 휩싸였다!");
    expect(weatherResidualLine("hail", "바람삐")).toBe("바람삐는 싸라기눈에 맞았다!");
  });
});
