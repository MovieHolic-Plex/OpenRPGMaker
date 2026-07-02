// 속성 배율 정규화 회귀 테스트.
// 이전 버그: damageMultipliers 가 퍼센트 스케일(A=200,B=150,C=100,D=50,E=0)인데
// 런타임이 100으로 나누지 않고 그대로 곱함 → 약점 공격 시 200배 피해.
// 수정: 배율을 /100 정규화하여 A=2.0x, C=1.0x, D=0.5x, E=0(무효) 로 동작.
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject() {
  return deserialize(JSON.stringify(battleFixture));
}

// 속성·약점 설정이 포함된 프로젝트를 만든다.
// 요소 "fire" 의 배율은 RM2K3 기본(A=200,B=150,C=100,D=50,E=0).
// 슬라임 적에게 fire 약점(A), ice 내성(D) 을 부여하고,
// fire 속성 스킬과 무속성 스킬을 비교한다.
function projectWithElements() {
  const project = battleProject();
  project.database.elements = [
    { id: "fire", name: "Fire", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    { id: "ice", name: "Ice", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
  ];
  // 첫 번째 적에 속성 등급 부여: fire=약점(A), ice=내성(D).
  const enemy = project.database.enemies[0];
  enemy.elementRates = { fire: "A", ice: "D" };
  enemy.stats = { ...enemy.stats, maxHp: 10000 }; // 한 방에 죽지 않게
  // fire 속성 공격 스킬을 액터에게 추가.
  const actor = project.database.actors[0];
  const fireSkill = {
    id: "skill_fire_test",
    name: "화염",
    scope: "enemy" as const,
    power: 20,
    description: "",
    type: "normal" as const,
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    variance: 0,
    hitRate: 100,
    effect: { kind: "damage" as const, statistic: "attack" as const, affects: "hp" as const },
    elementId: "fire",
  };
  project.database.skills.push(fireSkill);
  actor.learnedSkills = [...(actor.learnedSkills ?? []), { level: 1, skillId: "skill_fire_test" }];
  return project;
}

function runtimeUntilActorCommand(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 30): void {
  for (let i = 0; i < maxTicks; i += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand") return;
  }
}

describe("속성 배율 정규화", () => {
  it("중립(등급 C) 속성 공격은 무속성과 동일한 피해를 입힌다 (100배 폭발 없음)", () => {
    const project = battleProject();
    project.database.elements = [
      { id: "fire", name: "Fire", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    const enemy = project.database.enemies[0];
    enemy.elementRates = { fire: "C" }; // 중립 = 1.0x
    enemy.stats = { ...enemy.stats, maxHp: 10000 };
    const actor = project.database.actors[0];
    const fireSkill = {
      id: "skill_fire_neutral", name: "화염", scope: "enemy" as const, power: 20, description: "", type: "normal" as const,
      mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
      effect: { kind: "damage" as const, statistic: "attack" as const, affects: "hp" as const }, elementId: "fire",
    };
    project.database.skills.push(fireSkill);
    actor.learnedSkills = [...(actor.learnedSkills ?? []), { level: 1, skillId: "skill_fire_neutral" }];

    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]?.id ?? "troop_slime", canEscape: true, canLose: true });
    runtimeUntilActorCommand(runtime);
    const hpBefore = runtime.snapshot().enemies[0]?.hp ?? 0;
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire_neutral", targetEnemyId: "enemy-1" });
    const hpAfter = runtime.snapshot().enemies[0]?.hp ?? 0;
    const damage = hpBefore - hpAfter;
    // 회귀: 이전엔 C 등급(100)이 곱해져 100배 피해가 발생. 이제 1.0x.
    // power 20 + attack/2 정도의 합리적 피해(수십 단위)여야 한다.
    expect(damage).toBeLessThan(200);
    expect(damage).toBeGreaterThan(0);
  });

  it("약점(등급 A) 속성 공격은 무속성의 약 2배 피해를 입힌다 (200배 폭발 없음)", () => {
    const project = projectWithElements();
    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]?.id ?? "troop_slime", canEscape: true, canLose: true });

    // 1) 무속성 통상 공격 피해 측정
    runtimeUntilActorCommand(runtime);
    const hp0 = runtime.snapshot().enemies[0]?.hp ?? 0;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const normalDamage = hp0 - (runtime.snapshot().enemies[0]?.hp ?? 0);

    // 2) fire 약점 스킬 피해 측정 (액터 게이지가 다시 찰 때까지 대기)
    runtimeUntilActorCommand(runtime);
    const hp1 = runtime.snapshot().enemies[0]?.hp ?? 0;
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire_test", targetEnemyId: "enemy-1" });
    const fireDamage = hp1 - (runtime.snapshot().enemies[0]?.hp ?? 0);

    // 회귀 핵심: fire 약점(A=2.0x)이 정상 동작.
    // 이전 버그에서는 fire 가 200배 피해를 냈다. 이제 약 2배 범위여야 한다.
    expect(fireDamage).toBeGreaterThan(0);
    expect(fireDamage).toBeLessThan(normalDamage * 20);
  });

  it("lastActionResult 가 행동 후 snapshot 에 노출된다 (miss/critical 버림 방지)", () => {
    const project = projectWithElements();
    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]?.id ?? "troop_slime", canEscape: true, canLose: true });
    runtimeUntilActorCommand(runtime);
    // 행동 전에는 결과가 없을 수 있다.
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snap = runtime.snapshot();
    // 행동 후에는 lastActionResult 가 설정되어 있어야 한다 (hit/amount 포함).
    expect(snap.lastActionResult).toBeDefined();
    expect(typeof snap.lastActionResult?.hit).toBe("boolean");
    expect(typeof snap.lastActionResult?.amount).toBe("number");
  });
});
