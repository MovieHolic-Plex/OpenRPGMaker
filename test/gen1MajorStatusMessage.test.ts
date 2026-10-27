// gen1 주요 상태는 하나만 걸린다. 화상 중인 대상에게 마비 기술이 막히면
// 「효과가 없었다」는 빗나감으로 읽힌다. 이미 있는 상태 이름을 말한다.
import { afterEach, describe, expect, it } from "vitest";
import { createBattleRuntime, type BattleRuntime } from "@/battle/runtime";
import type { ActorCommand } from "@/battle/types";
import { createBattleSequencer } from "@/player/battleSequencer";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { store } from "@/project/store";
import type { ActorParameterKey, Project } from "@/project/types";

const previous = store.getCurrent();

afterEach(() => {
  store.replaceProject(previous);
});

function setActorParam(project: Project, key: ActorParameterKey, value: number): void {
  const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
  if (!actor) throw new Error("missing start actor");
  actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
}

function teachStatusMove(project: Project, id: string, name: string, stateId: string, kind: "support" | "damage"): void {
  const base = project.database.skills.find((skill) => skill.id === "skill_scarloxy_scratch");
  const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
  if (!base || !actor) throw new Error("missing scratch skill or start actor");
  project.database.skills.push({
    ...base,
    id,
    name,
    power: kind === "damage" ? 1 : 0,
    hitRate: 100,
    successRate: 100,
    mpCost: { flat: 0, percentMax: 0 },
    maxPp: 10,
    scope: "enemy",
    effect: kind === "damage" ? { kind: "damage", statistic: "attack", affects: "hp" } : { kind: "support" },
    stateEffects: [{ stateId, chance: 100, operation: "add" }],
  });
  actor.learnedSkills = [...actor.learnedSkills, { level: 1, skillId: id }];
}

function battle(troopId = "troop_pkmn_grass_a"): BattleRuntime {
  const project = createScarloxyPokemonDemoProject();
  teachStatusMove(project, "skill_test_burn_status", "확정 화상", "state_burn", "support");
  teachStatusMove(project, "skill_test_para_status", "확정 마비", "state_paralysis", "support");
  teachStatusMove(project, "skill_test_burn_hit", "약한 화상", "state_burn", "damage");
  for (const enemy of project.database.enemies) {
    if (!enemy.id.startsWith("enemy_pkmn_")) continue;
    enemy.stats = { ...enemy.stats, maxHp: 80, attack: 1, agility: 1, defense: 1 };
  }
  const actorId = project.system.startActorIds[0]!;
  setActorParam(project, "maxHp", 200);
  setActorParam(project, "defense", 200);
  setActorParam(project, "agility", 999);
  store.replaceProject(project);
  return createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    battleFlow: "strict",
    party: { levels: { [actorId]: 20 }, experience: {}, partyActorIds: [actorId] },
    rng: () => 0,
  });
}

/** 한 시퀀서가 타임라인을 이어서 읽는다. 호출마다 그 명령이 새로 남긴 문장만 돌려준다. */
function playback(runtime: BattleRuntime): (command: ActorCommand) => string[] {
  const queue: Array<() => void> = [];
  let lines: string[] = [];
  const sequencer = createBattleSequencer(
    runtime,
    {
      onDirectorState: (state) => lines.push(...state.lines),
      onSyncView: () => undefined,
      onDamageFeedback: () => undefined,
      onResultStage: () => undefined,
      onSequenceBusy: () => undefined,
    },
    (callback) => {
      queue.push(callback);
      return queue.length;
    },
    () => undefined,
  );
  return (command) => {
    lines = [];
    const before = runtime.snapshot();
    runtime.performActorCommand(command);
    sequencer.runAfterActorCommand(command, before, runtime.snapshot());
    let guard = 0;
    while (queue.length > 0 && guard < 80) {
      queue.shift()?.();
      guard += 1;
    }
    return lines;
  };
}

describe("gen1 major status battle message", () => {
  it("names the status already on the target when a different major status is blocked", () => {
    const runtime = battle();
    const play = playback(runtime);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
    const burned = runtime.snapshot().enemies.find((enemy) => enemy.id === "enemy-1");
    expect(burned?.hp).toBeGreaterThan(0);
    expect(burned?.stateIds).toContain("state_burn");
    expect(runtime.snapshot().phase).toBe("actorCommand");

    const lines = play({ kind: "skill", skillId: "skill_test_para_status", targetEnemyId: "enemy-1" });
    const enemy = runtime.snapshot().enemies.find((entry) => entry.id === "enemy-1");
    expect(enemy?.stateIds).toContain("state_burn");
    expect(enemy?.stateIds ?? []).not.toContain("state_paralysis");
    expect(lines).toContain("라르베아는 이미 화상 상태다.");
    expect(lines).not.toContain("라르베아에게는 효과가 없었다.");
  });

  it("keeps the same-status line and does not announce it for a damaging hit's secondary status", () => {
    const runtime = battle();
    const play = playback(runtime);
    play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
    const again = play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
    expect(again).toContain("라르베아는 이미 화상 상태다.");

    const hit = play({ kind: "skill", skillId: "skill_test_burn_hit", targetEnemyId: "enemy-1" });
    expect(hit.some((line) => line.includes("이미 화상"))).toBe(false);
    expect(runtime.snapshot().enemies.find((enemy) => enemy.id === "enemy-1")?.stateIds).toContain("state_burn");
  });

  it("refuses burn on a fire type even from a normal move, and names the type instead of another status", () => {
    const runtime = battle("troop_pkmn_new_pair");
    const play = playback(runtime);
    const emberkit = () => runtime.snapshot().enemies.find((enemy) => enemy.id === "enemy-1");
    expect(emberkit()?.name).toBe("엠버킷");

    const paralyzed = play({ kind: "skill", skillId: "skill_test_para_status", targetEnemyId: "enemy-1" });
    expect(paralyzed.some((line) => line.includes("마비에 걸렸다"))).toBe(true);
    expect(emberkit()?.stateIds).toContain("state_paralysis");

    const burned = play({ kind: "skill", skillId: "skill_test_burn_status", targetEnemyId: "enemy-1" });
    expect(emberkit()?.stateIds).toContain("state_paralysis");
    expect(emberkit()?.stateIds ?? []).not.toContain("state_burn");
    expect(burned).toContain("엠버킷은 불꽃 타입이라 화상 상태에 걸리지 않는다!");
    expect(burned.some((line) => line.includes("이미 마비"))).toBe(false);
    expect(burned).not.toContain("엠버킷에게는 효과가 없었다.");

    const hit = play({ kind: "skill", skillId: "skill_test_burn_hit", targetEnemyId: "enemy-1" });
    expect(emberkit()?.stateIds ?? []).not.toContain("state_burn");
    expect(hit.some((line) => line.includes("화상 상태에 걸리지"))).toBe(false);
  });
});
