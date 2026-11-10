import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { lintBattleStateReach } from "@/project/lint/battleStateReachLint";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import type { EnemyRecord, Project, StateRecord } from "@/project/types";

function withState(project: Project, state: Partial<StateRecord> & Pick<StateRecord, "id" | "name">): void {
  project.database.states.push(normalizeStateRecord(state));
}

describe("battle state reach lint", () => {
  it("is silent on a blank project", () => {
    expect(lintBattleStateReach(createBlankProject())).toEqual([]);
  });

  it("warns when a hero-identity (emotion) state rides a skill enemies also use", () => {
    const project = createBlankProject();
    withState(project, { id: "state_mark", name: "표식", emotion: { family: "mark", tier: 1 } } as never);
    const base = project.database.skills.find((row) => row.scope === "enemy")!;
    const skill = { ...structuredClone(base), id: "skill_test_mark_slash", stateEffects: [{ stateId: "state_mark", chance: 100, operation: "add" as const }] };
    project.database.skills.push(skill);
    const enemy = project.database.enemies[0]!;
    enemy.actions = [{ skillId: skill.id, priority: 5, condition: { kind: "always" } } as EnemyRecord["actions"][number]];
    const issues = lintBattleStateReach(project);
    expect(issues.map((issue) => issue.code)).toContain("skill-identity-state-shared-with-enemies");
    expect(issues.find((issue) => issue.code === "skill-identity-state-shared-with-enemies")!.message).toContain(`skill:${skill.id}`);
    enemy.actions = [];
    expect(lintBattleStateReach(project).map((issue) => issue.code)).not.toContain("skill-identity-state-shared-with-enemies");
  });

  it("counts enemies a weapon's on-hit state can land on, not only all-immune", () => {
    const project = createBlankProject();
    withState(project, { id: "state_wound", name: "상처" });
    const weapon = project.database.equipment.find((row) => row.slot === "weapon")!;
    weapon.stateInflictIds = ["state_wound"];
    weapon.stateInflictionChance = 20;
    const enemies = project.database.enemies;
    expect(enemies.length).toBeGreaterThan(4);
    for (const enemy of enemies) enemy.stateRates = { ...(enemy.stateRates ?? {}), state_wound: "E" };
    expect(lintBattleStateReach(project).find((issue) => issue.message.includes(`equipment:${weapon.id}`))?.code).toBe("state-reaches-no-enemy");
    enemies[0]!.stateRates = { ...enemies[0]!.stateRates, state_wound: "A" };
    const one = lintBattleStateReach(project).find((issue) => issue.message.includes(`equipment:${weapon.id}`))!;
    expect(one.code).toBe("state-reaches-few-enemies");
    expect(one.message).toContain(`1/${enemies.length}`);
    for (const enemy of enemies) enemy.stateRates = { ...enemy.stateRates, state_wound: "C" };
    expect(lintBattleStateReach(project).some((issue) => issue.message.includes(`equipment:${weapon.id}`))).toBe(false);
  });
});
