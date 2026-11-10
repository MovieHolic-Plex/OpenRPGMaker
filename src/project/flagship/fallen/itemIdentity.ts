// 폴른 스타 · 아이템·장비 개성 1차(fs-item-identity, 감사 http://mdc-server:18301/fs-item-identity.html).
//
// 감사 결론(구운 게임 기준): 실제로 손에 들어오는 85개 중 장비 37개의 28개가 숫자나 계열 공통 특성뿐이었고,
// 무기 19개 중 14개는 같은 계열끼리 평타 특성이 똑같아 공격력만 달랐다. 청동 검 아이콘 하나를 창 세 자루를 포함한
// 무기 일곱 개가 같이 썼고, 쓰는 아이템 25개 중 18개가 같은 사용 그림을 나눠 썼다. 창기사 새라는 상점 창을 들 수 없었다.
//
// 이 층은 데이터만 바꾼다(엔진 무변경). 쓰는 엔진 경로:
//   평타 상태      EquipmentRecord.stateInflictIds/Chance → battle/runtime.ts applyNormalAttackEquipmentStates
//   2회·전체 평타  effectFlags.doubleAttack / attackAll(battleBattlers.ts equipmentRuntimeEffects)
//   계열 반감      elementalDefenseIds(battleElementModifiers.ts: 그 속성 피해 ×0.5)
//   피해 증감      damageDealtPercent / damageTakenPercent
//   MP 절반        effectFlags.halfMpCost
//   던지는 병      아이템 기술의 stateEffects
// 적 이름이나 적의 약점은 쓰지 않는다 — 방어구는 「내가 무엇을 덜 받는가」만 말한다(보스 약점은 숫자로 찾는다, 오너 결정).
// 새 그림 0장: 아이콘은 번들에 이미 있는 것으로 바꾼다.
//
// chronoBell.ts 가 무기 계열 특성(weaponTraits.ts)·기술 개성(heroSkillIdentity.ts) 다음, 표시 이름 정비 전에 부른다.
import type { EquipmentRecord, ItemRecord, Project, SkillRecord } from "@/project/types";

export const FS_SARAH_ACTOR = "actor_fs2_sarah";
export const FS_SARAH_CLASS = "class_fs2_lancer";
export const FS_SHOP_SPEARS = ["equip_gen_spear_iron", "equip_gen_halberd_guard", "equip_fs_spear_pike", "equip_fs_spear_star", "equip_fs2_rohan_spear"] as const;

const STAR_MARK_1 = "state_fs_star_mark_1";

export interface EquipmentTrait {
  readonly id: string;
  readonly traitLine: string;
  readonly numbersLine?: string;
  readonly patch: (record: EquipmentRecord) => void;
}

const replaceFamilyLine = (record: EquipmentRecord, line: string, numbers?: string): void => {
  const lines = record.description.split("\n").filter((row) => !row.startsWith("평타:") && !row.startsWith("착용:"));
  if (numbers && lines.length > 0 && /\d/.test(lines[0]!)) lines[0] = numbers;
  record.description = [...lines, line].join("\n");
};

export const FS_EQUIPMENT_TRAITS: readonly EquipmentTrait[] = [
  {
    id: "equip_fs_sword_star", traitLine: "평타: 맞히면 별 표식을 새긴다(화염검·단죄의 일섬이 터뜨린다).",
    numbersLine: "공격 22, 민첩 +10, 급소 확률 +22%.",
    patch: (r) => { r.criticalRate = 22; r.stateInflictIds = [STAR_MARK_1]; r.stateInflictionChance = 40; r.iconResourceId = r.imageResourceId = "cc0-jetrel-steel-sword"; },
  },
  {
    id: "equip_fs_sword_gale", traitLine: "평타: 한 번에 두 번 벤다.",
    numbersLine: "공격 0, 민첩 +6, 급소 확률 +24%.",
    patch: (r) => { r.statBonuses = { ...r.statBonuses, attack: 0 }; r.effectFlags = { ...r.effectFlags, doubleAttack: true }; r.iconResourceId = r.imageResourceId = "cc0-jetrel-gen-rapier-noble"; },
  },
  {
    id: "equip_gen_sword_flame", traitLine: "평타: 맞히면 가끔 불이 붙는다.",
    patch: (r) => { r.stateInflictIds = ["fs_state_burn"]; r.stateInflictionChance = 30; },
  },
  {
    id: "equip_gen_sword_steel", traitLine: "착용: 받는 피해가 10% 준다.",
    patch: (r) => { r.damageTakenPercent = -10; },
  },
  {
    id: "equip_gen_halberd_guard", traitLine: "평타: 적 전체를 휩쓴다. 대신 주는 피해가 30% 준다.",
    patch: (r) => { r.statBonuses = { ...r.statBonuses, attack: 15 }; r.damageDealtPercent = -30; r.effectFlags = { ...r.effectFlags, attackAll: true }; r.iconResourceId = r.imageResourceId = "cc0-jetrel-gen-halberd-guard"; },
  },
  {
    id: "equip_fs_spear_star", traitLine: "평타: 맞히면 가끔 관통상을 낸다(마법이 세 배로 들어간다).",
    patch: (r) => { r.stateInflictIds = ["state_fs_pierced"]; r.stateInflictionChance = 20; r.iconResourceId = r.imageResourceId = "cc0-jetrel-gen-spear-iron"; },
  },
  {
    id: "equip_fs_spear_pike", traitLine: "평타: 맞히면 가끔 방어를 깎는다.",
    patch: (r) => { r.iconResourceId = r.imageResourceId = "cc0-jetrel-gen-spear-iron"; },
  },
  {
    id: "equip_gen_staff_crystal", traitLine: "착용: 기술 MP가 절반만 든다.",
    patch: (r) => { r.statBonuses = { ...r.statBonuses, mind: 4 }; r.effectFlags = { ...r.effectFlags, halfMpCost: true }; },
  },
  {
    id: "equip_gen_wand_spark", traitLine: "착용: 주는 피해 +15%, 받는 피해도 +15%.",
    patch: (r) => { r.damageDealtPercent = 15; r.damageTakenPercent = 15; },
  },
  {
    id: "equip_gen_gun_flint", traitLine: "평타: 맞히면 가끔 불이 붙는다.",
    patch: (r) => { r.stateInflictIds = ["fs_state_burn"]; r.stateInflictionChance = 25; },
  },
  {
    id: "equip_gen_armor_chain", traitLine: "착용: 베기 피해를 반만 받는다.",
    patch: (r) => { r.elementalDefenseIds = ["sword"]; },
  },
  {
    id: "equip_gen_shield_iron", traitLine: "착용: 빛 피해를 반만 받는다.",
    patch: (r) => { r.elementalDefenseIds = ["holy"]; },
  },
  {
    id: "equip_gen_robe_mage", traitLine: "착용: 불 피해를 반만 받는다.",
    patch: (r) => { r.elementalDefenseIds = ["fire"]; },
  },
];

export const FS_EQUIPMENT_ICONS: Readonly<Record<string, string>> = {
  equip_fs_star_rod: "cc0-jetrel-gen-thunder-rod",
  equip_fs_judgment_blade: "cc0-jetrel-iron-sword",
  equip_fs2_rohan_spear: "cc0-jetrel-gen-spear-iron",
};

export const FS_ITEM_ICONS: Readonly<Record<string, string>> = {
  fs_bread_starlight: "oprn-item-food-bread-4",
  fs_bread_hearty: "oprn-item-food-bread-3",
  fs_bread_ember: "oprn-item-food-bread-2",
  fs_bread_wish: "oprn-item-food-bread-1",
};

interface ThrownTrait { readonly itemId: string; readonly stateId: string; readonly chance: number; readonly line: string }

export const FS_THROWN_TRAITS: readonly ThrownTrait[] = [
  { itemId: "item_fs_water_flask", stateId: "state_wet", chance: 100, line: "맞은 적은 젖는다(번개가 두 배, 불은 반)." },
  { itemId: "item_gen2_frost_vial", stateId: "state_agility_down", chance: 50, line: "맞으면 가끔 둔해진다." },
  { itemId: "item_fs_fire_flask", stateId: "fs_state_burn", chance: 60, line: "맞으면 가끔 불이 붙는다." },
];

export const FS_PANACEA_CURES = ["state_poison", "state_deep_poison", "state_sleep", "state_paralysis", "state_silence", "state_blind", "fs_state_burn"] as const;

export interface ItemIdentityReport {
  readonly applied: string[];
  readonly skipped: string[];
}

export function applyFallenItemIdentity(project: Project): ItemIdentityReport {
  const report = { applied: [] as string[], skipped: [] as string[] };
  const db = project.database;
  const equipment = (id: string): EquipmentRecord | undefined => db.equipment.find((row) => row.id === id);
  const item = (id: string): ItemRecord | undefined => db.items.find((row) => row.id === id);
  const skill = (id: string | undefined): SkillRecord | undefined => (id ? db.skills.find((row) => row.id === id) : undefined);
  const stateIds = new Set(db.states.map((row) => row.id));

  for (const trait of FS_EQUIPMENT_TRAITS) {
    const record = equipment(trait.id);
    if (!record) { report.skipped.push(`${trait.id} — 장비 없음`); continue; }
    trait.patch(record);
    for (const stateId of record.stateInflictIds) if (!stateIds.has(stateId)) throw new Error(`[fallen-star] ${trait.id} 평타 상태 ${stateId} 이 없다`);
    replaceFamilyLine(record, trait.traitLine, trait.numbersLine);
    report.applied.push(`${record.name}: ${trait.traitLine}`);
  }
  for (const id of FS_SHOP_SPEARS) {
    const record = equipment(id);
    if (!record) { report.skipped.push(`새라 창 ${id} — 장비 없음`); continue; }
    if (!record.equippableActorIds.includes(FS_SARAH_ACTOR)) record.equippableActorIds = [...record.equippableActorIds, FS_SARAH_ACTOR];
    if (!record.equippableClassIds.includes(FS_SARAH_CLASS)) record.equippableClassIds = [...record.equippableClassIds, FS_SARAH_CLASS];
    report.applied.push(`새라 장착: ${record.name}`);
  }
  for (const [id, icon] of Object.entries(FS_EQUIPMENT_ICONS)) {
    const record = equipment(id);
    if (!record) { report.skipped.push(`아이콘 ${id} — 장비 없음`); continue; }
    record.iconResourceId = icon;
    record.imageResourceId = icon;
  }
  for (const [id, icon] of Object.entries(FS_ITEM_ICONS)) {
    const record = item(id);
    if (!record) { report.skipped.push(`아이콘 ${id} — 아이템 없음`); continue; }
    record.iconResourceId = icon;
    record.imageResourceId = icon;
  }
  for (const trait of FS_THROWN_TRAITS) {
    const record = item(trait.itemId);
    const effect = skill(record?.activateSkillId ?? record?.skillId);
    if (!record || !effect) { report.skipped.push(`던지기 ${trait.itemId} — 아이템·기술 없음`); continue; }
    if (!stateIds.has(trait.stateId)) throw new Error(`[fallen-star] 던지기 상태 ${trait.stateId} 이 없다`);
    effect.stateEffects = [...(effect.stateEffects ?? []).filter((row) => row.stateId !== trait.stateId), { stateId: trait.stateId, chance: trait.chance, operation: "add" }];
    const base = record.description.split("\n")[0] ?? record.description;
    record.description = `${base}\n${trait.line}`;
    report.applied.push(`${record.name}: ${trait.line}`);
  }
  const panacea = item("item_panacea");
  if (panacea) {
    const cures = FS_PANACEA_CURES.filter((id) => stateIds.has(id));
    panacea.healStateIds = [...cures];
    panacea.stateEffects = cures.map((stateId) => ({ stateId, chance: 100, operation: "remove" as const }));
    const cureSkill = skill(panacea.activateSkillId ?? panacea.skillId);
    if (cureSkill) cureSkill.stateEffects = cures.map((stateId) => ({ stateId, chance: 100, operation: "remove" as const }));
    const names = cures.map((id) => db.states.find((row) => row.id === id)!.name);
    panacea.description = `${names.join("·")}을 한 번에 푼다.`;
    panacea.price = Math.max(panacea.price, 100);
    report.applied.push(`만능약: ${cures.length}가지를 푼다`);
  } else report.skipped.push("만능약 — 아이템 없음");
  return report;
}
