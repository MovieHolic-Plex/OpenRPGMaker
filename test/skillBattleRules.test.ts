// 기술 규칙 어휘(고정 피해·연속 타수·반동·풀죽음) — 정규화·굴림·기본값 불변.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { describe, expect, it } from "vitest";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { fixedDamageAmount, normalizeFixedDamage, normalizeMultiHit, recoilDamageFor, rollMultiHitCount, skillBattleRuleLabels } from "@/project/skillBattleRules";

describe("skill battle rule normalization", () => {
  it("keeps an ordinary skill byte-identical (no new keys appear)", () => {
    const plain = normalizeSkillRecord({ id: "s", name: "툭" });
    for (const key of ["recoilPercent", "fixedDamage", "multiHit", "flinchChance"]) expect(plain).not.toHaveProperty(key);
  });

  it("round-trips valid rules and drops invalid shapes", () => {
    const skill = normalizeSkillRecord({ id: "s", name: "x", recoilPercent: 25, flinchChance: 30, fixedDamage: { mode: "amount", amount: 40 }, multiHit: { min: 2, max: 5 } });
    expect(skill.recoilPercent).toBe(25);
    expect(skill.flinchChance).toBe(30);
    expect(skill.fixedDamage).toEqual({ mode: "amount", amount: 40 });
    expect(skill.multiHit).toEqual({ min: 2, max: 5 });
    expect(normalizeFixedDamage({ mode: "amount", amount: 0 })).toBeUndefined();
    expect(normalizeFixedDamage({ mode: "bogus" })).toBeUndefined();
    expect(normalizeMultiHit({ min: 1, max: 1 })).toEqual({ min: 2, max: 2 });
    expect(normalizeMultiHit({ min: 3, max: 99 })).toEqual({ min: 3, max: 5 });
    expect(normalizeMultiHit("x")).toBeUndefined();
  });
});

describe("skill battle rule math", () => {
  it("fixed damage reads the user level or the amount", () => {
    expect(fixedDamageAmount({ mode: "level" }, 17)).toBe(17);
    expect(fixedDamageAmount({ mode: "level" }, undefined)).toBe(1);
    expect(fixedDamageAmount({ mode: "amount", amount: 40 }, 3)).toBe(40);
    expect(fixedDamageAmount(undefined, 17)).toBeUndefined();
  });

  it("multi-hit uses the 3/8 3/8 1/8 1/8 split for 2-5 and does not roll without a rule", () => {
    let calls = 0;
    expect(rollMultiHitCount(undefined, () => { calls += 1; return 0; })).toBeUndefined();
    expect(calls).toBe(0);
    const rule = { min: 2, max: 5 } as const;
    expect([0, 0.37, 0.4, 0.74, 0.8, 0.87, 0.9, 0.999].map((r) => rollMultiHitCount(rule, () => r))).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
    expect(rollMultiHitCount({ min: 3, max: 3 }, () => 0.5)).toBe(3);
    expect(rollMultiHitCount({ min: 2, max: 3 }, () => 0.99)).toBe(3);
  });

  it("recoil is a percentage of the damage dealt, at least 1, only for real damage", () => {
    expect(recoilDamageFor(50, 31)).toBe(15);
    expect(recoilDamageFor(10, 3)).toBe(1);
    expect(recoilDamageFor(50, 0)).toBe(0);
    expect(recoilDamageFor(undefined, 30)).toBe(0);
  });

  it("labels summarise the rules for the database view", () => {
    expect(skillBattleRuleLabels({ multiHit: { min: 2, max: 5 }, recoilPercent: 25, flinchChance: 10, fixedDamage: { mode: "level" } }))
      .toEqual(["고정 피해(레벨만큼)", "2~5회 연속", "반동 25%", "풀죽음 10%"]);
    expect(skillBattleRuleLabels({})).toEqual([]);
  });
});
