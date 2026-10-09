import { describe, expect, it } from "vitest";
import {
  ACTOR_STATE_RATE_PERCENTAGES,
  createActorRecord,
  normalizeActorRecord,
  parameterValueAtLevel,
  stateRatePercentage,
  totalExpForLevel,
} from "@/project/actorModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_CLASS_ID, DEFAULT_EQUIPMENT_ID, DEFAULT_SKILL_ID, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";

describe("RM2K3 actor model", () => {
  it("creates full RM2K3 actor defaults when a new actor is added", () => {
    const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID, {
      characterResourceId: DEFAULT_EASYRPG_CHARSET_ID,
      battleCharacterResourceId: DEFAULT_EASYRPG_CHARSET_ID,
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

  it("restores the default hero charset for persisted actors missing a character resource", () => {
    const actor = normalizeActorRecord({
      id: "actor_hero",
      name: "주인공",
      classId: DEFAULT_CLASS_ID,
      initialLevel: 1,
      maxLevel: 99,
    });

    expect(actor.characterResourceId).toBe("easyrpg-charset-actor1");
    expect(actor.faceResourceId).toBe("easyrpg-faceset-actor1-00");
  });

  it("does not synthesize non-hero character resources for persisted actors", () => {
    const actor = normalizeActorRecord({
      id: "actor_cleric",
      name: "성직자",
      classId: DEFAULT_CLASS_ID,
      initialLevel: 1,
      maxLevel: 99,
    });

    expect(actor.characterResourceId).toBeUndefined();
    // 걷기 그림이 없으면 짝을 정할 근거가 없다 — 이름(actor_cleric)으로 얼굴을 지어내지 않는다.
    expect(actor.faceResourceId).toBeUndefined();
  });

  it("calculates total EXP from the actor experience curve", () => {
    const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID);

    expect(totalExpForLevel(actor.expCurve, 1)).toBe(0);
    expect(totalExpForLevel(actor.expCurve, 2)).toBeGreaterThan(actor.expCurve.base);
    expect(totalExpForLevel(actor.expCurve, 99)).toBeGreaterThan(totalExpForLevel(actor.expCurve, 50));
  });

  it("maps RM2K3 state rate grades to descending manual probabilities", () => {
    expect(ACTOR_STATE_RATE_PERCENTAGES).toEqual({ A: 100, B: 80, C: 60, D: 30, E: 0 });
    expect(stateRatePercentage("A")).toBeGreaterThan(stateRatePercentage("B"));
    expect(stateRatePercentage("B")).toBeGreaterThan(stateRatePercentage("C"));
    expect(stateRatePercentage("C")).toBeGreaterThan(stateRatePercentage("D"));
    expect(stateRatePercentage("D")).toBeGreaterThan(stateRatePercentage("E"));
  });
});
