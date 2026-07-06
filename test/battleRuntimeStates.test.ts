import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

describe("battle runtime — 상태이상 연결", () => {
  it("상태 부여 스킬을 명중시키면 대상 stateIds 에 상태가 실린다", () => {
    const project = battleProject();
    // fixture 의 화염 스킬에 독 부여 효과를 붙인다(확률 100).
    const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
    if (!fire) throw new Error("missing skill_fire");
    fire.stateEffects = [{ stateId: "state_burn", chance: 100, operation: "add" }];

    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_burn");
  });

  it("승리 시 파티 정보를 주면 레벨업 미리보기를 보상 스냅샷에 담는다", () => {
    const project = battleProject();
    const hero = normalizeActorRecord(project.database.actors[0]);
    const bigExp = totalExpForLevel(hero.expCurve, 5);

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: { actor_hero: 1 }, experience: { actor_hero: bigExp } },
    });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("victory");
    expect(snapshot.rewards.levelUps?.length).toBeGreaterThan(0);
    expect(snapshot.rewards.levelUps?.[0]?.toLevel).toBeGreaterThan(1);
  });

  it("파티 정보가 없으면 레벨업 미리보기를 계산하지 않는다", () => {
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().rewards.levelUps).toEqual([]);
  });
});
