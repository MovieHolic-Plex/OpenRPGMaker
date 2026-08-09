import { describe, expect, it } from "vitest";
import { battleSkillMpCost } from "@/battle/battleSkillUse";

describe("battleSkillMpCost (field action cast uses this single source of truth)", () => {
  it("floors the percentMax share, not rounds (old field formula rounded 1.5 -> 2)", () => {
    // maxMp = 30, percentMax = 5 -> 30*5/100 = 1.5; floor -> 1 (round would give 2)
    expect(battleSkillMpCost({ mpCost: { flat: 0, percentMax: 5 } }, 30)).toBe(1);
  });

  it("matches the round path exactly when there is no fractional share", () => {
    // maxMp = 100, percentMax = 5 -> 5.0; floor and round agree
    expect(battleSkillMpCost({ mpCost: { flat: 0, percentMax: 5 } }, 100)).toBe(5);
  });

  it("clamps negative flat cost to 0 (old field formula increased MP on negative flat)", () => {
    expect(battleSkillMpCost({ mpCost: { flat: -10, percentMax: 0 } }, 100)).toBe(0);
  });

  it("truncates fractional flat cost (old field formula passed fractional flat through)", () => {
    expect(battleSkillMpCost({ mpCost: { flat: 3.7, percentMax: 0 } }, 100)).toBe(3);
  });

  it("combines truncated flat with floored percentMax share", () => {
    // flat 2.9 -> trunc 2; maxMp 30 * 7 / 100 = 2.1 -> floor 2; total 4
    expect(battleSkillMpCost({ mpCost: { flat: 2.9, percentMax: 7 } }, 30)).toBe(4);
  });

  it("defends against missing flat/percentMax via ?? 0", () => {
    expect(battleSkillMpCost({ mpCost: { percentMax: 10 } as never }, 50)).toBe(5);
    expect(battleSkillMpCost({ mpCost: { flat: 7 } as never }, 50)).toBe(7);
  });
});
