import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { EquipmentRecord, ItemEquipmentEffectFlags, ItemRecord } from "@/project/types";

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
    const equipmentKeys = project.database.equipment.map(
      (record) => `${record.slot}:${record.price}:${JSON.stringify(record.statBonuses)}`,
    );
    expect(new Set(equipmentKeys).size).toBe(equipmentKeys.length);
    expect(new Set(records.map((record) => record.description)).size).toBe(records.length);
    for (const equipment of project.database.equipment) assertRuntimeEquipmentAxisContract(equipment);
  });

  it("사용 시점과 소모 여부, 실행 효과, 애니메이션 참조가 서로 맞는다", () => {
    const project = createBlankProject();
    const items = project.database.items;
    const animationIds = new Set(project.database.battleAnimations.map((animation) => animation.id));

    for (const item of items) {
      if (item.occasion === "never") {
        // 씨앗은 아이템 사용 메뉴가 아니라 농사 권위자가 소모한다(작물은 옵트인 레이어에 있다).
        const isPlantableSeed = item.type === "seed";
        if (!isPlantableSeed) expect(item.consumable, item.id).toBe(false);
        expect(item.description.trim().length, item.id).toBeGreaterThan(0);
      } else {
        expect(item.consumable, item.id).toBe(true);
        expect(hasExecutableEffect(item), item.id).toBe(true);
      }
      if (item.farmTool !== undefined) expect(VALID_FARM_TOOLS.has(item.farmTool), item.id).toBe(true);
      if (isBattleUsable(item)) {
        expect(item.animationId, item.id).toBeTruthy();
        expect(animationIds.has(item.animationId!), item.id).toBe(true);
      }
    }

    for (const skillId of ["skill_item_holy_water", "skill_item_thunder_stone"]) {
      expect(project.database.classes.flatMap((record) => record.skillIds)).not.toContain(skillId);
      const skill = project.database.skills.find((record) => record.id === skillId);
      expect(skill?.animationId, skillId).toBeTruthy();
      expect(animationIds.has(skill!.animationId!), skillId).toBe(true);
    }
  });

  it("스위치 아이템이 올리는 스위치는 프로젝트 스위치 정의에 선언돼 있다", () => {
    const project = createBlankProject();
    const declared = new Set(project.switches.map((entry) => entry.id));
    const dangling = project.database.items
      .filter((item) => item.switchId && !declared.has(item.switchId))
      .map((item) => `${item.id} → ${item.switchId}`);
    expect(dangling).toEqual([]);
  });

  it("포획 아이템은 gen1 포획식이 읽는 볼 등급을 지정하고 등급 사다리가 완성돼 있다", () => {
    const items = createBlankProject().database.items;
    const missing = items
      .filter((item) => item.captureProfile && !item.captureProfile.ballClass)
      .map((item) => item.id);
    expect(missing).toEqual([]);
    const classes = new Set(
      items.flatMap((item) => (item.captureProfile?.ballClass ? [item.captureProfile.ballClass] : []))
    );
    for (const ballClass of ["poke", "great", "ultra", "master"] as const) {
      expect(classes.has(ballClass), ballClass).toBe(true);
    }
  });

  it("런타임이 지원하는 네 농기구 종류 전부에 기본 아이템이 있다", () => {
    const kinds = new Set(
      createBlankProject().database.items
        .map((item) => item.farmTool)
        .filter((tool) => tool !== undefined)
    );
    for (const tool of VALID_FARM_TOOLS) expect(kinds.has(tool), tool).toBe(true);
  });
});

function assertRuntimeEquipmentAxisContract(equipment: EquipmentRecord): void {
  expect(equipment.attackElementIds.length, `${equipment.id}.attackElementIds`).toBeLessThanOrEqual(1);
  if (equipment.stateInflictIds.length === 0) expect(equipment.stateInflictionChance, equipment.id).toBe(100);
  if (equipment.stateDefenseIds.length === 0) expect(equipment.stateResistanceChance, equipment.id).toBe(0);
  expect(equipment.stateDefenseMode, `${equipment.id}.stateDefenseMode`).toBe("resist");

  const authoredFlags = Object.entries(equipment.effectFlags)
    .filter(([, value]) => value)
    .map(([key]) => key as keyof ItemEquipmentEffectFlags);
  expect(authoredFlags.every((flag) => flag === "doubleAttack" || flag === "attackAll" || flag === "fixedEquipment"), equipment.id).toBe(true);
}

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
      (item.type === "switch" && item.switchId) ||
      (item.type === "seed" && item.occasion === "never") ||
      item.learnedSkillId ||
      (item.type === "book" && item.skillId) ||
      Object.values(item.seedParameterBonuses).some((value) => value !== 0)
  );
}
