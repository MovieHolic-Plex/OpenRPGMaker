import type { ItemRecord, Project } from "@/project/types";
import {
  EQUIPMENT_FOCUS_CHARM_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
} from "./defaultDatabaseRecordIds";
import { DEFAULT_EQUIPMENT_ID } from "./constants";
import { defaultEquipmentRecords } from "./defaultDatabaseEquipmentRecords";
import { defaultItemRecords } from "./defaultDatabaseItemRecords";
import { defaultSkillRecords, defaultStateRecords } from "./defaultDatabaseStarterRecords";

const DEFAULT_ITEM_ICON_RESOURCE_BY_ID = new Map(
  defaultItemRecords()
    .filter((item) => item.iconResourceId !== undefined)
    .map((item) => [item.id, item.iconResourceId]),
);

const DEFAULT_EQUIPMENT_ICON_RESOURCE_BY_ID: Readonly<Record<string, string>> = {
  [DEFAULT_EQUIPMENT_ID]: "cc0-jetrel-bronze-sword",
  [EQUIPMENT_MAGE_STAFF_ID]: "cc0-jetrel-mage-staff",
  [EQUIPMENT_SCOUT_DAGGER_ID]: "cc0-jetrel-scout-dagger",
  equip_iron_sword: "cc0-jetrel-iron-sword",
  equip_steel_sword: "cc0-jetrel-steel-sword",
  equip_short_sword: "cc0-jetrel-scout-dagger",
  [EQUIPMENT_OAK_SHIELD_ID]: "cc0-jetrel-oak-shield",
  [EQUIPMENT_LEATHER_ARMOR_ID]: "cc0-jetrel-leather-armor",
  [EQUIPMENT_MYSTIC_ROBE_ID]: "cc0-jetrel-mystic-robe",
  [EQUIPMENT_TRAVELER_HAT_ID]: "cc0-jetrel-traveler-hat",
  [EQUIPMENT_FOCUS_CHARM_ID]: "cc0-jetrel-focus-charm",
  equip_iron_shield: "cc0-jetrel-iron-shield",
  equip_steel_armor: "cc0-jetrel-steel-armor",
  equip_mage_hat: "cc0-jetrel-mage-hat",
  equip_gloves: "cc0-jetrel-gloves",
  equip_boots: "cc0-jetrel-boots",
  equip_cloak: "cc0-jetrel-cloak",
  equip_ring: "cc0-jetrel-ring",
  equip_necklace: "cc0-jetrel-necklace",
  equip_focus_ring: "cc0-jetrel-focus-ring",
};

/** state_death 는 엔진 내장 상태다(references.stateIdExists) — 레코드가 없어도 유효하다. */
const BUILTIN_STATE_IDS: readonly string[] = ["state_death"];

/**
 * 주입할 기본 아이템이 참조하는 스킬·상태를 프로젝트에 보강한다.
 * 기본 세트로 채울 수 있으면 채우고 true, 채울 수 없는 참조가 하나라도 있으면 false(주입 포기).
 * 부작용은 성공 경로에서만 남는다 — 실패 시 프로젝트를 반쯤 바꿔 놓지 않는다.
 */
function ensureItemReferences(
  project: Project,
  item: ItemRecord,
  skillIds: Set<string>,
  stateIds: Set<string>,
): boolean {
  const neededSkillIds = [item.skillId, item.learnedSkillId, item.activateSkillId]
    .filter((id): id is string => typeof id === "string" && id !== "" && !skillIds.has(id));
  const neededStateIds = [
    ...item.stateEffects.map((effect) => effect.stateId),
    ...item.healStateIds,
    ...item.equipmentProfile.stateInflictIds,
    ...item.equipmentProfile.stateDefenseIds,
  ].filter((id) => typeof id === "string" && id !== "" && !stateIds.has(id) && !BUILTIN_STATE_IDS.includes(id));

  if (neededSkillIds.length === 0 && neededStateIds.length === 0) return true;

  const skillDefaults = new Map(defaultSkillRecords().map((skill) => [skill.id, skill] as const));
  const stateDefaults = new Map(defaultStateRecords().map((state) => [state.id, state] as const));
  const addSkills = [...new Set(neededSkillIds)].map((id) => skillDefaults.get(id));
  const addStates = [...new Set(neededStateIds)].map((id) => stateDefaults.get(id));
  if (addSkills.some((record) => record === undefined) || addStates.some((record) => record === undefined)) return false;

  for (const skill of addSkills) {
    if (skill === undefined) continue;
    project.database.skills.push(structuredClone(skill));
    skillIds.add(skill.id);
  }
  for (const state of addStates) {
    if (state === undefined) continue;
    project.database.states.push(structuredClone(state));
    stateIds.add(state.id);
  }
  return true;
}

export function ensureDefaultDatabaseIconResources(project: Project): boolean {
  let changed = false;

  const existingItemIds = new Set(project.database.items.map((item) => item.id));
  const skillIds = new Set(project.database.skills.map((skill) => skill.id));
  const stateIds = new Set(project.database.states.map((state) => state.id));
  for (const defaultItem of defaultItemRecords()) {
    if (existingItemIds.has(defaultItem.id)) continue;
    // 참조 안전 주입(2026-08-30 실측): 기본 아이템 카탈로그는 기본 스킬·상태 테이블을 참조한다.
    // 예제 어드벤처처럼 자기 스킬·상태 세트가 더 작은 프로젝트에 아이템만 밀어넣으면 부팅 직후
    // 프로젝트가 스스로 참조 무결성을 깬다(이슬 장터 실측: 참조 위반 0건 → 82건). 그 상태에서는
    // 왕복 검증이 실패해 어떤 커밋도 통과하지 못하므로 청소조차 불가능한 교착이 된다.
    // 그래서 아이템이 필요로 하는 기본 스킬·상태를 같이 채워 넣고, 기본 세트로도 채울 수 없는
    // 참조를 가진 아이템은 주입하지 않는다.
    if (!ensureItemReferences(project, defaultItem, skillIds, stateIds)) continue;
    project.database.items.push(cloneItemRecord(defaultItem));
    existingItemIds.add(defaultItem.id);
    changed = true;
  }

  for (const item of project.database.items) {
    const resourceId = DEFAULT_ITEM_ICON_RESOURCE_BY_ID.get(item.id);
    if (resourceId === undefined) continue;
    changed = assignImageAndIcon(item, resourceId) || changed;
  }

  const existingEquipmentIds = new Set(project.database.equipment.map((equipment) => equipment.id));
  for (const defaultEquipment of defaultEquipmentRecords()) {
    if (existingEquipmentIds.has(defaultEquipment.id)) continue;
    project.database.equipment.push(cloneEquipmentRecord(defaultEquipment));
    existingEquipmentIds.add(defaultEquipment.id);
    changed = true;
  }

  for (const equipment of project.database.equipment) {
    const resourceId = DEFAULT_EQUIPMENT_ICON_RESOURCE_BY_ID[equipment.id];
    if (resourceId === undefined) continue;
    changed = assignImageAndIcon(equipment, resourceId) || changed;
  }

  return changed;
}

function cloneItemRecord(item: Project["database"]["items"][number]): Project["database"]["items"][number] {
  return {
    ...item,
    stateEffects: item.stateEffects.map((effect) => ({ ...effect })),
  };
}

function cloneEquipmentRecord(
  equipment: Project["database"]["equipment"][number],
): Project["database"]["equipment"][number] {
  return {
    ...equipment,
    statBonuses: { ...equipment.statBonuses },
    equippableActorIds: [...equipment.equippableActorIds],
    equippableClassIds: [...equipment.equippableClassIds],
    attackElementIds: [...equipment.attackElementIds],
    stateInflictIds: [...equipment.stateInflictIds],
    effectFlags: { ...equipment.effectFlags },
    elementalDefenseIds: [...equipment.elementalDefenseIds],
    stateDefenseIds: [...equipment.stateDefenseIds],
    actionWeapon: equipment.actionWeapon === undefined ? undefined : { ...equipment.actionWeapon },
  };
}

function assignImageAndIcon(record: { imageResourceId?: string; iconResourceId?: string }, resourceId: string): boolean {
  let changed = false;
  if (shouldFillResourceId(record.imageResourceId)) {
    record.imageResourceId = resourceId;
    changed = true;
  }
  if (shouldFillResourceId(record.iconResourceId)) {
    record.iconResourceId = resourceId;
    changed = true;
  }
  return changed;
}

function shouldFillResourceId(resourceId: string | undefined): boolean {
  return resourceId === undefined || resourceId.length === 0 || resourceId === "easyrpg-battle-weapon-weapon";
}
