import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { GENERATED_BATTLE_EFFECT_ITEM_BINDINGS } from "@/project/defaults/generatedBattleEffectBindings";
import type { ItemRecord } from "@/project/types";

const HANGUL = /[가-힣]/;
const ASCII_ONLY_NAME = /^[A-Za-z][A-Za-z\s-]*$/;
const VALID_FARM_TOOLS = new Set(["hoe", "wateringCan", "axe", "pickaxe"]);

describe("default item catalog quality", () => {
  it("keeps item ids unique and every catalog record naturally Korean", () => {
    const project = createBlankProject();
    const items = project.database.items;
    const records = [...items, ...project.database.equipment];

    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(records.every((record) => HANGUL.test(record.name))).toBe(true);
    expect(records.every((record) => !ASCII_ONLY_NAME.test(record.name))).toBe(true);
    expect(records.every((record) => !/기본 (아이템|장비)입니다/.test(record.description))).toBe(true);
    expect(records.every((record) => record.description.trim().length >= 10)).toBe(true);
    expect(new Set(records.map((record) => record.description)).size).toBe(records.length);
  });

  it("keeps occasion, consumption, and executable effects coherent", () => {
    const items = createBlankProject().database.items;

    for (const item of items) {
      if (item.occasion === "never") {
        expect(item.consumable, item.id).toBe(false);
        expect(item.description.trim().length, item.id).toBeGreaterThan(0);
      } else {
        expect(item.consumable, item.id).toBe(true);
        expect(hasExecutableEffect(item), item.id).toBe(true);
      }
      if (item.farmTool !== undefined) expect(VALID_FARM_TOOLS.has(item.farmTool), item.id).toBe(true);
      if (isBattleUsable(item)) {
        expect(GENERATED_BATTLE_EFFECT_ITEM_BINDINGS[item.id], item.id).toBe(item.animationId);
      }
    }
  });
});

function isBattleUsable(item: ItemRecord): boolean {
  if (item.occasion === "never" || item.occasion === "field" || item.captureProfile) return false;
  return item.occasion === "battle" || item.occasion === "always" || item.occasionBattle;
}

function hasExecutableEffect(item: ItemRecord): boolean {
  return Boolean(
    item.hpRecovery.flat > 0 ||
      item.hpRecovery.percentMax > 0 ||
      item.mpRecovery.flat > 0 ||
      item.mpRecovery.percentMax > 0 ||
      item.healStateIds.length > 0 ||
      item.stateEffects.length > 0 ||
      item.skillId ||
      item.activateSkillId ||
      item.captureProfile ||
      item.careProfile ||
      item.learnedSkillId ||
      (item.type === "book" && item.skillId) ||
      Object.values(item.seedParameterBonuses).some((value) => value !== 0)
  );
}
