import { deserialize, deserializeParsed } from "../../io";
import { collectProjectItemReferenceIds } from "../../io/references";
import { defaultResourceProfiles, removeLegacySpriteReferences } from "../../defaults/defaultAssets";
import { ensureBundledBattleAnimations } from "../../defaults/defaultDatabase";
import { defaultEquipmentRecords } from "../../defaults/defaultDatabaseEquipmentRecords";
import { defaultItemRecords } from "../../defaults/defaultDatabaseItemRecords";
import { defaultSkillRecords } from "../../defaults/defaultDatabaseStarterRecords";
import type { BattleAnimationRecord, Project } from "../../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deserializeStoredProjectJson(value: unknown): Project {
  try {
    // The stored value already came from JSON.parse in the local host. Repair mutates
    // a clone so a failed repair can still open the untouched row. Validation then
    // adopts that clone instead of stringifying the whole project back to text.
    const repaired: unknown = structuredClone(value);
    repairStoredProjectJson(repaired);
    return deserializeParsed(repaired);
  } catch {
    // 세 차례의 검토에서 장식용 로드 복구가 정상 프로젝트를 불러오지 못하게 만들었다.
    // 복구본 전체를 검증한 뒤 실패하면 손대지 않은 원본 행을 여는 것을 구조적으로 보장한다.
    return deserialize(JSON.stringify(value));
  }
}

function repairStoredProjectJson(value: unknown): unknown {
  repairStoredLoadFoundation(value);
  repairStoredItemCatalog(value);
  return value;
}

export function repairStoredLoadFoundation(value: unknown): void {
  if (!isRecord(value)) return;
  pruneInvalidVillageInfoDocuments(value);
  removeLegacySpriteReferences(value);
  appendMissingResourceProfiles(value, defaultResourceProfiles());

  // store.ts도 로드 뒤 같은 ensure를 호출한다. 여기서는 복구 아이템/스킬을 검증하기 전에
  // 애니메이션 참조를 완성해야 하므로 먼저 실행하며, 두 호출은 같은 id 기반 수렴 동작이다.
  ensureLoadRepairBattleAnimations(value);
}

function repairStoredItemCatalog(value: unknown): void {
  if (!isRecord(value) || !hasUntouchedLegacyItemStub(value)) return;
  // 참조 수집기는 정규화된 Project를 단일 권위자로 삼는다. 카탈로그를 건드리기 전의
  // 유효한 행을 먼저 해석하므로, 이벤트·시스템·시작 인벤토리의 기존 참조를 잃지 않는다.
  // 옛 아이템 껍데기가 있을 때만 탄다. 정상 프로젝트는 이 전체 검증을 건너뛴다.
  const referencedItemIds = collectProjectItemReferenceIds(deserializeParsed(structuredClone(value)));

  // DB current_json은 저작 데이터베이스 레코드의 기준 원본이다.
  // 일반 기본값 보충은 계속 금지한다. 이 제한적 이전만 2026-08 아이템 시드를 고친다.
  // 그대로 두면 손대지 않은 영문 껍데기가 project storage를 불러올 때마다 살아남기 때문이다.
  const requiredSkillIds = repairUntouchedDefaultItemCatalogStubs(value, referencedItemIds);
  appendMissingLoadRepairSkills(value, requiredSkillIds);
}

const RETIRED_EQUIPMENT_ITEM_ID_MAP: Readonly<Record<string, string>> = {
  item_bronze_sword: "equip_sword",
  item_iron_sword: "equip_iron_sword",
  item_steel_sword: "equip_steel_sword",
  item_scout_dagger: "equip_scout_dagger",
  item_mage_staff: "equip_mage_staff",
  item_oak_shield: "equip_oak_shield",
  item_leather_armor: "equip_leather_armor",
  item_mystic_robe: "equip_mystic_robe",
  item_traveler_hat: "equip_traveler_hat",
  item_focus_charm: "equip_focus_charm",
  item_iron_shield: "equip_iron_shield",
  item_steel_armor: "equip_steel_armor",
  item_mage_hat: "equip_mage_hat",
  item_gloves: "equip_gloves",
  item_boots: "equip_boots",
  item_cloak: "equip_cloak",
  item_ring: "equip_ring",
  item_necklace: "equip_necklace",
  item_focus_ring: "equip_focus_ring",
};

const RETIRED_EQUIPMENT_ITEM_STUB_IDS = new Set(Object.keys(RETIRED_EQUIPMENT_ITEM_ID_MAP));

function repairUntouchedDefaultItemCatalogStubs(
  project: Record<string, unknown>,
  referencedItemIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const requiredSkillIds = new Set<string>();
  if (!isRecord(project.database)) return requiredSkillIds;
  const database = project.database;
  if (!Array.isArray(database.items) || !Array.isArray(database.skills)) return requiredSkillIds;

  const itemDefaults = new Map(defaultItemRecords().map((record) => [record.id, record]));
  const authoredItemIds = new Set(
    database.items
      .filter((record) => isRecord(record) && typeof record.id === "string" && !isUntouchedLegacyItemStub(record))
      .map((record) => (record as Record<string, unknown>).id as string),
  );
  database.items = database.items.flatMap((record) => {
    if (!isRecord(record) || typeof record.id !== "string" || !isUntouchedLegacyItemStub(record)) return [record];
    if (authoredItemIds.has(record.id)) return [];
    const current = itemDefaults.get(record.id);
    if (current) {
      const replacement = filteredLoadRepairItem(current, database);
      for (const skillId of [replacement.skillId, replacement.learnedSkillId, replacement.activateSkillId]) {
        if (typeof skillId === "string") requiredSkillIds.add(skillId);
      }
      return [replacement];
    }
    if (!RETIRED_EQUIPMENT_ITEM_STUB_IDS.has(record.id)) return [record];
    return referencedItemIds.has(record.id) ? [retiredEquipmentItemReplacement(record)] : [];
  });
  return requiredSkillIds;
}

function filteredLoadRepairItem(
  record: unknown,
  database: Record<string, unknown>,
): Record<string, unknown> {
  const item = cloneRecord(record);
  const actorIds = recordIds(database.actors);
  const classIds = recordIds(database.classes);
  const stateIds = recordIds(database.states);
  const elementIds = recordIds(database.elements);
  filterIdArray(item, "usableActorIds", actorIds);
  filterIdArray(item, "usableClassIds", classIds);
  filterIdArray(item, "healStateIds", stateIds);
  filterStateEffects(item, stateIds);
  if (isRecord(item.equipmentProfile)) {
    filterIdArray(item.equipmentProfile, "equippableActorIds", actorIds);
    filterIdArray(item.equipmentProfile, "equippableClassIds", classIds);
    filterIdArray(item.equipmentProfile, "stateInflictIds", stateIds);
    filterIdArray(item.equipmentProfile, "stateDefenseIds", stateIds);
    filterIdArray(item.equipmentProfile, "attackElementIds", elementIds);
    filterIdArray(item.equipmentProfile, "elementalDefenseIds", elementIds);
  }
  return item;
}

function appendMissingLoadRepairSkills(
  project: Record<string, unknown>,
  requiredSkillIds: ReadonlySet<string>,
): void {
  if (requiredSkillIds.size === 0 || !isRecord(project.database)) return;
  const database = project.database;
  if (!Array.isArray(database.skills)) return;
  const skillIds = recordIds(database.skills);
  const stateIds = recordIds(database.states);
  const elementIds = recordIds(database.elements);
  for (const defaultSkill of defaultSkillRecords()) {
    if (!requiredSkillIds.has(defaultSkill.id) || skillIds.has(defaultSkill.id)) continue;
    const skill = cloneRecord(defaultSkill);
    filterStateEffects(skill, stateIds);
    if (typeof skill.elementId === "string" && !elementIds.has(skill.elementId)) delete skill.elementId;
    database.skills.push(skill);
    skillIds.add(defaultSkill.id);
  }
}

function retiredEquipmentItemReplacement(record: Record<string, unknown>): Record<string, unknown> {
  const id = typeof record.id === "string" ? record.id : "";
  const equipmentId = RETIRED_EQUIPMENT_ITEM_ID_MAP[id];
  const equipment = equipmentId
    ? defaultEquipmentRecords().find((entry) => entry.id === equipmentId)
    : undefined;
  // 알 수 없는 이전 id는 로드를 막지 않는다. 복구 대상이 아니었던 원본 행을 그대로 둔다.
  if (!equipment) return record;
  return {
    ...record,
    name: equipment.name,
    description: `이전 아이템 목록에 남아 있던 ${equipment.name} 항목입니다. 착용 가능한 버전은 장비 탭에 있습니다.`,
    occasion: "never",
    occasionField: false,
    occasionBattle: false,
    consumable: false,
  };
}

function recordIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.flatMap((entry) => isRecord(entry) && typeof entry.id === "string" ? [entry.id] : []));
}

function filterIdArray(record: Record<string, unknown>, key: string, existingIds: ReadonlySet<string>): void {
  if (!Array.isArray(record[key])) return;
  record[key] = record[key].filter((id): id is string => typeof id === "string" && existingIds.has(id));
}

function filterStateEffects(record: Record<string, unknown>, stateIds: ReadonlySet<string>): void {
  if (!Array.isArray(record.stateEffects)) return;
  record.stateEffects = record.stateEffects.filter((effect) => (
    isRecord(effect) && typeof effect.stateId === "string" && stateIds.has(effect.stateId)
  ));
}

function ensureLoadRepairBattleAnimations(project: Record<string, unknown>): void {
  if (!isRecord(project.database) || !Array.isArray(project.database.battleAnimations)) return;
  ensureBundledBattleAnimations({
    database: { battleAnimations: project.database.battleAnimations as BattleAnimationRecord[] },
  });
}

function hasUntouchedLegacyItemStub(project: Record<string, unknown>): boolean {
  if (!isRecord(project.database) || !Array.isArray(project.database.items)) return false;
  return project.database.items.some((record) => isRecord(record) && isUntouchedLegacyItemStub(record));
}

function isUntouchedLegacyItemStub(record: Record<string, unknown>): boolean {
  if (typeof record.id !== "string" || !record.id.startsWith("item_")) return false;
  const slug = record.id.slice("item_".length).replaceAll("_", "-");
  const oldName = slug.replaceAll("-", " ");
  // 두 필드가 모두 옛 시드 모양이어야 한다. 이름이나 설명 하나라도 다르면 저작 데이터다.
  return record.name === oldName && record.description === `${slug} 기본 아이템입니다.`;
}

function pruneInvalidVillageInfoDocuments(project: Record<string, unknown>): void {
  if (!isRecord(project.maps) || !Array.isArray(project.villageInfoDocuments)) return;
  const mapIds = new Set(Object.keys(project.maps));
  project.villageInfoDocuments = project.villageInfoDocuments.filter((entry) => {
    if (!isRecord(entry)) return true;
    return typeof entry.mapId !== "string" || mapIds.has(entry.mapId);
  });
}

function appendMissingResourceProfiles(project: Record<string, unknown>, defaults: readonly { readonly assetId?: string }[]): void {
  const target = ensureArray(project, "resourceProfiles");
  const assetIds = new Set(target.map(resourceAssetId).filter((assetId): assetId is string => assetId !== undefined));
  for (const profile of defaults) {
    if (!profile.assetId || assetIds.has(profile.assetId)) continue;
    target.push(cloneRecord(profile));
    assetIds.add(profile.assetId);
  }
}

function ensureArray(container: Record<string, unknown>, key: string): unknown[] {
  const value = container[key];
  if (Array.isArray(value)) return value;
  const replacement: unknown[] = [];
  container[key] = replacement;
  return replacement;
}

function resourceAssetId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.assetId === "string" ? value.assetId : undefined;
}

function cloneRecord(value: unknown): Record<string, unknown> {
  const cloned: unknown = JSON.parse(JSON.stringify(value));
  if (!isRecord(cloned)) throw new Error("Default project repair record was not an object");
  return cloned;
}
