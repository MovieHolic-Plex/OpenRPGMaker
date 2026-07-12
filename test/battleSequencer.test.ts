import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import * as advanceModule from "@/battle/battleRuntimeAdvance";
import { deserialize } from "@/project/io";
import {
  createBattleSequencer,
  BATTLE_ACTING_MS,
  BATTLE_HITSTOP_MS,
  BATTLE_IMPACT_MS,
  BATTLE_RESOLVE_MS,
} from "@/player/battleSequencer";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleRuntime() {
  return createBattleRuntime({
    project: deserialize(JSON.stringify(battleFixture)),
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    rng: () => 0.5,
  });
}

function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): void {
  for (let i = 0; i < maxTicks; i += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
  }
}

describe("battle sequencer", () => {
  let advanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    advanceSpy = vi.spyOn(advanceModule, "advanceBattleRuntime").mockImplementation((runtime) => {
      runtime.tick(1_000);
    });
  });

  afterEach(() => {
    advanceSpy.mockRestore();
  });

  it("delays advanceBattleRuntime until after acting and impact steps", () => {
    const runtime = battleRuntime();
    untilActorCommand(runtime);
    const queue: Array<{ callback: () => void; delayMs: number }> = [];
    const schedule = vi.fn((callback: () => void, delayMs: number) => {
      queue.push({ callback, delayMs });
      return queue.length;
    });
    const steps: string[] = [];

    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => steps.push(state.step),
        onSyncView: () => steps.push("sync"),
        onDamageFeedback: () => steps.push("damage"),
        onResultStage: () => undefined,
        onSequenceBusy: () => undefined,
      },
      schedule,
      () => undefined
    );

    const before = runtime.snapshot();
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot();
    sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);

    expect(advanceSpy).not.toHaveBeenCalled();
    expect(steps[0]).toBe("acting");
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_ACTING_MS);

    // After acting hold → damage + hit-stop schedule
    queue.shift()?.callback();
    expect(steps).toContain("impact");
    expect(steps).toContain("damage");
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_HITSTOP_MS);

    // Hit-stop ends → impact dwell, then enemy resolve chain
    queue.shift()?.callback();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_IMPACT_MS);

    let guard = 0;
    while (queue.length > 0 && guard < 10) {
      queue.shift()?.callback();
      guard += 1;
    }
    expect(advanceSpy).toHaveBeenCalled();
    const delays = schedule.mock.calls.map((call) => call[1] as number);
    expect(delays).toContain(BATTLE_ACTING_MS);
    expect(delays).toContain(BATTLE_HITSTOP_MS);
    expect(delays).toContain(BATTLE_IMPACT_MS);
    expect(delays).toContain(BATTLE_RESOLVE_MS);
  });

  it("finishes a player turn in charging director state until actorCommand returns", () => {
    advanceSpy.mockRestore();
    advanceSpy = vi.spyOn(advanceModule, "advanceBattleRuntime").mockImplementation(() => undefined);
    const runtime = battleRuntime();
    untilActorCommand(runtime);
    const queue: Array<{ callback: () => void; delayMs: number }> = [];
    let lastStep = "";
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => {
          lastStep = state.step;
        },
        onSyncView: () => undefined,
        onDamageFeedback: () => undefined,
        onResultStage: () => undefined,
        onSequenceBusy: () => undefined,
      },
      (callback, delayMs) => {
        queue.push({ callback, delayMs });
        return queue.length;
      },
      () => undefined
    );

    const before = runtime.snapshot();
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot();
    sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);

    while (queue.length > 0) {
      queue.shift()?.callback();
    }

    expect(runtime.snapshot().phase).toBe("charging");
    expect(lastStep).toBe("acting");
  });

  it("holds intro lines before releasing command prompt", () => {
    const runtime = battleRuntime();
    const introLines: string[] = [];
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => {
          introLines.push(state.lines[0] ?? "");
        },
        onSyncView: () => undefined,
        onDamageFeedback: () => undefined,
        onResultStage: () => undefined,
        onSequenceBusy: () => undefined,
      },
      (callback) => {
        callback();
        return 1;
      },
      () => undefined
    );

    sequencer.startIntro(runtime.snapshot());
    expect(introLines[0]).toContain("전투가 시작");
    expect(introLines.at(-1)).toContain("명령");
  });
});