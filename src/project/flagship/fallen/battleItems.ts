/**
 * 『폴른 스타』 전투·아이템·경제 데이터(전투 담당, 2026-10-23).
 * 적 속성 상성 · 검/창 두 무기 계열 · 회복약 재조정 · 잡화 기믹 · 드롭 표를 한 모듈에 둔다.
 * chronoBell.ts 는 이 모듈의 `applyFallenBattleItems(project)` 한 줄만 부른다(setupFoes 뒤, 장 구성 앞).
 *
 * 아래 `FS_*` id 는 안정 계약이다 — 마을(상점·대장간·상자)과 대화가 이 id 로 아이템을 판다·준다.
 */
import { normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import type { EnemyRecord, EquipmentRecord, ItemRecord, Project, SkillRecord } from "@/project/types";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";

const ZERO_FLAGS = {
  preemptive: false, doubleAttack: false, attackAll: false, ignoreDodge: false, preventCriticalHits: false,
  increasePhysicalDodge: false, halfMpCost: false, negateTerrainDamage: false, fixedEquipment: false,
};

/** 검 계열 — 빠르고 급소가 잘 난다. 시작 무기 청동 검(equip_sword) 위. */
export const FS_SWORD_GALE = "equip_fs_sword_gale";
export const FS_SWORD_STAR = "equip_fs_sword_star";
/** 창 계열 — 공격이 높고 회피를 무시하며 창이 약점인 적을 뚫는다. 느리다. */
export const FS_SPEAR_PIKE = "equip_fs_spear_pike";
export const FS_SPEAR_STAR = "equip_fs_spear_star";
/** 회복(기존 id 유지, 값만 바꾼다). */
export const FS_POTION = "item_potion";
export const FS_HI_POTION = "item_hi_potion";
/** 기믹 잡화. */
export const FS_FIRE_FLASK = "item_fs_fire_flask";
export const FS_WATER_FLASK = "item_fs_water_flask";
export const FS_THUNDER_STONE = "item_thunder_stone";
export const FS_FROST_VIAL = "item_gen2_frost_vial";
export const FS_SMOKE_PELLET = "item_fs_smoke_pellet";
export const FS_ANTIDOTE = "item_antidote";
export const FS_TONIC = "item_fs_tonic";
export const FS_STAR_SCENT = "item_fs_star_scent";
/** 드롭 재료(팔 수 있는 잡동사니) — 상점이 사 준다. */
export const FS_WOLF_FANG = "item_fs_wolf_fang";
export const FS_SPIDER_SILK = "item_fs_spider_silk";
export const FS_WISP_EMBER = "item_fs_wisp_ember";
export const FS_STAR_SHARD = "item_fs_star_shard";

/** 이 모듈이 붙이는 모든 무기·아이템 id(검수·상점 목록용). */
export const FS_BATTLE_EQUIPMENT_IDS = [FS_SWORD_GALE, FS_SWORD_STAR, FS_SPEAR_PIKE, FS_SPEAR_STAR] as const;
export const FS_BATTLE_ITEM_IDS = [
  FS_FIRE_FLASK, FS_WATER_FLASK, FS_SMOKE_PELLET, FS_TONIC, FS_STAR_SCENT,
  FS_WOLF_FANG, FS_SPIDER_SILK, FS_WISP_EMBER, FS_STAR_SHARD,
] as const;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function upsert<T extends { id: string }>(list: T[], record: T): void {
  const at = list.findIndex((r) => r.id === record.id);
  if (at >= 0) list[at] = record; else list.push(record);
}

type Grade = "A" | "B" | "C" | "D" | "E";

export function applyFallenBattleItems(project: Project): void {
  const db = project.database;
  const byId = <T extends { id: string }>(list: T[], id: string): T => {
    const found = list.find((r) => r.id === id);
    if (!found) throw new Error(`[fallen-star] 견본 ${id} 이 없다`);
    return found;
  };

  // ── 속성 상성 ────────────────────────────────────────────────────────────
  // 등급 A=약점(200%) B=조금 약함(150%) C=보통 D=저항(50%) E=무효. 기본은 전부 C.
  const rates = (id: string, patch: Record<string, Grade>): void => {
    const enemy = byId<EnemyRecord>(db.enemies, id);
    enemy.elementRates = { ...enemy.elementRates, ...patch };
  };
  rates("enemy_fs_wolf", { fire: "A", sword: "B", water: "D" }); // 짐승 — 불을 무서워하고 검에 깊이 베인다
  rates("enemy_fs_spider", { spear: "A", fire: "B", thunder: "D" }); // 얇은 몸통 — 창이 꿰뚫는다
  rates("enemy_fs_wisp", { water: "A", ice: "B", sword: "D", spear: "D", fire: "E" }); // 도깨비불 — 날붙이는 스치고 물에 꺼진다
  rates("enemy_fs_guardian", { sword: "D", spear: "A", thunder: "B", earth: "E" }); // 돌 거인 — 날은 튕기고 창끝 틈을 번개가 탄다
  rates("enemy_fs_valen", { holy: "A", dark: "D" });

  // ── 회복약: 정액 + 최대 HP 비율(이 시점 파티 HP 는 레벨 6 에 500 대) ──────────
  const potion = byId<ItemRecord>(db.items, FS_POTION);
  potion.hpRecovery = { flat: 40, percentMax: 25 };
  potion.price = 60;
  potion.description = "아군 하나의 HP를 40 + 최대 HP의 25% 만큼 회복합니다. (카엘 기준 약 170)";
  const hiPotion = byId<ItemRecord>(db.items, FS_HI_POTION);
  hiPotion.hpRecovery = { flat: 100, percentMax: 50 };
  hiPotion.price = 180;
  hiPotion.description = "아군 하나의 HP를 100 + 최대 HP의 50% 만큼 회복합니다. (카엘 기준 약 360)";

  // ── 스킬 복제 도구 ───────────────────────────────────────────────────────
  const cloneSkill = (fromId: string, id: string, patch: Partial<SkillRecord>): void => {
    upsert(db.skills, normalizeSkillRecord({ ...clone(byId<SkillRecord>(db.skills, fromId)), ...patch, id }));
  };
  const cloneItem = (fromId: string, id: string, patch: Partial<ItemRecord>): void => {
    upsert(db.items, normalizeItemRecord({ ...clone(byId<ItemRecord>(db.items, fromId)), ...patch, id }));
  };

  // ── 던지는 병: 속성별 ─────────────────────────────────────────────────────
  cloneSkill("skill_item_thunder_stone", "skill_fs_fire_flask", { name: "불씨 병 효과", power: 80, elementId: "fire", description: "기름과 불씨를 던져 불 속성 피해를 줍니다." });
  cloneSkill("skill_item_thunder_stone", "skill_fs_water_flask", { name: "물 주머니 효과", power: 76, elementId: "water", description: "물을 쏟아 물 속성 피해를 줍니다." });
  cloneItem("item_gen2_frost_vial", FS_FIRE_FLASK, {
    name: "불씨 병", price: 90, skillId: "skill_fs_fire_flask", activateSkillId: "skill_fs_fire_flask",
    description: "던지면 불 속성 피해. 늑대·거미에게 효과가 굉장하지만 도깨비불에는 소용없다.",
    iconResourceId: "cc0-jetrel-fire-bomb", imageResourceId: "cc0-jetrel-fire-bomb",
  });
  cloneItem("item_gen2_frost_vial", FS_WATER_FLASK, {
    name: "물 주머니", price: 70, skillId: "skill_fs_water_flask", activateSkillId: "skill_fs_water_flask",
    description: "던지면 물 속성 피해. 도깨비불의 불꽃을 단번에 꺼 버린다.",
  });
  // 뇌전석·서리 유리병은 기존 것을 그대로 쓰되 설명에 상성을 밝힌다.
  byId<ItemRecord>(db.items, FS_THUNDER_STONE).description = "던지면 번개 속성 피해. 돌 수호상의 틈을 파고든다. 거미줄은 번개를 흘려보낸다.";
  byId<ItemRecord>(db.items, FS_FROST_VIAL).description = "던지면 얼음 속성 피해. 도깨비불의 불꽃을 식힌다.";

  // ── 연막: 전투에서 확정으로 빠져나간다(엔진: skill.type "escape") ─────────────
  upsert(db.skills, normalizeSkillRecord({
    id: "skill_fs_smoke_pellet", name: "연막 효과", scope: "self", type: "escape", power: 0,
    animationId: "anim_magic", description: "연기로 몸을 숨기고 전투에서 빠져나갑니다. 도망칠 수 없는 싸움에서는 막힙니다.",
  }));
  upsert(db.items, normalizeItemRecord({
    id: FS_SMOKE_PELLET, name: "연막 구슬", type: "special", scope: "ally", price: 80,
    description: "전투 중 쓰면 확실하게 도망칩니다(보스전 제외). 도망 확률이 불안할 때 쓰는 구슬.",
    iconResourceId: "cc0-jetrel-gen-smoke-ball", imageResourceId: "cc0-jetrel-gen-smoke-ball",
    skillId: "skill_fs_smoke_pellet", activateSkillId: "skill_fs_smoke_pellet", animationId: "anim_magic",
    occasion: "battle", occasionField: false, occasionBattle: true, consumable: true,
  }));

  // ── 강장제: 전투 동안 공격 상승 ─────────────────────────────────────────────
  cloneSkill("skill_item_guard", "skill_fs_tonic", {
    name: "투지 강장제 효과", description: "공격이 오르는 강장제의 효과입니다.",
    stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }],
  });
  cloneItem("item_guard_talisman", FS_TONIC, {
    name: "투지 강장제", price: 120, skillId: "skill_fs_tonic", activateSkillId: "skill_fs_tonic",
    description: "전투 중 마시면 아군 하나의 공격이 오릅니다(전투 종료까지). 방어가 두꺼운 수호상 앞에서 빛납니다.",
    iconResourceId: "cc0-jetrel-elixir", imageResourceId: "cc0-jetrel-elixir",
  });
  // 독 — 거미가 독침을 쏜다(전투가 끝나도 독이 남는다). 해독초가 그 답이다.
  cloneSkill("skill_item_poison_vial", "skill_fs_venom", { name: "독침", power: 24, description: "독침을 찌른다. 독에 걸리면 걸어도 체력이 깎인다." });
  const spider = byId<EnemyRecord>(db.enemies, "enemy_fs_spider");
  if (!spider.actions.some((a) => a.skillId === "skill_fs_venom")) {
    spider.actions = [
      { skillId: "skill_fs_venom", priority: 7, condition: { kind: "turn", start: 2, interval: 2 }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
      ...spider.actions,
    ];
  }
  const antidote = byId<ItemRecord>(db.items, FS_ANTIDOTE);
  antidote.description = "독 상태를 해제합니다. 덤불거미의 독침은 전투가 끝나도 남습니다.";
  antidote.price = 30;

  // ── 필드 사용 잡화: 별빛 향 주머니 — 쓰면 한동안 숲의 짐승이 다가오지 않는다 ─────
  upsert(db.items, normalizeItemRecord({
    id: FS_STAR_SCENT, name: "별빛 향 주머니", type: "medicine", scope: "none", price: 150,
    description: "필드에서 쓰면 60걸음 동안 야생 짐승이 다가오지 않습니다. 별빛 향이 짐승의 코를 흐린다고 합니다.",
    iconResourceId: "cc0-jetrel-focus-charm", imageResourceId: "cc0-jetrel-focus-charm",
    occasion: "field", occasionField: true, occasionBattle: false, consumable: true, repelSteps: 60,
  }));

  // ── 드롭 재료 ─────────────────────────────────────────────────────────────
  const goods = (id: string, name: string, price: number, description: string, icon: string): void => {
    upsert(db.items, normalizeItemRecord({
      id, name, type: "normalGoods", scope: "none", price, description,
      iconResourceId: icon, imageResourceId: icon, occasion: "never", consumable: false,
    }));
  };
  goods(FS_WOLF_FANG, "늑대 송곳니", 35, "숲늑대의 송곳니. 대장간과 상점이 값을 쳐 줍니다.", "cc0-jetrel-gen-fang-beast");
  goods(FS_SPIDER_SILK, "거미줄 뭉치", 30, "덤불거미의 질긴 거미줄. 상점에 팔 수 있습니다.", "cc0-jetrel-gen-thread-silk");
  goods(FS_WISP_EMBER, "도깨비불 불씨", 45, "꺼지지 않는 푸른 불씨. 팔면 값이 꽤 나갑니다.", "cc0-jetrel-gen-phoenix-ash");
  goods(FS_STAR_SHARD, "별조각", 400, "떨어진 별의 파편. 아주 드물게 나옵니다. 비싸게 팔립니다.", "cc0-jetrel-crystal");

  // ── 드롭 표 ────────────────────────────────────────────────────────────────
  const drops = (id: string, list: Array<{ itemId: string; ratePercent: number }>): void => {
    const enemy = byId<EnemyRecord>(db.enemies, id);
    enemy.rewards = { ...enemy.rewards, dropItemId: undefined, dropRatePercent: 0, drops: list.map((d) => ({ ...d, quantity: 1 })) } as EnemyRecord["rewards"];
  };
  drops("enemy_fs_wolf", [
    { itemId: FS_WOLF_FANG, ratePercent: 45 },
    { itemId: FS_POTION, ratePercent: 20 },
    { itemId: FS_STAR_SHARD, ratePercent: 4 },
  ]);
  drops("enemy_fs_spider", [
    { itemId: FS_SPIDER_SILK, ratePercent: 45 },
    { itemId: FS_ANTIDOTE, ratePercent: 25 },
    { itemId: FS_STAR_SCENT, ratePercent: 5 },
  ]);
  drops("enemy_fs_wisp", [
    { itemId: FS_WISP_EMBER, ratePercent: 40 },
    { itemId: FS_WATER_FLASK, ratePercent: 15 },
    { itemId: FS_TONIC, ratePercent: 6 },
  ]);

  // ── 무기: 검 vs 창 ─────────────────────────────────────────────────────────
  const hero = [DEFAULT_ACTOR_ID];
  const base = byId<EquipmentRecord>(db.equipment, "equip_sword");
  const weapon = (id: string, patch: Partial<EquipmentRecord>): void => {
    upsert(db.equipment, normalizeEquipmentRecord({
      ...clone(base), equippableActorIds: hero, twoHanded: false, effectFlags: { ...ZERO_FLAGS }, ...patch, id, slot: "weapon",
    } as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">));
  };
  weapon(FS_SWORD_GALE, {
    name: "바람결 검", price: 220,
    description: "가볍고 빠른 검. 공격 14 · 민첩 +6 · 급소 확률 +14%. 행동이 빨라지고 급소가 잘 난다. 늑대·도깨비불(날 저항) 상대로 쓰기 전에 약점을 보자.",
    statBonuses: { attack: 14, defense: 0, mind: 0, agility: 6 }, attackElementIds: ["sword"], criticalRate: 14, accuracy: 100,
  });
  weapon(FS_SWORD_STAR, {
    name: "별벼림 검", price: 640,
    description: "별빛으로 벼린 검. 공격 22 · 민첩 +10 · 급소 확률 +22%. 바람결 검의 상위 — 빠르고 급소가 더 잘 난다.",
    statBonuses: { attack: 22, defense: 0, mind: 0, agility: 10 }, attackElementIds: ["sword"], criticalRate: 22, accuracy: 100,
  });
  weapon(FS_SPEAR_PIKE, {
    name: "철심 창", price: 220,
    description: "무겁고 긴 창. 공격 22 · 민첩 -3 · 회피 무시. 한 방이 강하고 날랜 적도 꿰뚫는다. 거미·수호상은 창에 약하다. 느린 대신 급소는 잘 나지 않는다.",
    statBonuses: { attack: 22, defense: 0, mind: 0, agility: -3 }, attackElementIds: ["spear"], criticalRate: 2, accuracy: 100,
    effectFlags: { ...ZERO_FLAGS, ignoreDodge: true },
  });
  weapon(FS_SPEAR_STAR, {
    name: "별꿰기 창", price: 640,
    description: "별빛 창끝. 공격 34 · 민첩 -2 · 회피 무시. 철심 창의 상위 — 수호상의 돌 몸도 꿰뚫는다.",
    statBonuses: { attack: 34, defense: 0, mind: 0, agility: -2 }, attackElementIds: ["spear"], criticalRate: 3, accuracy: 100,
    effectFlags: { ...ZERO_FLAGS, ignoreDodge: true },
  });
}
