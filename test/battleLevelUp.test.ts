import { describe, expect, it } from "vitest";
import { computeActorLevelUp } from "@/battle/battleLevelUp";
import { normalizeActorRecord, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function heroCurveExpForLevel(project: Project, level: number): number {
  const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
  if (!hero) throw new Error("missing actor_hero");
  return totalExpForLevel(normalizeActorRecord(hero).expCurve, level);
}

describe("battleLevelUp — 자동 레벨업 판정", () => {
  it("누적 경험치가 다음 레벨 임계치에 도달하면 레벨업한다", () => {
    const project = createBlankProject();
    const exp = heroCurveExpForLevel(project, 2);
    const result = computeActorLevelUp(project, "actor_hero", 1, exp);
    expect(result).not.toBeNull();
    expect(result?.fromLevel).toBe(1);
    expect(result?.toLevel).toBe(2);
    // 파라미터 곡선은 저레벨에서 거의 평탄하므로 증가분은 0 이상(레벨 자체는 오름).
    expect(result?.maxHpGain).toBeGreaterThanOrEqual(0);
  });

  it("경험치가 부족하면 레벨업하지 않는다(null)", () => {
    const project = createBlankProject();
    const exp = heroCurveExpForLevel(project, 2) - 1;
    expect(computeActorLevelUp(project, "actor_hero", 1, exp)).toBeNull();
  });

  it("한 번에 여러 레벨을 올릴 수 있다(다중 레벨업)", () => {
    const project = createBlankProject();
    const exp = heroCurveExpForLevel(project, 4);
    const result = computeActorLevelUp(project, "actor_hero", 1, exp);
    expect(result?.toLevel).toBe(4);
  });

  it("능력치 성장분은 파라미터 곡선의 레벨 간 차이와 일치한다", () => {
    const project = createBlankProject();
    const hero = normalizeActorRecord(project.database.actors[0]);
    // 고레벨 점프라 실제 증가분이 양수가 되어 의미 있게 검증된다.
    const exp = heroCurveExpForLevel(project, 40);
    const result = computeActorLevelUp(project, "actor_hero", 1, exp);
    const expectedHp = parameterValueAtLevel(hero.parameterCurves.maxHp, 40) - parameterValueAtLevel(hero.parameterCurves.maxHp, 1);
    expect(result?.toLevel).toBe(40);
    expect(expectedHp).toBeGreaterThan(0);
    expect(result?.maxHpGain).toBe(expectedHp);
  });

  it("레벨 구간에서 새로 배우는 스킬을 수집한다", () => {
    const project = createBlankProject();
    const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
    if (!hero) throw new Error("missing actor_hero");
    hero.learnedSkills = [
      { level: 1, skillId: "default_skill" },
      { level: 2, skillId: "skill_heal" },
    ];
    const exp = heroCurveExpForLevel(project, 2);
    const result = computeActorLevelUp(project, "actor_hero", 1, exp);
    expect(result?.learnedSkillIds).toEqual(["skill_heal"]);
  });

  it("최대 레벨을 넘지 않는다", () => {
    const project = createBlankProject();
    const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
    if (!hero) throw new Error("missing actor_hero");
    hero.maxLevel = 3;
    const result = computeActorLevelUp(project, "actor_hero", 1, 99_999_999);
    expect(result?.toLevel).toBe(3);
  });
});
