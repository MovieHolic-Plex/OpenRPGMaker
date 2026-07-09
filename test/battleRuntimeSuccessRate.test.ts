import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject() {
  return deserialize(JSON.stringify(battleFixture));
}

// 감사 A12: successRate 는 편집만 되고 전투에 미반영이었다.
// 수리 후에는 hitRate 와 곱해진 합성 확률로 판정한다 (0% 면 반드시 실패).
describe("battle runtime skill success rate", () => {
  function runtimeWithSuccessRate(successRate: number) {
    const project = battleProject();
    project.database.skills.push({
      ...project.database.skills[0],
      id: "skill_success_test",
      name: "성공률 스킬",
      scope: "enemy",
      power: 50,
      mpCost: { flat: 0, percentMax: 0 },
      successRate,
      variance: 0,
      hitRate: 100,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      stateEffects: [],
    });
    project.database.actors[0].learnedSkills = [{ level: 1, skillId: "skill_success_test" }];
    return createBattleRuntime({ project, troopId: project.database.troops[0].id, canEscape: true, canLose: true });
  }

  it("misses when successRate is 0 even with hitRate 100", () => {
    const runtime = runtimeWithSuccessRate(0);
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_success_test", targetEnemyId: "enemy-1" });
    const result = runtime.snapshot().lastActionResult;
    expect(result?.skillName).toBe("성공률 스킬");
    expect(result?.hit).toBe(false);
    expect(result?.amount).toBe(0);
  });

  it("hits when successRate is 100 and hitRate is 100", () => {
    const runtime = runtimeWithSuccessRate(100);
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_success_test", targetEnemyId: "enemy-1" });
    const result = runtime.snapshot().lastActionResult;
    expect(result?.hit).toBe(true);
    expect(result?.amount).toBeGreaterThan(0);
  });
});
