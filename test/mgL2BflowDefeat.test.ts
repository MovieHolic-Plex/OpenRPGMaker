import { describe, expect, it } from "vitest";
import { createBattleRuntime, isBattlerIncapacitated } from "@/battle/runtime";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function addPetrify(project: Project): void {
  project.database.states.push(normalizeStateRecord({
    id: "state_stone",
    name: "석화",
    runtimeEffects: { incapacitates: true, removeOnBattleEnd: false },
  }));
}

describe("mg-l2-bflow #20 전원 행동 불능 패배", () => {
  it("아군 전원이 incapacitates 상태면 HP 가 남아도 패배한다", () => {
    const project = battleProject();
    addPetrify(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", party: { stateIds: { actor_hero: ["state_stone"] } }, rng: () => 0.5 });
    const snapshot = runtime.snapshot();
    expect(snapshot.actors[0]!.hp).toBeGreaterThan(0);
    expect(snapshot.result).toBe("defeat");
  });

  it("incapacitates 가 아닌 상태(표시만 있는 상태)로는 패배하지 않는다", () => {
    const project = battleProject();
    project.database.states.push(normalizeStateRecord({ id: "state_mark", name: "표식", runtimeEffects: { removeOnBattleEnd: false } }));
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", party: { stateIds: { actor_hero: ["state_mark"] } }, rng: () => 0.5 });
    expect(runtime.snapshot().result).toBeUndefined();
    expect(isBattlerIncapacitated(project, { stateIds: ["state_mark"] })).toBe(false);
    expect(isBattlerIncapacitated((addPetrify(project), project), { stateIds: ["state_stone"] })).toBe(true);
  });

  it("incapacitates 는 저장·불러오기를 지난다", () => {
    const project = battleProject();
    addPetrify(project);
    const reloaded = deserialize(serialize(project));
    expect(reloaded.database.states.find((state) => state.id === "state_stone")?.runtimeEffects?.incapacitates).toBe(true);
  });
});

describe("mg-l2-bflow #36 적 최후의 일격(onDeath)", () => {
  function lastStandProject(chance = 100): Project {
    const project = battleProject();
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 1, defense: 0 };
    slime.reactions = [{ trigger: "onDeath", skillId: "skill_claw", chance }];
    const claw = project.database.skills.find((skill) => skill.id === "skill_claw")!;
    claw.mpCost = { flat: 0, percentMax: 0 };
    return project;
  }

  it("쓰러지는 적이 한 번 스킬을 쓰고, 그 뒤 승리한다", () => {
    const runtime = createBattleRuntime({ project: lastStandProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    const heroHp = runtime.snapshot().actors[0]!.hp;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    const counters = snapshot.timeline.filter((entry) => entry.kind === "counter");
    expect(counters).toHaveLength(1);
    expect(counters[0]!.skillName).toBe("할퀴기");
    expect(snapshot.actors[0]!.hp).toBeLessThan(heroHp);
    expect(snapshot.enemies[0]!.hp).toBe(0);
    expect(snapshot.result).toBe("victory");
  });

  it("최후의 일격으로 아군을 전멸시키면 승리가 아니라 패배다", () => {
    const project = lastStandProject();
    const claw = project.database.skills.find((skill) => skill.id === "skill_claw")!;
    claw.power = 99999;
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().result).toBe("defeat");
  });

  it("onDeath 가 없는 적은 쓰러질 때 아무것도 하지 않는다(기존 반격 계약 그대로)", () => {
    const project = lastStandProject();
    project.database.enemies.find((record) => record.id === "enemy_slime")!.reactions = [{ trigger: "physical", skillId: "skill_claw", chance: 100 }];
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().timeline.some((entry) => entry.kind === "counter")).toBe(false);
    expect(runtime.snapshot().result).toBe("victory");
  });

  it("onDeath 반응은 정규화와 저장을 지난다", () => {
    const normalized = normalizeEnemyRecord({ id: "enemy_x", name: "X", reactions: [{ trigger: "onDeath", skillId: "skill_claw", chance: 40 }] } as Parameters<typeof normalizeEnemyRecord>[0]);
    expect(normalized.reactions).toEqual([{ trigger: "onDeath", skillId: "skill_claw", chance: 40 }]);
    const reloaded = deserialize(serialize(lastStandProject(40)));
    expect(reloaded.database.enemies.find((record) => record.id === "enemy_slime")?.reactions?.[0]).toMatchObject({ trigger: "onDeath", chance: 40 });
  });
});
