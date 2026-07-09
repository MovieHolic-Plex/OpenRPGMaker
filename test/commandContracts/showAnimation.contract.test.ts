import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("showAnimation 계약", () => {
  it("대상/animationId/wait를 플레이어 계층 showAnimation step으로 넘긴다", () => {
    const result = runCommandContract([
      { kind: "showAnimation", target: { eventId: "ev_contract" }, animationId: "anim_hit", wait: true },
    ]);

    expect(result.pauses).toEqual([
      { kind: "showAnimation", target: { eventId: "ev_contract" }, animationId: "anim_hit", wait: true },
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: player/event/position target shape가 보존된다", () => {
    const commands: Command[] = [
      { kind: "showAnimation", target: "player", animationId: "anim_hit" },
      { kind: "showAnimation", target: { eventId: "ev_contract" }, animationId: "anim_sword", wait: true },
      { kind: "showAnimation", target: { x: 3, y: 4 }, animationId: "anim_magic" },
    ];

    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
