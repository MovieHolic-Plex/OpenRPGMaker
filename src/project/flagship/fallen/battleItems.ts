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
/** 대본(act1-script 19절) 드롭 — 늑대 가죽·독 주머니·별쇠 조각·별지기 인장·그을린 장갑. */
export const FS_WOLF_HIDE = "item_fs_wolf_hide";
export const FS_VENOM_SAC = "item_fs_venom_sac";
export const FS_STARIRON_SHARD = "item_fs_stariron_shard";
export const FS_KEEPER_SEAL = "item_fs_keeper_seal";
export const FS_SCORCHED_GLOVE = "item_fs_scorched_glove";

/** 이 모듈이 붙이는 모든 무기·아이템 id(검수·상점 목록용). */
export const FS_BATTLE_EQUIPMENT_IDS = [FS_SWORD_GALE, FS_SWORD_STAR, FS_SPEAR_PIKE, FS_SPEAR_STAR] as const;
export const FS_BATTLE_ITEM_IDS = [
  FS_FIRE_FLASK, FS_WATER_FLASK, FS_SMOKE_PELLET, FS_TONIC, FS_STAR_SCENT,
  FS_WOLF_FANG, FS_SPIDER_SILK, FS_WISP_EMBER, FS_STAR_SHARD,
  FS_WOLF_HIDE, FS_VENOM_SAC, FS_STARIRON_SHARD, FS_KEEPER_SEAL, FS_SCORCHED_GLOVE,
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
  potion.description = "아군 하나의 HP를 40 + 최대 HP 25%만큼 채운다.\n카엘이 마시면 170쯤 찬다.";
  const hiPotion = byId<ItemRecord>(db.items, FS_HI_POTION);
  hiPotion.hpRecovery = { flat: 100, percentMax: 50 };
  hiPotion.price = 180;
  hiPotion.description = "아군 하나의 HP를 100 + 최대 HP 50%만큼 채운다.\n카엘이 마시면 360쯤 찬다.";

  // ── 스킬 복제 도구 ───────────────────────────────────────────────────────
  const cloneSkill = (fromId: string, id: string, patch: Partial<SkillRecord>): void => {
    upsert(db.skills, normalizeSkillRecord({ ...clone(byId<SkillRecord>(db.skills, fromId)), ...patch, id }));
  };
  const cloneItem = (fromId: string, id: string, patch: Partial<ItemRecord>): void => {
    upsert(db.items, normalizeItemRecord({ ...clone(byId<ItemRecord>(db.items, fromId)), ...patch, id }));
  };

  // ── 던지는 병: 속성별 ─────────────────────────────────────────────────────
  cloneSkill("skill_item_thunder_stone", "skill_fs_fire_flask", { name: "불씨 병 효과", power: 80, elementId: "fire", description: "기름과 불씨를 던져 불 속성 피해를 준다." });
  cloneSkill("skill_item_thunder_stone", "skill_fs_water_flask", { name: "물 주머니 효과", power: 76, elementId: "water", description: "물을 끼얹어 물 속성 피해를 준다." });
  cloneItem("item_gen2_frost_vial", FS_FIRE_FLASK, {
    name: "불씨 병", price: 90, skillId: "skill_fs_fire_flask", activateSkillId: "skill_fs_fire_flask",
    description: "던지면 불 속성 피해를 준다.\n늑대에게 잘 듣는다.",
    iconResourceId: "cc0-jetrel-fire-bomb", imageResourceId: "cc0-jetrel-fire-bomb",
  });
  cloneItem("item_gen2_frost_vial", FS_WATER_FLASK, {
    name: "물 주머니", price: 70, skillId: "skill_fs_water_flask", activateSkillId: "skill_fs_water_flask",
    description: "던지면 물 속성 피해를 준다.\n도깨비불을 단번에 꺼 버린다.",
  });
  // 뇌전석·서리 유리병은 기존 것을 그대로 쓰되 설명에 상성을 밝힌다.
  byId<ItemRecord>(db.items, FS_THUNDER_STONE).description = "던지면 번개 속성 피해를 준다.\n돌 수호상에게 잘 듣고, 거미에게는 덜 듣는다.";
  byId<ItemRecord>(db.items, FS_FROST_VIAL).description = "던지면 얼음 속성 피해를 준다.\n도깨비불에게 잘 듣는다.";

  // ── 연막: 전투에서 확정으로 빠져나간다(엔진: skill.type "escape") ─────────────
  upsert(db.skills, normalizeSkillRecord({
    id: "skill_fs_smoke_pellet", name: "연막 효과", scope: "self", type: "escape", power: 0,
    animationId: "anim_magic", description: "연기로 몸을 숨기고 전투에서 빠져나간다.\n도망칠 수 없는 싸움에서는 못 쓴다.",
  }));
  upsert(db.items, normalizeItemRecord({
    id: FS_SMOKE_PELLET, name: "연막 구슬", type: "special", scope: "ally", price: 80,
    description: "전투 중에 쓰면 반드시 도망친다.\n보스와 싸울 때는 듣지 않는다.",
    iconResourceId: "cc0-jetrel-gen-smoke-ball", imageResourceId: "cc0-jetrel-gen-smoke-ball",
    skillId: "skill_fs_smoke_pellet", activateSkillId: "skill_fs_smoke_pellet", animationId: "anim_magic",
    occasion: "battle", occasionField: false, occasionBattle: true, consumable: true,
  }));

  // ── 강장제: 전투 동안 공격 상승 ─────────────────────────────────────────────
  cloneSkill("skill_item_guard", "skill_fs_tonic", {
    name: "투지 강장제 효과", description: "강장제를 마셔 공격이 올랐다.",
    stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }],
  });
  cloneItem("item_guard_talisman", FS_TONIC, {
    name: "투지 강장제", price: 120, skillId: "skill_fs_tonic", activateSkillId: "skill_fs_tonic",
    description: "아군 하나의 공격이 전투 끝까지 오른다.\n수호상처럼 단단한 적과 싸울 때 좋다.",
    iconResourceId: "cc0-jetrel-elixir", imageResourceId: "cc0-jetrel-elixir",
  });
  // 독 — 거미가 독침을 쏜다(전투가 끝나도 독이 남는다). 해독초가 그 답이다.
  cloneSkill("skill_item_poison_vial", "skill_fs_venom", { name: "독침", power: 24, description: "독침으로 찌른다.\n독이 오르면 걷기만 해도 체력이 깎인다." });
  const spider = byId<EnemyRecord>(db.enemies, "enemy_fs_spider");
  if (!spider.actions.some((a) => a.skillId === "skill_fs_venom")) {
    spider.actions = [
      { skillId: "skill_fs_venom", priority: 7, condition: { kind: "turn", start: 2, interval: 2 }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
      ...spider.actions,
    ];
  }
  const antidote = byId<ItemRecord>(db.items, FS_ANTIDOTE);
  antidote.description = "독을 푼다. 덤불거미의 독은 전투가 끝나도 남는다.";
  antidote.price = 30;

  // ── 필드 사용 잡화: 별빛 향 주머니 — 쓰면 한동안 숲의 짐승이 다가오지 않는다 ─────
  upsert(db.items, normalizeItemRecord({
    id: FS_STAR_SCENT, name: "별빛 향 주머니", type: "medicine", scope: "none", price: 150,
    description: "필드에서 쓰면 60걸음 동안 짐승이 다가오지 않는다.\n별빛 향을 맡으면 짐승 코가 무뎌진다고 한다.",
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
  // 이름·문장은 act1-script.md 19절이 정본이다(설명 + 한 줄 여운).
  goods(FS_WOLF_FANG, "늑대 송곳니", 35, "창 재료로 쓰는 날카로운 늑대 송곳니다.\n아직 따뜻하다.", "cc0-jetrel-gen-fang-beast");
  goods(FS_WOLF_HIDE, "늑대 가죽", 40, "두껍고 거친 늑대 가죽이다.\n숲지기 브람은 겨울마다 한 장씩 모아 둔다.", "cc0-jetrel-gen-pelt-wolf");
  goods(FS_SPIDER_SILK, "거미 비단", 30, "가볍고 질긴 거미줄 뭉치다.\n햇빛에 비추면 무지갯빛이 돈다.", "cc0-jetrel-gen-thread-silk");
  goods(FS_VENOM_SAC, "독 주머니", 50, "거미 독이 든 주머니다. 다룰 때 조심해야 한다.\n약방 오든이 비싸게 사 간다.", "cc0-jetrel-gen-poison-flask");
  goods(FS_WISP_EMBER, "푸른 불씨", 45, "도깨비불에서 떨어진 불씨다. 차갑게 탄다.\n손은 안 데는데, 주머니는 탄다.", "cc0-jetrel-gen-phoenix-ash");
  goods(FS_STARIRON_SHARD, "별쇠 조각", 220, "별에서 떨어진 쇳조각이다. 차고 환하다.\n만지면 아주 먼 데서 종소리가 들린다.", "cc0-jetrel-gen-ore-iron");
  goods(FS_KEEPER_SEAL, "별지기 인장", 300, "수호상이 쥐고 있던 옛 별지기 인장이다.\n뒷면에 이름 한 줄을 새겼다 지운 자국이 있다.", "cc0-jetrel-gen-badge-guard");
  goods(FS_SCORCHED_GLOVE, "그을린 장갑", 150, "빛 속성 저항이 조금 오르는 왼손 장갑이다.\n수놓은 이름이 지워져 있다. 카엘이 한참 들여다본다.", "cc0-jetrel-gloves");
  goods(FS_STAR_SHARD, "별조각", 400, "떨어진 별에서 나온 조각이다. 아주 드물다.\n상점에서 값을 잘 쳐 준다.", "cc0-jetrel-crystal");

  // ── 드롭 표 ────────────────────────────────────────────────────────────────
  const drops = (id: string, list: Array<{ itemId: string; ratePercent: number }>): void => {
    const enemy = byId<EnemyRecord>(db.enemies, id);
    enemy.rewards = { ...enemy.rewards, dropItemId: undefined, dropRatePercent: 0, drops: list.map((d) => ({ ...d, quantity: 1 })) } as EnemyRecord["rewards"];
  };
  drops("enemy_fs_wolf", [
    { itemId: FS_WOLF_FANG, ratePercent: 45 },
    { itemId: FS_WOLF_HIDE, ratePercent: 30 },
    { itemId: FS_POTION, ratePercent: 20 },
    { itemId: FS_STAR_SHARD, ratePercent: 4 },
    { itemId: FS_STARIRON_SHARD, ratePercent: 6 },
  ]);
  drops("enemy_fs_spider", [
    { itemId: FS_SPIDER_SILK, ratePercent: 45 },
    { itemId: FS_VENOM_SAC, ratePercent: 25 },
    { itemId: FS_ANTIDOTE, ratePercent: 25 },
    { itemId: FS_STAR_SCENT, ratePercent: 5 },
  ]);
  drops("enemy_fs_wisp", [
    { itemId: FS_WISP_EMBER, ratePercent: 40 },
    { itemId: FS_WATER_FLASK, ratePercent: 15 },
    { itemId: FS_TONIC, ratePercent: 6 },
  ]);

  // 보스: 수호상 = 인장(확정) + 별쇠 조각(35%), 발렌 = 그을린 장갑(확정). 이름 없는 인장·장갑은 이야기 소품이다.
  drops("enemy_fs_guardian", [
    { itemId: FS_KEEPER_SEAL, ratePercent: 100 },
    { itemId: FS_STARIRON_SHARD, ratePercent: 35 },
  ]);
  drops("enemy_fs_valen", [{ itemId: FS_SCORCHED_GLOVE, ratePercent: 100 }]);

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
    description: "공격 14, 민첩 +6, 급소 확률 +14%.\n가볍고 빨라서 먼저 움직이고 급소도 잘 낸다.",
    statBonuses: { attack: 14, defense: 0, mind: 0, agility: 6 }, attackElementIds: ["sword"], criticalRate: 14, accuracy: 100,
  });
  weapon(FS_SWORD_STAR, {
    name: "별쇠 장검", price: 640,
    description: "공격 22, 민첩 +10, 급소 확률 +22%. 바람결 검의 윗급이다.\n칼날에 별자리처럼 점이 박혀 있다.",
    statBonuses: { attack: 22, defense: 0, mind: 0, agility: 10 }, attackElementIds: ["sword"], criticalRate: 22, accuracy: 100,
  });
  weapon(FS_SPEAR_PIKE, {
    name: "푸른 불꽃 창", price: 220,
    description: "공격 22, 민첩 -3. 회피를 무시해 날랜 적도 꿰뚫는다.\n푸른 불씨를 먹은 쇠라 식어도 푸르다.",
    statBonuses: { attack: 22, defense: 0, mind: 0, agility: -3 }, attackElementIds: ["spear"], criticalRate: 2, accuracy: 100,
    effectFlags: { ...ZERO_FLAGS, ignoreDodge: true },
  });
  weapon(FS_SPEAR_STAR, {
    name: "별꿰기 창", price: 640,
    description: "공격 34, 민첩 -2. 회피를 무시한다. 푸른 불꽃 창의 윗급이다.\n별빛 맺힌 창끝은 수호상의 돌 몸도 꿰뚫는다.",
    statBonuses: { attack: 34, defense: 0, mind: 0, agility: -2 }, attackElementIds: ["spear"], criticalRate: 3, accuracy: 100,
    effectFlags: { ...ZERO_FLAGS, ignoreDodge: true },
  });
}
