import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("addLight 계약", () => {
  it("같은 id의 광원을 교체하고 값 범위를 정규화한다", () => {
    const result = runCommandContract([
      { kind: "addLight", source: { id: "lamp", at: { x: 1, y: 2 }, radius: 3, intensity: 0.5 } },
      { kind: "addLight", source: { id: "lamp", at: "player", radius: 4, intensity: 2, flicker: true } },
    ]);

    expect(result.session.lighting).toEqual({
      ambient: 0,
      sources: [{ id: "lamp", at: "player", radius: 4, intensity: 1, flicker: true }],
    });
    expect(result.pauses).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 player/event/position anchor가 보존된다", () => {
    const commands: Command[] = [
      { kind: "addLight", source: { id: "flashlight", at: "player", radius: 5, intensity: 1 } },
      { kind: "addLight", source: { id: "eventLamp", at: { eventId: "ev_contract" }, radius: 2 } },
      { kind: "addLight", source: { id: "floor", at: { x: 3, y: 4 }, radius: 1.5, color: "#ffaa66" } },
    ];

    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
