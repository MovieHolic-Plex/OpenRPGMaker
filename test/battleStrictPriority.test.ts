// SkillRecord.movePriority — strict 턴제의 기술 우선도(퀵어택류) + gen1 동속 랜덤 타이브레이크.
// 계약 3개를 못박는다:
//  (1) 우선도는 속도보다 먼저 비교된다 (느린 쪽이 +1 기술로 선공)
//  (2) 동속 랜덤은 battleModel === "gen1" 에서만 rng 를 소비한다 — rm2k3 은 기존
//      "아군 우선 → index 순" 결정적 정렬 그대로 (battleStrictRuntime.test.ts 계약 보존)
//  (3) 필드는 normalize/뮤테이터 화이트리스트를 왕복 생존한다 (skillSystem 소실 전례 방지)
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import { updateSkillRecord } from "@/editor/databaseRecordMutators";
import type { ActorParameterKey, Project } from "@/project/types";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

function strictProject(): Project {
  return deserialize(JSON.stringify(strictFixture));
}

function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) throw new Error(`missing actor: ${actorId}`);
  actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
}

function tankEnemy(project: Project, agility: number): void {
  const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
  if (!enemy) throw new Error("missing enemy_training_slime");
  enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility };
}

function givePrioritySkill(project: Project, movePriority: number): void {
  const skill = project.database.skills.find((record) => record.id === "skill_fire");
  if (!skill) throw new Error("missing skill_fire");
  skill.movePriority = movePriority;
  // 우선도만 검증한다 — MP 부족으로 커맨드가 거부되지 않게 코스트를 비운다.
  skill.mpCost = { flat: 0, percentMax: 0 };
}

// rng 시퀀스 스크립트. 소진되면 fallback 상수를 돌려준다(정렬 뒤 데미지 롤용).
function scriptedRng(values: readonly number[], fallback = 0.5): () => number {
  let cursor = 0;
  return () => (cursor < values.length ? values[cursor++]! : fallback);
}

describe("strict movePriority + gen1 tie-break", () => {
  // 우선도 케이스는 actor_mage 를 쓴다 — skill_fire 를 배운 유일한 액터라
  // battleSkillUseFailure("notLearned") 로 커맨드가 거부되지 않는다(runtime.ts:701).
  it("느린 액터가 movePriority +1 기술로 빠른 적보다 먼저 행동한다", () => {
    const project = strictProject();
    setActorParam(project, "actor_mage", "agility", 1);
    tankEnemy(project, 50);
    givePrioritySkill(project, 1);

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_mage: 1 }, experience: {}, partyActorIds: ["actor_mage"] },
      rng: () => 0.99,
    });
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
      .toEqual(["actor_mage", "enemy_training_slime"]);
  });

  it("우선도 0 대조군: 같은 셋업에서 기술에 우선도가 없으면 빠른 적이 선공한다", () => {
    const project = strictProject();
    setActorParam(project, "actor_mage", "agility", 1);
    tankEnemy(project, 50);
    givePrioritySkill(project, 0);

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_mage: 1 }, experience: {}, partyActorIds: ["actor_mage"] },
      rng: () => 0.99,
    });
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
      .toEqual(["enemy_training_slime", "actor_mage"]);
  });

  it("gen1: 동속 타이브레이크가 rng 로 갈린다 (적이 선공할 수 있다)", () => {
    const project = strictProject();
    project.system.battleModel = "gen1";
    setActorParam(project, "actor_warrior", "agility", 20);
    tankEnemy(project, 20);

    // 큐 구성 순서 = [액터 롤, (chooseEnemyAction), 적 롤]. enemy_training_slime 의 행동
    // 패턴이 단일이라 chooseEnemyAction 은 rng 를 소비하지 않는다 — 첫 두 값이 그대로
    // 타이브레이크다. 액터 0.1 < 적 0.9 → 내림차순이라 적이 먼저.
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
      rng: scriptedRng([0.1, 0.9]),
    });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
      .toEqual(["enemy_training_slime", "actor_warrior"]);
  });

  it("rm2k3(기본): 동속에서 rng 를 소비하지 않고 아군 우선 정렬을 유지한다", () => {
    const project = strictProject();
    setActorParam(project, "actor_warrior", "agility", 20);
    tankEnemy(project, 20);

    // gen1 케이스와 같은 rng 스크립트를 줘도 결과가 갈리면 안 된다 — 타이브레이크가
    // rng 를 읽지 않음을 행동으로 증명한다(아군 우선 계약 유지).
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
      rng: scriptedRng([0.1, 0.9]),
    });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
      .toEqual(["actor_warrior", "enemy_training_slime"]);
  });

  it("movePriority 는 직렬화 왕복과 에디터 뮤테이터를 생존한다", () => {
    const project = strictProject();
    givePrioritySkill(project, 1);

    const roundTripped = deserialize(serialize(project));
    expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(1);

    updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 3 });
    expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(3);

    // 클램프(-7~7) + 기본값 0 은 직렬화에서 생략된다(레거시 바이트 보존 관례).
    updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 99 });
    expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(7);
    updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 0 });
    expect(serialize(roundTripped)).not.toContain("movePriority");
  });
});
