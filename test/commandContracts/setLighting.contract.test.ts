import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("setLighting 계약", () => {
  it("transitionMs가 없거나 0이면 세션 조명을 즉시 변경한다", () => {
    const result = runCommandContract([
      { kind: "setLighting", ambient: 0.85, color: "#111111" },
      { kind: "setLighting", ambient: 0.25, transitionMs: 0 },
    ]);

    expect(result.session.lighting).toEqual({ ambient: 0.25, sources: [] });
    expect(result.pauses).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("transitionMs가 양수이면 플레이어 계층으로 blocking step을 넘긴다", () => {
    const result = runCommandContract([
      { kind: "setLighting", ambient: 0.9, color: "#000000", transitionMs: 320 },
    ]);

    expect(result.pauses).toEqual([
      { kind: "setLighting", ambient: 0.9, color: "#000000", transitionMs: 320 },
    ]);
    expect(result.session.lighting).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 명령 shape가 보존된다", () => {
    const commands: Command[] = [
      { kind: "setLighting", ambient: 0.75, color: "#101820", transitionMs: 160 },
    ];

    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
