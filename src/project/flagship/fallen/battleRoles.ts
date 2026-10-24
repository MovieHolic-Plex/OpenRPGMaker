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
    description: "불 속성 베기. 늑대(약점)·거미·이끼 슬라임에게. 도깨비불엔 무효.",
  });
  tune("skill_focus", {
    description: "자기 공격을 두 배로(공격 상승). 다음 큰 기술 전에.",
  });

  // ── 엘레나(마도학자): 광역 · 상태 · 치유/재생 · MP 회복 ───────────────────────
  tune("skill_arcane_bolt", {
    power: 58, mpCost: { flat: 2, percentMax: 0 },
    description: "MP 2. 가장 싼 공격 마법(무속성 — 저항도 약점도 없다).",
  });
  tune("skill_mage_fireball", {
    power: 80, elementId: "fire", mpCost: { flat: 5, percentMax: 0 },
    description: "불 속성 한 대상 강타. 늑대·이끼 슬라임 약점.",
  });
  tune("skill_mage_blizzard", {
    power: 54, elementId: "ice", mpCost: { flat: 10, percentMax: 0 },
    stateEffects: [{ stateId: "state_agility_down", chance: 40, operation: "add" }],
    description: "적 전체 얼음 + 40% 둔화. 도깨비불 떼를 한 번에.",
  });
  tune("skill_mage_chain_lightning", {
    power: 50, elementId: "thunder", mpCost: { flat: 12, percentMax: 0 },
    stateEffects: [{ stateId: "state_paralysis", chance: 25, operation: "add" }],
    description: "적 전체 번개 + 25% 마비. 딱정벌레·수호상 약점.",
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

  // ── 이리스(기계 소녀·총): 급소 · 연사 · 모아 쏘기 · 기절 ────────────────────────
  tune("skill_gunner_shot", {
    power: 56, criticalRate: 50, criticalMultiplier: 2,
    description: "급소 확률 50%. 운이 좋으면 두 배.",
  });
  tune("skill_gunner_rapid_fire", {
    power: 26, hitSequence: [1, 1, 1, 1], mpCost: { flat: 4, percentMax: 0 },
    description: "약한 네 발. 거미 같은 무른 적·수면 깨우기 주의.",
  });
  tune("skill_gunner_snipe", {
    power: 120, elementId: "spear", chargeTurns: 1, damageFormula: "power + a.atk * 1.4", mpCost: { flat: 6, percentMax: 0 },
    description: "한 차례 조준한 뒤 방어 무시 한 발. 느리지만 가장 세다.",
  });
  tune("skill_gunner_butt_strike", {
    power: 50, stateEffects: [{ stateId: "state_stop", chance: 60, operation: "add" }],
    description: "60% 기절(최대 2차례). 보스·돌 거인은 버틴다.",
  });

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
  // 트룹 구성 — 맵의 조우 표(늑대·거미·도깨비불)는 그대로 두고 구성만 바꾼다(숲 맵은 다른 작업 영역).
  const troop = (id: string, name: string, enemyIds: readonly string[]): void => {
    const record = find(db.troops, id);
    record.name = name;
    record.enemyIds = [...enemyIds];
    record.members = enemyIds.map((enemyId, i) => ({ enemyId, x: 80 + i * 56, y: 96, hidden: false })) as typeof record.members;
    record.autoAlign = true;
  };
  troop("troop_fs_wolves", "숲늑대와 이끼 슬라임", ["enemy_fs_wolf", "enemy_fs_wolf", FS_MOSS]);
  troop("troop_fs_spiders", "덤불거미와 뿔딱정벌레", ["enemy_fs_spider", FS_BEETLE]);
  troop("troop_fs_wisps", "도깨비불 떼", ["enemy_fs_wisp", "enemy_fs_wisp", "enemy_fs_wisp", "enemy_fs_wisp"]);
  for (const id of ["enemy_fs_wolf", "enemy_fs_spider", "enemy_fs_wisp"]) rates(id, {}, { state_sleep: "A" });

  // ── 보스: 수호상 · 발렌 ──────────────────────────────────────────────────
  // 수호상: 돌 몸 — 수면·기절 무효, 마비 저항. 창·번개·방어 무시가 답.
  rates("enemy_fs_guardian", {}, { state_sleep: "E", state_stop: "E", state_paralysis: "D", state_poison: "E" });
  // 발렌: 1막 결전(사용자 지적 8). 체력을 올리고, 큰 기술은 한 차례 모은 뒤 쏜다(머리 위 예고 띠), 도깨비불을 두 번 부르고,
  // 체력 절반에서 장갑을 벗고 공격이 오른다. 수면 30%·기절 무효 — 상태 사슬로 묶어 두지 못한다(사용자 지적 2).
  const valen = find<EnemyRecord>(db.enemies, "enemy_fs_valen");
  valen.stats = { ...valen.stats, maxHp: 1600, attack: 108, defense: 70, mind: 92, agility: 46 };
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
        m2("m2-100-change-enemy-state", { target: "enemy_fs_valen", operation: "add", value: "state_attack_up" }),
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
