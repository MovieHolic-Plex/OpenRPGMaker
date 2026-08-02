import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import * as advanceModule from "@/battle/battleRuntimeAdvance";
import { deserialize } from "@/project/io";
import {
  createBattleSequencer,
  BATTLE_ACTING_MS,
  BATTLE_HITSTOP_MS,
  BATTLE_IMPACT_MS,
  BATTLE_RESULT_HOLD_MS,
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
    const motions: Array<string | undefined> = [];

    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => steps.push(state.step),
        onSyncView: () => steps.push("sync"),
        onDamageFeedback: () => steps.push("damage"),
        onActionMotion: (beat) => motions.push(beat ? `${beat.kind}:${beat.userMotion}/${beat.targetMotion}` : "clear"),
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
    // Approach beat: actor lunges, target idle.
    expect(motions[0]).toBe("approach:lunge/idle");

    // After acting hold → damage + hit-stop schedule
    queue.shift()?.callback();
    expect(steps).toContain("impact");
    expect(steps).toContain("damage");
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_HITSTOP_MS);
    // Impact beat: still lunged, knockback on connect (or idle if miss/zero damage).
    expect(motions.some((m) => m?.startsWith("impact:"))).toBe(true);

    // Hit-stop ends → impact dwell (recover), then enemy resolve chain
    queue.shift()?.callback();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_IMPACT_MS);
    expect(motions.some((m) => m === "recover:return/idle")).toBe(true);

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
    // Motion cleared after the action chain.
    expect(motions.at(-1)).toBe("clear");
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

  it("consumes strict setup and command timeline entries once without replay", () => {
    const project = deserialize(JSON.stringify(battleFixture));
    const burn = project.database.states.find((state) => state.id === "state_burn");
    if (!burn) throw new Error("missing fixture state");
    burn.runtimeEffects = { ...burn.runtimeEffects, hpDamagePercentPerTurn: 1 };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        stateIds: { actor_hero: ["state_burn"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    const consumed: number[] = [];
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: () => undefined,
        onSyncView: () => undefined,
        onDamageFeedback: () => undefined,
        onResultStage: () => undefined,
        onSequenceBusy: () => undefined,
        onTimelineEntry: (entry) => consumed.push(entry.sequence),
      },
      (callback) => {
        callback();
        return consumed.length + 1;
      },
      () => undefined,
    );
    const before = runtime.snapshot();
    expect(before.timeline.map((entry) => entry.kind)).toContain("stateUpkeep");
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot();
    const expected = after.timeline.map((entry) => entry.sequence);

    sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);
    sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);

    expect(consumed).toEqual(expected);
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
    // 인트로는 "○○이(가) 나타났다!" 배너 → 커맨드 프롬프트("무엇을 할까?") 순으로 흐른다.
    expect(introLines[0]).toContain("나타났다");
    expect(introLines.at(-1)).toMatch(/무엇을 할까|게이지/);
  });

  it("holds a terminal action outcome before replacing it with the result panel", () => {
    const runtime = createBattleRuntime({
      project: deserialize(JSON.stringify(battleFixture)),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      rng: () => 0,
    });
    untilActorCommand(runtime);
    const queue: Array<{ callback: () => void; delayMs: number }> = [];
    const delays: number[] = [];
    const lines: string[] = [];
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => lines.push(state.lines.join(" ")),
        onSyncView: () => undefined,
        onDamageFeedback: () => undefined,
        onResultStage: () => undefined,
        onSequenceBusy: () => undefined,
      },
      (callback, delayMs) => {
        delays.push(delayMs);
        queue.push({ callback, delayMs });
        return queue.length;
      },
      () => undefined,
    );

    const before = runtime.snapshot();
    runtime.performActorCommand({ kind: "escape" });
    const after = runtime.snapshot();
    sequencer.runAfterActorCommand({ kind: "escape" }, before, after);

    let guard = 0;
    while (queue.length > 0 && guard < 20) {
      queue.shift()?.callback();
      guard += 1;
    }

    expect(lines.some((line) => line.includes("무사히 후퇴했다"))).toBe(true);
    expect(delays).toContain(BATTLE_RESULT_HOLD_MS);
    expect(lines.at(-1)).toContain("무사히 후퇴했다");
    expect(queue).toHaveLength(0);
  });
});
