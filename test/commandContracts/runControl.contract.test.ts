import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("runControl contract", () => {
  it("runs start, flag, room reset, floor advance, and completion in order", () => {
    const commands: Command[] = [
      { kind: "runControl", action: "start", seed: 42, runId: "contract-run", startFloor: 2 },
      { kind: "runControl", action: "setFlag", flag: "bossDoor", value: true },
      { kind: "runControl", action: "resetRoom" },
      { kind: "runControl", action: "resetRoom", roomId: "room-a" },
      { kind: "runControl", action: "advance", amount: 3 },
      { kind: "runControl", action: "end", result: "completed" },
    ];

    const result = runCommandContract(commands);

    expect(result.session.roguelikeRun).toEqual({
      version: 1,
      runId: "contract-run",
      seed: 42,
      floor: 5,
      status: "completed",
      flags: { bossDoor: true },
      roomResetCounts: { [result.session.currentMapId]: 1, "room-a": 1 },
    });
    expect(result.pauses).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("ignores mutations when no active run exists and continues", () => {
    const result = runCommandContract([
      { kind: "runControl", action: "advance", amount: 1 },
      { kind: "runControl", action: "setFlag", flag: "ignored", value: true },
      { kind: "runControl", action: "end", result: "failed" },
    ]);

    expect(result.session.roguelikeRun).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("preserves every action variant through project serialization", () => {
    const commands: Command[] = [
      { kind: "runControl", action: "start", seed: 123, runId: "roundtrip", startFloor: 4 },
      { kind: "runControl", action: "advance", amount: 2 },
      { kind: "runControl", action: "setFlag", flag: "key", value: false },
      { kind: "runControl", action: "resetRoom", roomId: "room-b" },
      { kind: "runControl", action: "end", result: "abandoned" },
    ];

    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
