import { describe, expect, it } from "vitest";

import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import type { Command } from "@/project/types";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { advanceRoguelikeRunFloor, resetRoguelikeRunRoom, startRoguelikeRun } from "@/project/roguelikeRun";

type ExpectedRunState = {
  readonly version: 1;
  readonly runId: string;
  readonly seed: number;
  readonly floor: number;
  readonly status: "active" | "completed" | "failed" | "abandoned";
  readonly flags: Record<string, boolean>;
  readonly roomResetCounts: Record<string, number>;
};

type SessionWithRun = PlaySession & { roguelikeRun?: ExpectedRunState };

function asCommand(value: unknown): Command {
  return value as Command;
}

describe("roguelike run lifecycle", () => {
  it("executes start, flag, floor advance, run condition, and completion in one real event flow", () => {
    // Break named: an unknown runControl command currently terminates the interpreter without creating run state.
    const project = createBlankProject();
    const session = startSession(project, 99) as SessionWithRun;
    const commands = [
      asCommand({ kind: "runControl", action: "start", seed: 123, startFloor: 2 }),
      asCommand({ kind: "runControl", action: "setFlag", flag: "bossDoor", value: true }),
      asCommand({ kind: "runControl", action: "advance", amount: 2 }),
      asCommand({
        kind: "fork",
        condition: { kind: "run", query: "floor", op: ">=", value: 4 },
        then: [{ kind: "setSwitch", switchId: project.switches[0]!.id, value: true }],
      }),
      asCommand({ kind: "runControl", action: "end", result: "completed" }),
    ];

    expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
    expect(session.roguelikeRun).toEqual({
      version: 1,
      runId: "run-0000007b",
      seed: 123,
      floor: 4,
      status: "completed",
      flags: { bossDoor: true },
      roomResetCounts: {},
    });
    expect(session.switches[project.switches[0]!.id]).toBe(true);
  });

  it("preserves active run state through a save snapshot roundtrip", () => {
    // Break named: createSaveSnapshot omits run state, so applying the snapshot loses the active run.
    const project = createBlankProject();
    const session = startSession(project) as SessionWithRun;
    session.roguelikeRun = {
      version: 1,
      runId: "run-save",
      seed: 0xffff_ffff,
      floor: 7,
      status: "active",
      flags: { treasureTaken: true },
      roomResetCounts: { room_a: 2 },
    };

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session)) as SessionWithRun;

    expect(restored.roguelikeRun).toEqual(session.roguelikeRun);
  });

  it("treats advance as forward-only and records the current room id on reset", () => {
    const host: SessionWithRun = startSession(createBlankProject()) as SessionWithRun;
    startRoguelikeRun(host, { seed: 7, startFloor: 3 });

    expect(advanceRoguelikeRunFloor(host, -5)).toBe(true);
    expect(host.roguelikeRun?.floor).toBe(4);
    expect(resetRoguelikeRunRoom(host, " room-a ")).toBe(true);
    expect(host.roguelikeRun?.currentRoomId).toBe("room-a");
    expect(host.roguelikeRun?.roomResetCounts).toEqual({ "room-a": 1 });
  });
});
