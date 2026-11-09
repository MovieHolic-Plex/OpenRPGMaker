import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import { preCheck } from "@/ai/v2/loop/argGuard";
import type { Project } from "@/project/types";

/** 기록된 실행(2026-11-09 fs-use-tools E1 측정, gpt-6.1-terra)에서 모델이 보낸 모양: 의도한 칸 + 스키마 기본값 채움. */
function filledSkillArgs(): Record<string, unknown> {
  return {
    skill: {
      id: "skill_castle_imp_flame", name: "임프의 불꽃", scope: "enemy", power: 18, elementId: "fire", type: "normal",
      description: "작은 불꽃으로 적 하나를 공격한다.", successRate: 100, hitRate: 100,
      effect: { kind: "damage", statistic: "mind", affects: "hp" },
      damageFormula: "18", maxPp: 10, gen1CriticalRate: "normal",
      exploitStates: { stateIds: [], bonusPercent: 1, consume: false },
      actionSkill: { kind: "melee", damage: 1, range: 1, speedTilesPerSec: 1, cooldownMs: 1000, durationMs: 1000, itemCost: { itemId: "", amount: 1 }, fieldStatus: { kind: "slow", durationMs: 1000 }, chargeTiers: [] },
      weather: { kind: "sun", turns: 3 }, fixedDamage: { mode: "amount", amount: 1 }, multiHit: { min: 2, max: 2 }, area: { shape: "circle", radius: 1 },
      battleGimmick: { pattern: "fire", durationTurns: 1 }, chargeBreak: { damage: 0, elementIds: [], stateIds: [], message: "", stagger: false },
      comboStaging: { tint: "", shake: "none", slowMo: false, kicker: "", partners: "auto" }, inputSequence: { keys: [], timeLimitMs: 300 },
      weaponAffinity: { elementIds: [], bonusPercent: 0 },
    },
    clearActionSkill: true, clearActionFieldStatus: false, clearActionItemCost: false,
  };
}
const schema = () => (getTool("upsert_skill") as unknown as { parameters: unknown }).parameters;
const skillOf = (out: ReturnType<typeof preCheck>) => (out as { args: { skill: Record<string, unknown> } & Record<string, unknown> }).args;

describe("upsert_skill schema-fill guard (fs-use-tools E1)", () => {
  it("drops the advanced fillers that were rejected or would silently change the skill, and the rest is accepted by the real tool", () => {
    const project = createBlankProject() as Project;
    const out = preCheck("upsert_skill", schema(), filledSkillArgs(), project);
    expect(out.kind).toBe("ok");
    const args = skillOf(out);
    for (const key of ["exploitStates", "actionSkill", "weather", "fixedDamage", "maxPp", "gen1CriticalRate", "damageFormula", "multiHit", "area", "battleGimmick", "chargeBreak", "comboStaging", "inputSequence", "weaponAffinity"]) {
      expect(args.skill).not.toHaveProperty(key);
    }
    expect(Object.keys(args).filter((k) => k.startsWith("clear"))).toEqual([]);
    expect(args.skill).toMatchObject({ id: "skill_castle_imp_flame", name: "임프의 불꽃", power: 18, elementId: "fire", scope: "enemy" });
    const draft = structuredClone(project);
    (getTool("upsert_skill") as unknown as { run: (d: Project, a: unknown) => unknown }).run(draft, args);
    const saved = draft.database.skills.find((s) => s.id === "skill_castle_imp_flame") as unknown as Record<string, unknown>;
    expect(saved.power).toBe(18);
    expect(saved.multiHit).toBeUndefined();
    expect(saved.area).toBeUndefined();
  });

  it("keeps an advanced field the skill itself asks for", () => {
    const project = createBlankProject() as Project;
    const args = filledSkillArgs();
    const skill = args.skill as Record<string, unknown>;
    skill.name = "연속 베기"; skill.description = "두 번 연타한다.";
    skill.exploitStates = { stateIds: ["state_poison"], bonusPercent: 50, consume: false };
    const kept = skillOf(preCheck("upsert_skill", schema(), args, project)).skill;
    expect(kept.multiHit).toEqual({ min: 2, max: 2 });
    expect(kept.exploitStates).toEqual({ stateIds: ["state_poison"], bonusPercent: 50, consume: false });
  });

  it("keeps gen1-only fields on a gen1 project", () => {
    const project = createBlankProject() as Project;
    (project.system as unknown as { battleModel: string }).battleModel = "gen1";
    const kept = skillOf(preCheck("upsert_skill", schema(), filledSkillArgs(), project)).skill;
    expect(kept.weather).toEqual({ kind: "sun", turns: 3 });
  });

  it("keeps clearActionSkill when the existing skill really has an action profile", () => {
    const project = createBlankProject() as Project;
    const base = project.database.skills[0] as unknown as Record<string, unknown>;
    project.database.skills.push({ ...base, id: "skill_castle_imp_flame", actionSkill: { kind: "melee", damage: 5, range: 2 } } as never);
    const args = { skill: { id: "skill_castle_imp_flame" }, clearActionSkill: true };
    const out = preCheck("upsert_skill", schema(), args, project);
    expect((skillOf(out) as Record<string, unknown>).clearActionSkill).toBe(true);
  });
});
