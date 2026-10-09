import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("setWeather 계약", () => {
  it("세션 화면 날씨를 정규화하고 플레이어 계층 setWeather step을 낸다", () => {
    const result = runCommandContract([
      { kind: "setWeather", weather: "storm", intensity: 0.75, transitionMs: 240 },
    ]);

    expect(result.session.m2Runtime?.screen.weather).toBe("storm,0.75");
    expect(result.pauses).toEqual([
      { kind: "setWeather", weather: "storm", intensity: 0.75, transitionMs: 240 },
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 fog/none shape가 보존된다", () => {
    const commands: Command[] = [
      { kind: "setWeather", weather: "fog", intensity: 0.4, transitionMs: 160 },
      { kind: "setWeather", weather: "none", intensity: 0 },
    ];

    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
