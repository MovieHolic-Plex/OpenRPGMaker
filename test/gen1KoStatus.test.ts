// gen1 피해 기술이 대상을 쓰러뜨린 타격에는 부가 상태(화상 등)를 걸지 않는다.
// rm2k3 경로는 이미 막혀 있었다. 몬스터 전투만 「쓰러뜨렸다!」 뒤에 「화상에 걸렸다!」가 남았다.
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import type { ActorParameterKey } from "@/project/types";

function setActorParam(project: ReturnType<typeof createScarloxyPokemonDemoProject>, key: ActorParameterKey, value: number): void {
  const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
  if (!actor) throw new Error("missing start actor");
  actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
}

function teachBurningStrike(project: ReturnType<typeof createScarloxyPokemonDemoProject>, power: number): void {
  const base = project.database.skills.find((skill) => skill.id === "skill_scarloxy_scratch");
  const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
  if (!base || !actor) throw new Error("missing scratch skill or start actor");
  project.database.skills.push({
    ...base,
    id: "skill_test_ko_burn",
    name: "확정 화상",
    power,
    hitRate: 100,
    successRate: 100,
    mpCost: { flat: 0, percentMax: 0 },
    stateEffects: [{ stateId: "state_burn", chance: 100, operation: "add" }],
  });
  actor.learnedSkills = [...actor.learnedSkills, { level: 1, skillId: "skill_test_ko_burn" }];
}

describe("gen1 knockout skips secondary status", () => {
  it("does not burn a target a damaging move just knocked out", () => {
    const project = createScarloxyPokemonDemoProject();
    teachBurningStrike(project, 40);
    for (const enemy of project.database.enemies) {
      if (!enemy.id.startsWith("enemy_pkmn_")) continue;
      enemy.stats = { ...enemy.stats, maxHp: 1, defense: 1, agility: 1, attack: 1 };
    }
    const actorId = project.system.startActorIds[0]!;
    setActorParam(project, "attack", 200);
    setActorParam(project, "agility", 999);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { [actorId]: 50 }, experience: {}, partyActorIds: [actorId] },
      rng: () => 0,
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_test_ko_burn", targetEnemyId: "enemy-1" });

    const snapshot = runtime.snapshot();
    const enemy = snapshot.enemies.find((entry) => entry.id === "enemy-1");
    expect(snapshot.result).toBe("victory");
    expect(enemy?.hp).toBe(0);
    expect(enemy?.stateIds ?? []).not.toContain("state_burn");
    expect(snapshot.timeline.some((entry) => entry.kind === "stateAdded" && entry.stateId === "state_burn")).toBe(false);
  });

  it("still burns a target that survives the damaging move", () => {
    const project = createScarloxyPokemonDemoProject();
    teachBurningStrike(project, 1);
    const record = project.database.enemies.find((enemy) => enemy.id === "enemy_pkmn_larvea");
    if (!record) throw new Error("missing larvea");
    record.stats = { ...record.stats, maxHp: 99999, defense: 255, agility: 1, attack: 1 };
    const actorId = project.system.startActorIds[0]!;
    setActorParam(project, "attack", 1);
    setActorParam(project, "agility", 999);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { [actorId]: 1 }, experience: {}, partyActorIds: [actorId] },
      rng: () => 0,
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_test_ko_burn", targetEnemyId: "enemy-1" });

    const snapshot = runtime.snapshot();
    const enemy = snapshot.enemies.find((entry) => entry.id === "enemy-1");
    expect(snapshot.result).toBeUndefined();
    expect(enemy?.hp).toBeGreaterThan(0);
    expect(enemy?.stateIds).toContain("state_burn");
    expect(snapshot.timeline.some((entry) => entry.kind === "stateAdded" && entry.stateId === "state_burn" && entry.targetId === "enemy-1")).toBe(true);
  });
});
