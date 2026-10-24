/**
 * 『폴른 스타』 기술 역할·적 설계·보스(발렌) 재설계(전투 담당, 2026-10-24).
 *
 * 사용자 지적: 「기술마다 뭐가 다른지 모르겠다 — 그냥 센 것뿐인가」. 1막 파티 기술은 전부 「단일 피해, 위력 62~90」이었다.
 * 이 모듈은 기술마다 **한 가지 역할**을 엔진이 이미 아는 수단(속성·상태·다단·방어 무시·무기 공명·광역·힘 모으기·흡수)으로 준다.
 * 적은 그 역할이 필요한 모양으로 다시 짠다 — 단단한 적(방어 무시·방어 하락), 떼(광역), 속성 적(약점), 치유사(먼저 잡기).
 * 설명은 게임 안에서 한 줄로 「무엇이 다른가」를 말한다.
 *
 * chronoBell.ts 는 `applyFallenBattleRoles(project)` 한 줄만 부른다(applyFallenBattleItems 다음).
 */
import { normalizeEquipmentRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { ActorRateGrade, EnemyRecord, EquipmentRecord, ItemRecord, Project, SkillRecord, StateRecord } from "@/project/types";
import type { Command } from "@/project/types/events";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";

/** 발렌을 쓰러뜨리면 떨어지는 시그니처 무기. */
export const FS_JUDGMENT_BLADE = "equip_fs_judgment_blade";
/** 그 무기가 주는 기술. */
export const FS_VERDICT_SKILL = "skill_fs_verdict";
/** 엘레나의 MP 회복 기술. */
export const FS_MEDITATE_SKILL = "skill_fs_meditate";
/** 새 적. */
export const FS_BEETLE = "enemy_fs_beetle";
export const FS_MOSS = "enemy_fs_moss";
/** 이리스의 무기(원거리 = 활 계열). */
export const FS_STAR_ROD = "equip_fs_star_rod";
const IRIS = "actor_fs_iris";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function upsert<T extends { id: string }>(list: T[], record: T): void {
  const at = list.findIndex((r) => r.id === record.id);
  if (at >= 0) list[at] = record; else list.push(record);
}

type SkillPatch = Partial<SkillRecord> & { readonly description: string };

export function applyFallenBattleRoles(project: Project): void {
  const db = project.database;
  const find = <T extends { id: string }>(list: T[], id: string): T => {
    const found = list.find((r) => r.id === id);
    if (!found) throw new Error(`[fallen-star] 전투 역할: ${id} 이 없다`);
    return found;
  };
  /** 기존 기술을 고쳐 쓴다 — 기본 DB 의 같은 id 를 다른 게임도 쓰므로, 이 게임 사본(project.database)만 바꾼다. */
  const tune = (id: string, patch: SkillPatch): void => {
    const base = find<SkillRecord>(db.skills, id);
    upsert(db.skills, normalizeSkillRecord({ ...clone(base), ...patch, id }));
  };
  const make = (fromId: string, id: string, patch: SkillPatch & { readonly name: string }): void => {
    upsert(db.skills, normalizeSkillRecord({ ...clone(find<SkillRecord>(db.skills, fromId)), ...patch, id }));
  };

  // ── 상태: 확률·저항·최대 지속 ──────────────────────────────────────────────
  // 수면은 「맞으면 깬다」(100%) + 최대 3차례. 스톱·마비는 최대 2차례. 독은 매 차례 최대 HP 6%.
  // 보스 사슬 수면(사용자 지적 2)을 막는 것은 상태 쪽 상한과 적 쪽 저항(아래 rates) 둘이다.
  const state = (id: string, patch: Partial<StateRecord>, runtime: Record<string, unknown> = {}): void => {
    const record = find<StateRecord>(db.states, id);
    Object.assign(record, patch);
    record.runtimeEffects = { ...(record.runtimeEffects ?? {}), ...runtime } as StateRecord["runtimeEffects"];
  };
  state("state_sleep", { recoverWhenHitChance: 100, recoverNaturallyFromTurn: 2, recoverNaturallyChance: 35 }, { maxTurns: 3 });
  state("state_stop", {}, { maxTurns: 2 });
  state("state_paralysis", { recoverNaturallyFromTurn: 1, recoverNaturallyChance: 40 }, { maxTurns: 2 });
  state("state_poison", {}, { hpDamagePercentPerTurn: 6 });

  // ── 카엘(검사): 무기 공명 · 다단 · 방어 무시 · 방어 하락 · 불 ──────────────────────
  // 시작 검(청동 검)에 검 계열을 단다 — 그래야 「검을 든 카엘의 검 기술」이 실제로 세진다(무기 공명).
  const bronze = find<EquipmentRecord>(db.equipment, "equip_sword");
  bronze.attackElementIds = ["sword"];
  const swordBond = { elementIds: ["sword"], bonusPercent: 40 } as const;
  const spearBond = { elementIds: ["spear"], bonusPercent: 40 } as const;
  tune("skill_sword_slash", {
    power: 60, elementId: "sword", weaponAffinity: swordBond, mpCost: { flat: 0, percentMax: 0 },
    description: "MP 0 검기. 검을 들고 쓰면 위력 +40%.",
  });
  tune("skill_hero_cross_slash", {
    power: 46, elementId: "sword", hitSequence: [1, 1], criticalRate: 30, weaponAffinity: swordBond,
    description: "두 번 벤다. 급소 확률 30% — 검을 들면 +40%.",
  });
  tune("skill_hero_rush_pierce", {
    power: 70, elementId: "spear", damageFormula: "power + a.atk * 1.1", weaponAffinity: spearBond, mpCost: { flat: 5, percentMax: 0 },
    description: "방어를 무시하고 꿰뚫는다. 딱정벌레·수호상용 — 창을 들면 +40%.",
  });
  tune("skill_hero_rising_blade", {
    power: 40, elementId: "sword", stateEffects: [{ stateId: "state_defense_down", chance: 100, operation: "add" }],
    description: "약하게 베고 방어를 반으로 깎는다(확정). 단단한 적에게 먼저.",
  });
  tune("skill_hero_flame_sword", {
    power: 78, elementId: "fire",
    description: "불 속성 베기.",
  });
  tune("skill_focus", {
    description: "자기 공격을 두 배로(공격 상승). 다음 큰 기술 전에.",
  });

  // ── 엘레나(마도학자): 광역 · 상태 · 치유/재생 · MP 회복 ───────────────────────
  tune("skill_arcane_bolt", {
    power: 58, mpCost: { flat: 2, percentMax: 0 },
    description: "MP 2. 가장 싼 공격 마법(무속성).",
  });
  tune("skill_mage_fireball", {
    power: 80, elementId: "fire", mpCost: { flat: 5, percentMax: 0 },
    description: "불 속성 한 대상 강타.",
  });
  tune("skill_mage_blizzard", {
    power: 54, elementId: "ice", mpCost: { flat: 10, percentMax: 0 },
    stateEffects: [{ stateId: "state_agility_down", chance: 40, operation: "add" }],
    description: "적 전체 얼음 + 40% 둔화. 도깨비불 떼를 한 번에.",
  });
  tune("skill_mage_chain_lightning", {
    power: 50, elementId: "thunder", mpCost: { flat: 12, percentMax: 0 },
    stateEffects: [{ stateId: "state_paralysis", chance: 25, operation: "add" }],
    description: "적 전체 번개 + 25% 마비.",
  });
  tune("skill_sleep_mist", {
    mpCost: { flat: 4, percentMax: 0 }, stateEffects: [{ stateId: "state_sleep", chance: 85, operation: "add" }],
    description: "한 대상 수면 85%. 맞으면 깨고 최대 3차례. 보스는 잘 안 듣는다.",
  });
  tune("skill_weaken", {
    mpCost: { flat: 3, percentMax: 0 }, stateEffects: [{ stateId: "state_defense_down", chance: 100, operation: "add" }],
    description: "한 대상 방어 반감(확정). 피해 없이 다음 공격을 키운다.",
  });
  tune("skill_heal", {
    power: 40, mpCost: { flat: 4, percentMax: 0 }, stateEffects: [{ stateId: "state_regen", chance: 100, operation: "add" }],
    description: "아군 하나 회복 + 재생(매 차례 최대 HP 8%).",
  });
  tune("skill_mage_magic_missile", {
    power: 30, hitSequence: [1, 1, 1], hitRate: 100, mpCost: { flat: 4, percentMax: 0 },
    description: "빗나가지 않는 세 발. 회피가 높거나 HP 가 적은 적 정리.",
  });
  // MP 회복(사용자 지적 11): 차례를 쓰는 대가로 자기 MP 를 채운다.
  make("skill_heal", FS_MEDITATE_SKILL, {
    name: "명상", scope: "self", power: 14, mpCost: { flat: 0, percentMax: 0 }, stateEffects: [],
    effect: { kind: "healing", statistic: "mind", affects: "mp" },
    description: "차례 하나를 써서 자기 MP 를 크게 채운다.",
  });
  const mageClass = db.classes.find((c) => c.id === "class_mage");
  if (mageClass && !mageClass.learnedSkills.some((row) => row.skillId === FS_MEDITATE_SKILL)) {
    mageClass.learnedSkills = [...mageClass.learnedSkills, { level: 1, skillId: FS_MEDITATE_SKILL }];
  }

  // ── 이리스(성광 사수): 별에서 온 기계 소녀가 「별빛 사출봉」으로 빛을 쏜다 ─────────────────────
  // 사용자 지적(「이리스 직업이 뭐냐 — 기술이 안 맞는다」): 직업은 「총사」, 손에는 정찰 단검(검 계열), 그림은 보랏빛 구슬 봉이었다.
  // 정체를 하나로 — 직업 「성광 사수」, 무기 「별빛 사출봉」(원거리 계열 = 활 bow), 역할은 「한 대상 정밀 사격 · 기절 · 모아 쏘는 관통 빛」.
  // 사격 기술은 사출봉(활 계열)을 들면 +40%(무기 공명). 모아 쏘는 빛은 빛(holy) 속성이라 유령에게 약점이다.
  const rodBond = { elementIds: ["bow"], bonusPercent: 40 } as const;
  const rod = normalizeEquipmentRecord({
    ...clone(find<EquipmentRecord>(db.equipment, "equip_scout_dagger")),
    id: FS_STAR_ROD, name: "별빛 사출봉", slot: "weapon", price: 0,
    description: "원거리(활 계열) 무기. 사격 기술 +40%.\n별에서 함께 떨어진 봉. 끝의 구슬이 빛을 모아 쏜다.",
    statBonuses: { attack: 16, defense: 0, mind: 4, agility: 4 },
    equippableActorIds: [IRIS], twoHanded: false, attackElementIds: ["bow"], criticalRate: 10, accuracy: 100,
    iconResourceId: undefined, imageResourceId: undefined,
  } as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">);
  upsert(db.equipment, rod);
  const gunner = db.classes.find((c) => c.id === "class_gunner");
  if (gunner) {
    gunner.name = "성광 사수";
    const owned = gunner.equipmentPermissions.equipmentIds.filter((id) => id !== "equip_scout_dagger");
    gunner.equipmentPermissions = { ...gunner.equipmentPermissions, equipmentIds: [FS_STAR_ROD, ...owned.filter((id) => id !== FS_STAR_ROD)] };
  }
  const iris = db.actors.find((a) => a.id === IRIS);
  if (iris) iris.initialEquipment = { ...(iris.initialEquipment ?? {}), weapon: FS_STAR_ROD } as typeof iris.initialEquipment;
  tune("skill_gunner_shot", {
    name: "광선 조준", power: 56, elementId: "bow", criticalRate: 50, criticalMultiplier: 2, weaponAffinity: rodBond,
    description: "급소 50%(두 배). 사출봉을 들면 +40%.",
  });
  tune("skill_gunner_rapid_fire", {
    name: "광자 연사", power: 26, elementId: "bow", hitSequence: [1, 1, 1, 1], mpCost: { flat: 4, percentMax: 0 }, weaponAffinity: rodBond,
    description: "약한 빛 네 발(사출봉 +40%). 잠든 적은 깬다.",
  });
  tune("skill_gunner_snipe", {
    name: "충전 광선포", power: 120, elementId: "holy", animationId: "anim_gen_holy_beam", chargeTurns: 1,
    damageFormula: "power + a.atk * 1.4", mpCost: { flat: 6, percentMax: 0 },
    description: "한 차례 빛을 모아 일직선을 꿰뚫는다(방어 무시·빛).",
  });
  tune("skill_gunner_butt_strike", {
    name: "봉 내려치기", power: 50, elementId: "hit", stateEffects: [{ stateId: "state_stop", chance: 60, operation: "add" }],
    description: "사출봉으로 내려쳐 60% 기절(최대 2차례). 보스·돌 몸은 버틴다.",
  });
  // Lv10 이후 기술도 「총·수류탄」이 아니라 사출봉의 빛으로 읽히게 이름과 한 줄 설명을 바꾼다(메커니즘은 그대로).
  tune("skill_gunner_grenade", { name: "성광탄", weaponAffinity: { elementIds: ["bow"], bonusPercent: 25 },
    description: "적 전체에 터지는 빛 구슬(사출봉 +25%)." });
  tune("skill_gunner_flare", { name: "섬광 신호", description: "아군 전체 민첩 상승. 먼저 움직여야 할 때." });
  tune("skill_gunner_spin_fire", { name: "회전 열선", description: "적 전체 불 속성 열선." });
  tune("skill_gunner_volley", { name: "유성 일제사격", weaponAffinity: { elementIds: ["bow"], bonusPercent: 25 },
    description: "필살기. 적 전체에 유성 같은 빛을 쏟는다(사출봉 +25%)." });
  // 카엘·엘레나도 직업 이름을 역할에 맞춘다 — 카엘은 검이 주 무기, 창으로 바꾸면 찌르기가 세진다. 엘레나는 지팡이로 마력을 올리고 마법은 무기 공명이 없다.
  const heroClass = db.classes.find((c) => c.id === "class_hero");
  if (heroClass) heroClass.name = "별지기 검사";
  if (mageClass) mageClass.name = "천문 마도사";

  // ── 적: 역할이 다른 다섯 + 보스 둘 ─────────────────────────────────────────
  const rates = (id: string, elements: Record<string, ActorRateGrade>, states: Record<string, ActorRateGrade> = {}): void => {
    const enemy = find<EnemyRecord>(db.enemies, id);
    enemy.elementRates = { ...enemy.elementRates, ...elements };
    enemy.stateRates = { ...enemy.stateRates, ...states };
  };
  const act = (skillId: string, priority: number, condition: EnemyRecord["actions"][number]["condition"] = { kind: "always" }) =>
    ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
  const enemyFrom = (templateMonster: string, id: string, name: string, stats: EnemyRecord["stats"], exp: number, gold: number): EnemyRecord => {
    const template = db.enemies.find((e) => e.monsterResourceId === `generated-enemy-${templateMonster}`) ?? find<EnemyRecord>(db.enemies, "enemy_fs_wolf");
    const enemy = { ...clone(template), id, name, monsterResourceId: `generated-enemy-${templateMonster}`, stats, level: 5 } as EnemyRecord;
    enemy.rewards = { ...enemy.rewards, exp, gold, drops: [], dropItemId: undefined, dropRatePercent: 0 } as EnemyRecord["rewards"];
    enemy.elementRates = {};
    enemy.stateRates = {};
    upsert(db.enemies, enemy);
    return enemy;
  };
  // 떼: 도깨비불은 무르고(HP 90) 날붙이에 강하다 — 광역 마법으로 한 번에.
  find<EnemyRecord>(db.enemies, "enemy_fs_wisp").stats.maxHp = 90;
  // 단단한 적: 뿔딱정벌레 — 방어 80. 통상 공격·검은 튕기고, 방어 무시(돌진 찌르기·저격)·방어 하락·번개가 답이다.
  const beetle = enemyFrom("beetle-horn", FS_BEETLE, "뿔딱정벌레", { maxHp: 200, maxMp: 0, attack: 62, defense: 80, mind: 20, agility: 18 }, 52, 18);
  beetle.actions = [act("skill_attack", 6), act("skill_fs_maul", 4, { kind: "turn", start: 2, interval: 3 })];
  rates(FS_BEETLE, { sword: "D", bow: "D", spear: "A", thunder: "A", fire: "C" }, { state_sleep: "B", state_stop: "C" });
  // 치유사: 이끼 슬라임 — 동료가 다치면 이슬로 고친다. 먼저 잡거나 재워야 싸움이 짧다. 불에 약하다.
  make("skill_heal", "skill_fs_moss_dew", {
    name: "이슬 치유", scope: "ally", power: 46, mpCost: { flat: 0, percentMax: 0 }, stateEffects: [],
    description: "동료 하나를 이슬로 고친다.",
  });
  const moss = enemyFrom("slime-green", FS_MOSS, "이끼 슬라임", { maxHp: 120, maxMp: 40, attack: 40, defense: 22, mind: 56, agility: 30 }, 40, 16);
  moss.actions = [act("skill_fs_moss_dew", 9), act("skill_attack", 3)];
  rates(FS_MOSS, { fire: "A", water: "D", earth: "D" });
  for (const id of ["enemy_fs_wolf", "enemy_fs_spider", "enemy_fs_wisp"]) rates(id, {}, { state_sleep: "A" });

  // ── 1막 숲 구역별 적(사용자 지적 7): 생김새도 행동도 다르게, 구역마다 따로 ────────────────────
  // 측면 도트 몬스터 그림(generated-enemy-*)을 그대로 쓴다. 적마다 한 가지 역할 — 떼·단단함·술사·치유·상태·돌격·유리 대포.
  const drops = (...rows: Array<[string, number]>): NonNullable<EnemyRecord["rewards"]["drops"]> =>
    rows.map(([itemId, ratePercent]) => ({ itemId, ratePercent, quantity: 1, condition: { kind: "always" } }));
  const foe = (look: string, id: string, name: string, stats: [number, number, number, number, number], exp: number, gold: number,
    actions: EnemyRecord["actions"], elements: Record<string, ActorRateGrade>, states: Record<string, ActorRateGrade>, loot: Array<[string, number]>): void => {
    const [maxHp, attack, defense, mind, agility] = stats;
    const enemy = enemyFrom(look, id, name, { maxHp, maxMp: 60, attack, defense, mind, agility }, exp, gold);
    enemy.actions = actions;
    enemy.skillIds = [...new Set(actions.map((row) => row.skillId))];
    enemy.rewards = { ...enemy.rewards, drops: drops(...loot) } as EnemyRecord["rewards"];
    rates(id, elements, states);
  };
  make("skill_mon_body_slam", "skill_fs_discharge", {
    name: "방전", elementId: "thunder", power: 44, stateEffects: [{ stateId: "state_paralysis", chance: 35, operation: "add" }],
    description: "몸에 모은 전기를 터뜨린다. 35% 마비.",
  });
  make("skill_heal", "skill_fs_leaf_hymn", {
    name: "잎새 노래", scope: "allAllies", power: 30, mpCost: { flat: 0, percentMax: 0 }, stateEffects: [],
    description: "동료 모두를 조금씩 고친다.",
  });
  // 어귀 — 돌격·떼
  foe("boar-tusk", "enemy_fs_boar", "엄니멧돼지", [240, 66, 30, 20, 22], 48, 18,
    [act("skill_mon_tusk_charge", 8, { kind: "turn", start: 1, interval: 2 }), act("skill_attack", 5)],
    { spear: "A", fire: "C" }, { state_sleep: "B", state_stop: "B" }, [["item_potion", 20], ["item_fs_wolf_hide", 30]]);
  foe("bee-giant", "enemy_fs_hornet", "숲말벌", [62, 50, 8, 20, 64], 18, 6,
    [act("skill_mon_poison_sting", 7), act("skill_attack", 4)],
    { fire: "A", wind: "A", bow: "A", ice: "B" }, { state_sleep: "A", state_stop: "A" }, [["item_antidote", 25]]);
  // 옛 수로 — 단단함·술사·상태
  foe("crab-rock", "enemy_fs_crab", "바위게", [190, 58, 92, 20, 16], 54, 20,
    [act("skill_mon_shell_guard", 9, { kind: "turn", start: 1, interval: 3 }), act("skill_mon_body_slam", 6), act("skill_attack", 4)],
    { thunder: "A", sword: "D", bow: "D", spear: "B", fire: "D" }, { state_sleep: "B", state_paralysis: "B" }, [["item_potion", 25]]);
  foe("spirit-water", "enemy_fs_undine", "물의 정령", [130, 36, 26, 72, 40], 50, 22,
    [act("skill_mon_tidal_wave", 8, { kind: "turn", start: 2, interval: 2 }), act("skill_mon_frost_orb", 6)],
    { thunder: "A", fire: "D", ice: "E", water: "E", sword: "C" }, { state_sleep: "B" }, [["item_ether", 30]]);
  foe("eel-electric", "enemy_fs_eel", "전기뱀장어", [150, 54, 24, 50, 50], 46, 16,
    [act("skill_fs_discharge", 8), act("skill_attack", 4)],
    { spear: "A", thunder: "E", water: "D", earth: "A" }, { state_paralysis: "E" }, [["item_potion", 20]]);
  // 가시덤불 샛길 — 상태·유리 대포·흡수 탱커
  foe("moth-dust", "enemy_fs_moth", "가루나방", [96, 40, 14, 56, 54], 36, 12,
    [act("skill_mon_spore_cloud", 9, { kind: "turn", start: 1, interval: 3 }), act("skill_attack", 4)],
    { fire: "A", wind: "A", bow: "B" }, { state_sleep: "A" }, [["item_wake_herb", 30]]);
  foe("mantis-blade", "enemy_fs_mantis", "칼날사마귀", [110, 84, 12, 20, 72], 44, 16,
    [act("skill_mon_cross_scythe", 7), act("skill_attack", 5)],
    { fire: "B", ice: "B" }, { state_sleep: "A", state_stop: "A" }, [["item_potion", 20]]);
  foe("plant-carnivore", "enemy_fs_flytrap", "가시식충초", [320, 58, 44, 50, 10], 70, 26,
    [act("skill_mon_blood_suck", 8, { kind: "hp", minPercent: 0, maxPercent: 70 }), act("skill_mon_acid_spit", 6), act("skill_attack", 4)],
    { fire: "A", ice: "B", water: "D", earth: "D" }, { state_poison: "E", state_sleep: "C" }, [["item_hi_potion", 15], ["item_antidote", 20]]);
  // 사냥꾼 쉼터 — 사람 적: 약화·기습
  foe("goblin-scout", "enemy_fs_goblin", "고블린 척후", [120, 52, 20, 30, 58], 38, 20,
    [act("skill_mon_smoke_bomb", 8, { kind: "turn", start: 1, interval: 3 }), act("skill_mon_backstab", 6), act("skill_attack", 4)],
    { sword: "B", fire: "B" }, { state_sleep: "A" }, [["item_potion", 25]]);
  foe("bandit-mask", "enemy_fs_bandit", "복면 밀렵꾼", [190, 66, 30, 30, 46], 56, 60,
    [act("skill_mon_venom_fang", 7, { kind: "turn", start: 2, interval: 2 }), act("skill_mon_backstab", 5), act("skill_attack", 4)],
    { holy: "B" }, { state_sleep: "B" }, [["item_hi_potion", 20], ["item_ether", 15]]);
  // 깊은 곳 — 마법이 아니면 안 되는 유령 · 무리를 고치는 잎새 정령
  foe("ghost-pale", "enemy_fs_ghost", "창백한 유령", [140, 40, 30, 70, 44], 58, 24,
    [act("skill_mon_banshee_wail", 8, { kind: "turn", start: 2, interval: 3 }), act("skill_mon_blood_suck", 6)],
    { sword: "D", spear: "D", bow: "D", hit: "D", holy: "A", fire: "B", dark: "E" }, { state_sleep: "E", state_poison: "E", state_stop: "C" }, [["item_ether", 25]]);
  foe("leafling-01", "enemy_fs_leafling", "잎새 정령", [110, 30, 20, 64, 36], 44, 18,
    [act("skill_fs_leaf_hymn", 9, { kind: "turn", start: 1, interval: 2 }), act("skill_attack", 3)],
    { fire: "A", ice: "B", earth: "D", water: "D" }, { state_sleep: "B" }, [["item_potion", 20], ["item_ether", 10]]);
  // 트룹 — 구역별 묶음. 조우 표는 applyFallenAreaEncounters 가 맵마다 단다.
  const troop = (id: string, name: string, enemyIds: readonly string[]): void => {
    const record = db.troops.find((t) => t.id === id) ?? normalizeTroopRecord({ id, name, enemyIds: [...enemyIds] });
    record.name = name;
    record.enemyIds = [...enemyIds];
    record.members = enemyIds.map((enemyId, i) => ({ enemyId, x: 80 + i * 56, y: 96, hidden: false })) as typeof record.members;
    record.autoAlign = true;
    upsert(db.troops, record);
  };
  for (const [id, name, members] of FS_AREA_TROOP_DEFS) troop(id, name, members);
  // ── 보스: 수호상 · 발렌 ──────────────────────────────────────────────────
  // 수호상: 돌 몸 — 수면·기절 무효, 마비 저항. 창·번개·방어 무시가 답.
  rates("enemy_fs_guardian", {}, { state_sleep: "E", state_stop: "E", state_paralysis: "D", state_poison: "E" });
  // 발렌: 1막 결전(사용자 지적 8). 체력을 올리고, 큰 기술은 한 차례 모은 뒤 쏜다(머리 위 예고 띠), 도깨비불을 두 번 부르고,
  // 체력 절반에서 장갑을 벗는다 — 빨라지고(민첩 상승) 두 번 베지만 방어가 반으로 준다. 수면 30%·기절 무효 — 상태 사슬로 묶어 두지 못한다(사용자 지적 2).
  const valen = find<EnemyRecord>(db.enemies, "enemy_fs_valen");
  valen.stats = { ...valen.stats, maxHp: 2100, attack: 112, defense: 70, mind: 92, agility: 46 };
  rates("enemy_fs_valen", {}, { state_sleep: "D", state_stop: "E", state_paralysis: "D", state_poison: "C", state_defense_down: "C" });
  tune("skill_fs_judgment", {
    elementId: "holy", power: 120, chargeTurns: 1,
    description: "한 차례 빛을 모은 뒤 파티 전체에 쏟는다. 모으는 동안 방어하라.",
  });
  make("skill_hero_cross_slash", "skill_fs_valen_combo", {
    name: "단죄의 연격", power: 52, hitSequence: [1, 1], weaponAffinity: undefined, criticalRate: 10, mpCost: { flat: 0, percentMax: 0 },
    description: "장갑을 벗은 발렌의 두 번 베기.",
  });
  valen.actions = [
    act("skill_fs_judgment", 10, { kind: "turn", start: 3, interval: 4 }),
    act("skill_fs_valen_combo", 8, { kind: "hp", minPercent: 0, maxPercent: 50 }),
    act("skill_sword_slash", 6),
    act("skill_weaken", 4, { kind: "turn", start: 2, interval: 3 }),
  ];
  // 소환: 숨은 도깨비불 둘을 발렌 둘째·다섯째 차례에 하나씩 드러낸다(최대 2). 체력 절반 페이즈는 공격 상승 + 대사.
  const finale = find(db.troops, "troop_fs_finale");
  const visible = (finale.members ?? []).filter((member) => member.enemyId !== "enemy_fs_wisp");
  finale.enemyIds = ["enemy_fs_valen", "enemy_fs_guardian", "enemy_fs_wisp", "enemy_fs_wisp"];
  finale.members = [
    ...visible,
    { enemyId: "enemy_fs_wisp", x: 110, y: 120, hidden: true },
    { enemyId: "enemy_fs_wisp", x: 150, y: 70, hidden: true },
  ] as typeof finale.members;
  const m2 = (commandId: string, fields: Record<string, string | number>): Command => ({ kind: "m2Command", commandId, fields } as Command);
  const text = (body: string): Command => ({ kind: "text", speaker: "심문관 발렌", body } as Command);
  finale.battleEventPages = [
    { id: "troop_fs_finale_summon1", name: "소환 1 — 발렌 둘째 차례", span: "battle", runOnce: true,
      conditions: [{ kind: "enemyTurn", enemyId: "enemy_fs_valen", turn: 2 }],
      commands: [text("길 잃은 불씨여, 내 등불로 오라."), m2("m2-101-enemy-encounter", { target: "enemy_fs_wisp" })] },
    { id: "troop_fs_finale_summon2", name: "소환 2 — 발렌 다섯째 차례", span: "battle", runOnce: true,
      conditions: [{ kind: "enemyTurn", enemyId: "enemy_fs_valen", turn: 5 }],
      commands: [text("하나 더."), m2("m2-101-enemy-encounter", { target: "enemy_fs_wisp" })] },
    { id: "troop_fs_finale_phase2", name: "2페이즈 — 체력 절반", span: "battle", runOnce: true,
      conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_fs_valen", percent: 50 }],
      commands: [
        text("…장갑을 벗을 때가 됐군."),
        // 장갑을 벗는다 = 빨라지고(연격) 물러진다. 공격 상승(×2)은 연격과 겹쳐 한 차례 300 가까이 들어가 너무 셌다(QA 영상 실측).
        m2("m2-100-change-enemy-state", { target: "enemy_fs_valen", operation: "add", value: "state_agility_up" }),
        m2("m2-100-change-enemy-state", { target: "enemy_fs_valen", operation: "add", value: "state_defense_down" }),
      ] },
  ] as typeof finale.battleEventPages;

  // ── 시그니처 무기: 발렌의 「심판의 장검」 ───────────────────────────────────
  // +공격만이 아니다(사용자 지적 1): 검·빛 두 계열(검 기술 공명 + 빛 속성 평타), 평타 25% 방어 하락, 전용 기술 「단죄의 일섬」.
  make("skill_hero_flame_sword", FS_VERDICT_SKILL, {
    name: "단죄의 일섬", elementId: "holy", power: 92, drainPercent: 30, weaponAffinity: { elementIds: ["sword"], bonusPercent: 25 },
    mpCost: { flat: 6, percentMax: 0 },
    description: "빛 속성 일섬. 준 피해의 30%만큼 HP 흡수(심판의 장검 전용).",
  });
  const blade = normalizeEquipmentRecord({
    ...clone(find<EquipmentRecord>(db.equipment, "equip_sword")),
    id: FS_JUDGMENT_BLADE, name: "심판의 장검", slot: "weapon", price: 0,
    description: "검·빛 두 계열. 평타 25% 방어 하락, 기술 「단죄의 일섬」(HP 흡수).\n심문관의 검. 손잡이의 이름은 깎여 있다.",
    statBonuses: { attack: 30, defense: 0, mind: 6, agility: 4 },
    equippableActorIds: [DEFAULT_ACTOR_ID], twoHanded: false,
    attackElementIds: ["sword", "holy"], stateInflictIds: ["state_defense_down"], stateInflictionChance: 25,
    grantsSkillIds: [FS_VERDICT_SKILL], criticalRate: 8, accuracy: 100,
  } as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">);
  upsert(db.equipment, blade);
  valen.rewards = {
    ...valen.rewards,
    drops: [...(valen.rewards.drops ?? []).filter((d) => d.itemId !== FS_JUDGMENT_BLADE),
      { itemId: FS_JUDGMENT_BLADE, ratePercent: 100, quantity: 1, condition: { kind: "always" } }],
  } as EnemyRecord["rewards"];

  // ── MP 회복(사용자 지적 11): 마력약을 쓸 만하게 + 상자·약방에서 ───────────────────
  const ether = find<ItemRecord>(db.items, "item_ether");
  ether.mpRecovery = { flat: 10, percentMax: 40 };
  ether.price = 90;
  ether.description = "아군 하나의 MP를 10 + 최대 MP의 40% 회복. 약재상 오든이 판다.";
}

/** 1막 숲 구역별 트룹(id, 이름, 적). 숲 맵이 여섯으로 나뉘면 FS_AREA_ENCOUNTERS 가 맵마다 단다. */
const FS_AREA_TROOP_DEFS: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  // 어귀
  ["troop_fs_wolves", "숲늑대와 이끼 슬라임", ["enemy_fs_wolf", "enemy_fs_wolf", "enemy_fs_moss"]],
  ["troop_fs_edge_boar", "엄니멧돼지와 숲늑대", ["enemy_fs_boar", "enemy_fs_wolf"]],
  ["troop_fs_edge_hornets", "숲말벌 떼", ["enemy_fs_hornet", "enemy_fs_hornet", "enemy_fs_hornet"]],
  // 옛 수로
  ["troop_fs_stream_crabs", "바위게와 물의 정령", ["enemy_fs_crab", "enemy_fs_undine", "enemy_fs_crab"]],
  ["troop_fs_stream_eels", "전기뱀장어 둘", ["enemy_fs_eel", "enemy_fs_eel"]],
  // 가시덤불 샛길
  ["troop_fs_spiders", "덤불거미와 뿔딱정벌레", ["enemy_fs_spider", "enemy_fs_beetle"]],
  ["troop_fs_thicket_moths", "가루나방과 칼날사마귀", ["enemy_fs_moth", "enemy_fs_mantis", "enemy_fs_moth"]],
  ["troop_fs_thicket_flytrap", "가시식충초와 덤불거미", ["enemy_fs_flytrap", "enemy_fs_spider"]],
  // 사냥꾼 쉼터
  ["troop_fs_glade_poachers", "밀렵꾼 일당", ["enemy_fs_goblin", "enemy_fs_bandit", "enemy_fs_goblin"]],
  // 깊은 곳
  ["troop_fs_wisps", "도깨비불 떼", ["enemy_fs_wisp", "enemy_fs_wisp", "enemy_fs_wisp", "enemy_fs_wisp"]],
  ["troop_fs_deep_ghosts", "창백한 유령과 잎새 정령", ["enemy_fs_ghost", "enemy_fs_wisp", "enemy_fs_leafling", "enemy_fs_wisp"]],
];

/** 구역(맵 id) → 조우 표. 숲이 나뉜 판(fs_forest_edge…)과 한 장짜리 숲(fs_forest) 둘 다 받는다. */
const FS_AREA_ENCOUNTERS: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {
  fs_forest_edge: [["troop_fs_wolves", 3], ["troop_fs_edge_boar", 2], ["troop_fs_edge_hornets", 2]],
  fs_forest_stream: [["troop_fs_stream_crabs", 3], ["troop_fs_stream_eels", 2], ["troop_fs_wolves", 1]],
  fs_forest_thicket: [["troop_fs_spiders", 3], ["troop_fs_thicket_moths", 2], ["troop_fs_thicket_flytrap", 2]],
  fs_forest_glade: [["troop_fs_glade_poachers", 3], ["troop_fs_edge_hornets", 1], ["troop_fs_edge_boar", 1]],
  fs_forest: [["troop_fs_wisps", 3], ["troop_fs_deep_ghosts", 2], ["troop_fs_spiders", 1]],
};

/**
 * 조우 표만 바꾼다(지형·이벤트는 건드리지 않는다). 모든 맵 구성이 끝난 뒤 부른다 — 숲 맵 작업이 표를 다시 써도 이 표가 이긴다.
 * 숲이 아직 한 장(fs_forest)이면 그 맵에 모든 구역의 트룹을 섞어 단다. 조우가 꺼진 맵(사당 터 등)은 그대로 둔다.
 */
export function applyFallenAreaEncounters(project: Project): void {
  const split = Boolean(project.maps.fs_forest_edge);
  const table = (rows: ReadonlyArray<readonly [string, number]>): Array<{ troopId: string; weight: number }> => {
    const weights = new Map<string, number>();
    for (const [troopId, weight] of rows) {
      if (project.database.troops.some((t) => t.id === troopId)) weights.set(troopId, (weights.get(troopId) ?? 0) + weight);
    }
    return [...weights].map(([troopId, weight]) => ({ troopId, weight }));
  };
  for (const [mapId, rows] of Object.entries(FS_AREA_ENCOUNTERS)) {
    const map = project.maps[mapId] as unknown as { encounterTable?: unknown[]; encounterRate?: number } | undefined;
    if (!map) continue;
    if (mapId === "fs_forest" && !split) {
      map.encounterTable = table(Object.values(FS_AREA_ENCOUNTERS).flat());
      continue;
    }
    if (!map.encounterTable?.length && !map.encounterRate) continue;
    map.encounterTable = table(rows);
  }
}
