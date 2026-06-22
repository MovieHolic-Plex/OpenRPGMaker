import { describe, expect, it } from "vitest";
import { createActorRecord, normalizeActorRecord, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_CLASS_ID, DEFAULT_EQUIPMENT_ID, DEFAULT_SKILL_ID, DEFAULT_SPRITE_HERO } from "@/project/defaults";

describe("RM2K3 actor model", () => {
  it("creates full RM2K3 actor defaults when a new actor is added", () => {
    const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID, {
      characterResourceId: DEFAULT_SPRITE_HERO,
      battleCharacterResourceId: DEFAULT_SPRITE_HERO,
      defaultEquipmentId: DEFAULT_EQUIPMENT_ID,
      defaultSkillId: DEFAULT_SKILL_ID,
      unarmedAnimationId: DEFAULT_ANIMATION_ID,
    });

    expect(actor.initialLevel).toBe(1);
    expect(actor.maxLevel).toBe(99);
    expect(actor.critical).toEqual({ enabled: true, chanceDenominator: 30 });
    expect(actor.learnedSkills).toEqual([{ level: 1, skillId: DEFAULT_SKILL_ID }]);
    expect(actor.initialEquipment.weapon).toBe(DEFAULT_EQUIPMENT_ID);
    expect(actor.stateRates["state_death"]).toBe("C");
    expect(actor.elementRates.sword).toBe("C");
    expect(actor.parameterCurves.maxHp).toHaveLength(99);
    expect(parameterValueAtLevel(actor.parameterCurves.attack, 1)).toBe(45);
  });

  it("normalizes legacy actor skillIds and clamps RM2K3 numeric bounds", () => {
    const actor = normalizeActorRecord({
      id: "actor_legacy",
      name: "Legacy",
      classId: DEFAULT_CLASS_ID,
      initialLevel: -5,
      maxLevel: 500,
      skillIds: [DEFAULT_SKILL_ID],
    });

    expect(actor.initialLevel).toBe(1);
    expect(actor.maxLevel).toBe(99);
    expect(actor.learnedSkills).toEqual([{ level: 1, skillId: DEFAULT_SKILL_ID }]);
    expect(actor.critical.chanceDenominator).toBe(30);
    expect(actor.options.dualWield).toBe(false);
  });

  it("calculates total EXP from the actor experience curve", () => {
    const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID);

    expect(totalExpForLevel(actor.expCurve, 1)).toBe(0);
    expect(totalExpForLevel(actor.expCurve, 2)).toBeGreaterThan(actor.expCurve.base);
    expect(totalExpForLevel(actor.expCurve, 99)).toBeGreaterThan(totalExpForLevel(actor.expCurve, 50));
  });
});
