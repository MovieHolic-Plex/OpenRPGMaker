/**
 * 『폴른 스타』 1막 지하 미궁 전투 다시 짜기(2026-10-31).
 *
 * 사용자: 「달빛의 용 난이도를 좀 올리고, 아래 미궁의 심문회 적들이 좀 다양하게 등장하고,
 * 갑작스럽게 전투를 걸어오는 씬들도 좀 필요할 듯. 지금 좀 별로임」.
 *
 * 1. 심문회 지하반 — 광신도·설교자 둘뿐이던 적에 역할이 다른 일곱을 더한다. 무리마다 묻는 것이 다르다.
 *      방패병  : 「방패 벽」으로 무리 전체의 물리 피해를 줄이고, 치면 되받아친다 → 마법으로 뚫는다.
 *      채찍 고행자: 제 몸을 채찍질해 「광신」(공격 1.5배)에 든다, 대신 약하다 → 먼저 쓰러뜨리거나 기세 꺾기.
 *      심문 사제 : 한 차례 기도를 모아 무리를 고치고, 「침묵의 낙인」을 찍는다 → 기도 중에 때려 끊고, 정화.
 *      석궁수   : 한 차례 조준한 뒤 크게 쏜다. 조준 중에 한 대라도 맞으면 흐트러진다 → 조준을 끊는다.
 *      사냥개지기 : 둘째 차례에 휘파람으로 사냥개를 더 부르고 「물어라!」로 몰아붙인다 → 개보다 주인 먼저.
 *      사슬 참회자: 체력이 많고, 「참회의 일격」을 모은다. 기절·마비·잠이면 사슬이 엉킨다 → 봉 내려치기.
 *      변장한 첩자: 포로인 척하다 독침을 놓는다(가짜 포로 매복 전용).
 * 2. 달빛의 용 — 「관통상」 기믹(마법 무효 → 카엘 돌진 찌르기·이리스 충전 광선포가 비늘을 가르면 마법 3배)은 그대로.
 *      · 「달빛 숨결」·「만월의 포효」는 모으는 큰 기술이다. 모으는 동안 비늘을 가르면 끊긴다(chargeBreak) — 가르지 않으면 맞는다.
 *      · 체력 60% 아래(2막): 닫힌 비늘이 거울이 되어 단일 마법을 되비춘다. 가르면 거울도 깨진다.
 *      · 체력 25% 아래(3막): 빨라지고 숨결이 잦아진다. 오래 끌면(14차례 뒤) 숨결이 두 차례마다 — 평타로는 못 버틴다.
 *    힌트는 늘리지 않는다(VQA 2026-10-31: 약점 설명이 다섯 번 나왔다) — 전투 중 줄은 일어난 일만 말한다.
 *
 * 데이터베이스만 만진다(맵 이벤트·매복 장면은 act1Finale.ts). act1Finale 의 database() 끝에서 부른다.
 * 헤드리스 시험: scripts/qa/fallen-vault-sim.mts --apply (구운 파일 위에 이 함수를 덮어 세 손버릇의 승률을 잰다).
 */
import type { Command, Condition, EnemyRecord, Project, SkillRecord, StateRecord, TroopRecord } from "@/project/types";

type Rec = Record<string, unknown>;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function upsert<T extends { id: string }>(list: T[], record: T): void {
  const at = list.findIndex((r) => r.id === record.id);
  if (at >= 0) list[at] = record; else list.push(record);
}
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as unknown as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as unknown as Command);
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const enemyState = (target: string, operation: "add" | "remove", value: string): Command => m2("m2-100-change-enemy-state", { target, operation, value });
const appear = (target: string): Command => m2("m2-101-enemy-encounter", { target });
const anim = (target: string, animationId: string): Command => m2("m2-103-show-animation", { target, animationId });

// ── id ────────────────────────────────────────────────────────────────
export const FS_ZEAL_STATE = "fs_state_zeal";
export const FS_MIRROR_STATE = "fs_state_moon_mirror";
const PIERCED = "state_fs_pierced";
const DRAGON = "enemy_fs_moon_dragon";
const DRAGON_TROOP = "troop_fs_dragon";
const PIERCE_SKILLS = ["skill_hero_rush_pierce", "skill_gunner_snipe"];

export const FS_INQ = {
  shield: "enemy_fs_inq_shield",
  flagellant: "enemy_fs_inq_flagellant",
  priest: "enemy_fs_inq_priest",
  crossbow: "enemy_fs_inq_crossbow",
  handler: "enemy_fs_inq_handler",
  hound: "enemy_fs_inq_hound",
  penitent: "enemy_fs_inq_penitent",
  spy: "enemy_fs_inq_spy",
} as const;
const FANATIC = "enemy_fs_fanatic";
const PREACHER = "enemy_fs_fanatic_preacher";

/** 필드 걷기 칩(전투 그림과 같은 사람) — act1Finale 이 필드 적·매복 인물에 쓴다. */
export const FS_INQ_CHIPS: Record<string, [string, number]> = {
  [FS_INQ.shield]: ["tex_easyrpg_charset_people3", 5],
  [FS_INQ.flagellant]: ["tex_easyrpg_charset_people1", 4],
  [FS_INQ.priest]: ["tex_easyrpg_charset_people4", 7],
  [FS_INQ.crossbow]: ["tex_easyrpg_charset_actor2", 2],
  [FS_INQ.handler]: ["tex_easyrpg_charset_people4", 3],
  [FS_INQ.penitent]: ["tex_easyrpg_charset_people4", 0],
  [FS_INQ.spy]: ["tex_easyrpg_charset_people2", 1],
  [FANATIC]: ["tex_easyrpg_charset_actor3", 2],
  [PREACHER]: ["tex_easyrpg_charset_people2", 2],
};

/**
 * 심문회 화자 → 흉상. 칩의 짝 얼굴로 자동으로 고르면 방패병이 리본 소녀, 참회자가 소년, 사제가 할머니로 나온다
 * (people4 칩은 people1 얼굴로 이어진다). 이 게임에서 아무도 쓰지 않는 흉상만 골랐다 — 다른 사람과 얼굴이 겹치지 않는다.
 */
export const FS_INQ_BUSTS: Readonly<Record<string, string>> = {
  "심문회 방패병": "shared-actor2-red-helmet-expressions-bust-base",
  "채찍 고행자": "shared-actor2-mustache-expressions-bust-base",
  "심문 사제": "shared-black-headband-expressions-bust-base",
  "심문회 석궁수": "shared-people1-black-man-expressions-bust-base",
  "사냥개지기": "shared-green-goggles-expressions-bust-base",
  "사슬 참회자": "shared-monster-red-helm-expressions-bust-base",
  "포로": "shared-black-martial-expressions-bust-base",
};

/** 층마다 무리 — 같은 싸움이 두 번 나오지 않는다. 키는 act1Finale 의 필드 적·매복 자리. */
export const FS_VAULT_TROOPS = {
  // 지하 2층 · 옛 별지기의 방
  b2Kitchen: "troop_fs_inq_zeal",        // 광신도 + 채찍 고행자
  b2Crypt: "troop_fs_inq_shieldwall",    // 방패병 + 설교자
  b2Library: "troop_fs_inq_bolts",       // 석궁수 + 광신도
  b2Prisoner: "troop_fs_inq_false_prisoner", // 매복 — 변장한 첩자 + 채찍 고행자 + 광신도
  // 지하 3층 · 가라앉은 회랑
  b3Gallery: "troop_fs_inq_phalanx",     // 방패병 둘 + 석궁수
  b3West: "troop_fs_inq_vigil",          // 심문 사제 + 고행자 + 광신도
  b3East: "troop_fs_inq_kennel",         // 사냥개지기 + 사냥개 둘(+휘파람 하나)
  b3Levers: "troop_fs_inq_penance",      // 사슬 참회자 + 설교자
  b3Patrol: "troop_fs_inq_patrol",       // 매복 — 방패병 + 석궁수 + 고행자
  b3Ledge: "troop_fs_inq_ledge",         // 매복 — 고행자 둘 + 심문 사제
  b3Alarm: "troop_fs_inq_alarm",         // 경종 증원 — 사슬 참회자 + 사냥개지기 + 사냥개
} as const;

const SW_HOUND_CALL = "sw_fs_inq_hound_call";
const SW_DRAGON_CRACK = "sw_fs_dragon_crack";
const SW_DRAGON_P2 = "sw_fs_dragon_p2";
const SW_DRAGON_P3 = "sw_fs_dragon_p3";
const SW_DRAGON_ROAR = "sw_fs_dragon_roar";
const SW_DRAGON_MIRROR = "sw_fs_dragon_mirror";

const act = (skillId: string, priority: number, condition: Rec = { kind: "always" }, switchOn?: string, switchOff?: string): EnemyRecord["actions"][number] =>
  ({ skillId, priority, condition, switchOnAfterAction: switchOn ? { enabled: true, switchId: switchOn } : { enabled: false },
    switchOffAfterAction: switchOff ? { enabled: true, switchId: switchOff } : { enabled: false } }) as EnemyRecord["actions"][number];

export function applyFallenVaultCombat(project: Project): void {
  const db = project.database;
  for (const [id, name] of [
    [SW_HOUND_CALL, "전투: 사냥개지기의 휘파람"], [SW_DRAGON_P2, "전투: 용 2막(거울 비늘)"], [SW_DRAGON_P3, "전투: 용 3막(달이 기운다)"],
    [SW_DRAGON_ROAR, "전투: 용 포효 준비"], [SW_DRAGON_MIRROR, "전투: 용 비늘 거울"],
  ] as const) if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });

  // ── 상태 ──
  upsert(db.states as StateRecord[], {
    id: FS_ZEAL_STATE, name: "광신", restriction: "없음", removalCondition: "전투 종료", battleAura: "berserk-pulse",
    recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
    runtimeEffects: { attackMultiplier: 1.5, removeOnBattleEnd: true },
  } as unknown as StateRecord);
  upsert(db.states as StateRecord[], {
    id: FS_MIRROR_STATE, name: "거울 비늘", restriction: "없음", removalCondition: "전투 종료", battleAura: "shield-shimmer",
    recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
    runtimeEffects: { reflect: true, removeOnBattleEnd: true },
  } as unknown as StateRecord);
  // 비늘을 가르는 두 기술은 거울도 깬다.
  for (const id of PIERCE_SKILLS) {
    const s = db.skills.find((x) => x.id === id);
    if (s) s.stateEffects = [...(s.stateEffects ?? []).filter((e) => e.stateId !== FS_MIRROR_STATE), { stateId: FS_MIRROR_STATE, chance: 100, operation: "remove" }];
  }

  // ── 적 기술 ──
  const base = db.skills.find((s) => s.id === "skill_fs_judgment") as SkillRecord | undefined;
  if (!base) throw new Error("[fallen-star vault] 기술 견본 skill_fs_judgment 가 없다");
  const skill = (id: string, fields: Partial<SkillRecord>): void => upsert(db.skills, {
    ...clone(base), id, stateEffects: [], chargeTurns: undefined, chargeBreak: undefined, elementId: undefined, hitRate: 100, variance: 12,
    mpCost: { flat: 0, percentMax: 0 }, ...fields,
  } as SkillRecord);
  const dmg = (statistic: "attack" | "mind"): SkillRecord["effect"] => ({ kind: "damage", statistic, affects: "hp" });
  skill("skill_fs_inq_shield_wall", { name: "방패 벽", scope: "allAllies", power: 0, effect: { kind: "support" }, animationId: "anim_gen_guard_barrier",
    description: "방패를 겹쳐 세워 무리 전체가 칼날을 덜 받는다.", stateEffects: [{ stateId: "state_protect", chance: 100, operation: "add" }] });
  skill("skill_fs_inq_shield_bash", { name: "방패 밀치기", scope: "enemy", power: 62, effect: dmg("attack"), animationId: "anim_gen_tackle_impact",
    description: "방패로 들이받아 자세를 무너뜨린다.", gaugeShift: -35 });
  skill("skill_fs_inq_shield_counter", { name: "방패 되받기", scope: "enemy", power: 30, effect: dmg("attack"), animationId: "anim_gen_tackle_impact",
    description: "막아 낸 방패를 그대로 밀어 붙인다." });
  skill("skill_fs_inq_scourge", { name: "자기 채찍질", scope: "self", power: 0, effect: { kind: "support" }, animationId: "anim_gen_power_aura",
    description: "제 등을 채찍으로 갈긴다. 피를 흘릴수록 낫이 무거워진다.", hpCostPercent: 12, stateEffects: [{ stateId: FS_ZEAL_STATE, chance: 100, operation: "add" }] });
  skill("skill_fs_inq_scythe", { name: "광신의 낫", scope: "enemy", power: 42, effect: dmg("attack"), animationId: "anim_gen_claw_rake",
    description: "낫을 두 번 휘두른다.", hitSequence: [1, 1] });
  skill("skill_fs_inq_bless", { name: "성수 축복", scope: "allAllies", power: 46, effect: { kind: "healing", statistic: "mind", affects: "hp" }, animationId: "anim_gen_cleanse_sparkle",
    description: "한 차례 기도를 모아 무리의 상처를 씻는다.\n기도 중에 크게 맞으면 끊긴다.", chargeTurns: 1,
    chargeBreak: { damage: 60, stateIds: ["state_stop", "state_paralysis", "state_sleep", "state_silence"], message: "기도가… 끊겼다!" } });
  skill("skill_fs_inq_brand", { name: "침묵의 낙인", scope: "enemy", power: 0, effect: { kind: "support" }, animationId: "anim_gen_silence_lock",
    description: "이마에 낙인을 찍어 주문을 막는다.", stateEffects: [{ stateId: "state_silence", chance: 80, operation: "add" }] });
  skill("skill_fs_inq_aim", { name: "조준 사격", scope: "enemy", power: 128, effect: dmg("attack"), animationId: "anim_gen_projectile_shot",
    description: "한 차례 숨을 멈추고 겨눈 뒤 쏜다.\n겨누는 동안 맞으면 흐트러진다.", chargeTurns: 1, criticalRate: 15,
    chargeBreak: { damage: 1, message: "조준이 흐트러졌다!" } });
  skill("skill_fs_inq_bolt", { name: "석궁 사격", scope: "enemy", power: 58, effect: dmg("attack"), animationId: "anim_gen_projectile_shot",
    description: "짧은 화살을 쏜다." });
  skill("skill_fs_inq_whistle", { name: "휘파람", scope: "self", power: 0, effect: { kind: "switch", switchId: SW_HOUND_CALL }, animationId: "anim_gen_sonic_wave",
    description: "날카롭게 휘파람을 분다. 어둠 속에서 개가 짖는다." });
  skill("skill_fs_inq_sic", { name: "물어라!", scope: "allAllies", power: 0, effect: { kind: "support" }, animationId: "anim_gen_power_aura",
    description: "사냥개를 몰아붙인다.", stateEffects: [{ stateId: FS_ZEAL_STATE, chance: 100, operation: "add" }] });
  skill("skill_fs_inq_whip", { name: "가죽 채찍", scope: "enemy", power: 56, effect: dmg("attack"), animationId: "anim_gen_wind_slice",
    description: "긴 채찍으로 후려친다." });
  skill("skill_fs_hound_bite", { name: "목덜미 물기", scope: "enemy", power: 50, effect: dmg("attack"), animationId: "anim_gen_bite_crunch",
    description: "목덜미를 물고 늘어진다.", stateEffects: [{ stateId: "state_poison", chance: 25, operation: "add" }] });
  skill("skill_fs_inq_chain", { name: "쇠사슬 휘두르기", scope: "allEnemies", power: 46, effect: dmg("attack"), animationId: "anim_gen_wind_slice",
    description: "몸에 감긴 쇠사슬을 크게 휘두른다." });
  skill("skill_fs_inq_penance", { name: "참회의 일격", scope: "enemy", power: 165, effect: dmg("attack"), animationId: "anim_gen_earth_spike",
    description: "사슬 끝 쇳덩이를 머리 위로 돌리다 내려친다.\n돌리는 동안 몸이 굳으면 사슬이 엉킨다.", chargeTurns: 1,
    chargeBreak: { damage: 160, stateIds: ["state_stop", "state_paralysis", "state_sleep"], message: "사슬이 엉켰다!" } });
  skill("skill_fs_inq_rapture", { name: "고통의 환희", scope: "self", power: 0, effect: { kind: "support" }, animationId: "anim_gen_power_aura",
    description: "아플수록 웃는다. 앞뒤 가리지 않고 휘두른다.", stateEffects: [{ stateId: "state_berserk", chance: 100, operation: "add" }] });
  skill("skill_fs_inq_needle", { name: "독침", scope: "enemy", power: 40, effect: dmg("attack"), animationId: "anim_gen_projectile_shot",
    description: "소매 속 침을 날린다.", stateEffects: [{ stateId: "state_poison", chance: 80, operation: "add" }] });
  skill("skill_fs_inq_smoke", { name: "연막", scope: "self", power: 0, effect: { kind: "support" }, animationId: "anim_gen_smoke_vanish",
    description: "연기 속으로 몸을 숨긴다.", stateEffects: [{ stateId: "state_evade", chance: 100, operation: "add" }] });

  // ── 적 ──
  const fanatic = db.enemies.find((e) => e.id === FANATIC);
  const wolf = db.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!fanatic || !wolf) throw new Error("[fallen-star vault] 적 견본(광신도·숲늑대)이 없다");
  const make = (from: EnemyRecord, id: string, name: string, battler: string, level: number, stats: EnemyRecord["stats"],
    actions: EnemyRecord["actions"], exp: number, gold: number, extra: Partial<EnemyRecord> = {}): void => {
    const e = clone(from) as EnemyRecord & Rec;
    delete e.battleScalePercent;
    upsert(db.enemies, {
      ...e, id, name, level, monsterResourceId: battler, stats, actions, collapseEffect: "pixelBreak",
      skillIds: [...new Set(actions.map((a) => a.skillId).filter(Boolean))],
      stateRates: { ...(e.stateRates ?? {}), [PIERCED]: "E" },
      rewards: { exp, gold, dropRatePercent: 0, drops: [{ itemId: "item_potion", ratePercent: 18, quantity: 1, condition: { kind: "always" } }] },
      ...extra,
    } as unknown as EnemyRecord);
  };
  const st = (stateId: string, present: boolean) => ({ kind: "status", stateId, present });
  make(fanatic, FS_INQ.shield, "심문회 방패병", "charset-battler-people3-5", 8,
    { maxHp: 470, maxMp: 0, attack: 68, defense: 72, mind: 14, agility: 30 },
    [act("skill_fs_inq_shield_wall", 9, { kind: "turn", start: 1, interval: 3 }), act("skill_fs_inq_shield_bash", 6), act("skill_attack", 4)], 58, 20,
    { reactions: [{ trigger: "physical", skillId: "skill_fs_inq_shield_counter", chance: 30 }] } as Partial<EnemyRecord>);
  make(fanatic, FS_INQ.flagellant, "채찍 고행자", "charset-battler-people1-4", 8,
    { maxHp: 260, maxMp: 0, attack: 74, defense: 12, mind: 10, agility: 56 },
    [act("skill_fs_inq_scourge", 30, st(FS_ZEAL_STATE, false)), act("skill_fs_inq_scythe", 7), act("skill_attack", 4)], 50, 14);
  make(fanatic, FS_INQ.priest, "심문 사제", "charset-battler-people4-7", 9,
    { maxHp: 300, maxMp: 90, attack: 34, defense: 22, mind: 88, agility: 36 },
    [act("skill_fs_inq_bless", 9, { kind: "hp", minPercent: 0, maxPercent: 100 }), act("skill_fs_inq_brand", 12, { kind: "turn", start: 2, interval: 4 }),
      act("skill_holy", 5)], 64, 26, { stateRates: { [PIERCED]: "E", state_silence: "C" } } as Partial<EnemyRecord>);
  make(fanatic, FS_INQ.crossbow, "심문회 석궁수", "charset-battler-actor2-2", 8,
    { maxHp: 230, maxMp: 0, attack: 82, defense: 20, mind: 12, agility: 46 },
    [act("skill_fs_inq_aim", 14, { kind: "turn", start: 2, interval: 3 }), act("skill_fs_inq_bolt", 6), act("skill_attack", 3)], 52, 18);
  make(fanatic, FS_INQ.handler, "사냥개지기", "charset-battler-people4-3", 8,
    { maxHp: 340, maxMp: 0, attack: 70, defense: 26, mind: 14, agility: 42 },
    [act("skill_fs_inq_whistle", 40, { kind: "switch", switchId: SW_HOUND_CALL, value: false }, SW_HOUND_CALL),
      act("skill_fs_inq_sic", 11, { kind: "turn", start: 3, interval: 3 }), act("skill_fs_inq_whip", 6)], 60, 24);
  make(wolf, FS_INQ.hound, "심문회 사냥개", "generated-enemy-wolf-dire", 7,
    { maxHp: 190, maxMp: 0, attack: 72, defense: 18, mind: 10, agility: 64 },
    [act("skill_fs_hound_bite", 6), act("skill_attack", 4)], 34, 0, { elementRates: { ...(clone(wolf.elementRates ?? {})), fire: "B" } } as Partial<EnemyRecord>);
  make(fanatic, FS_INQ.penitent, "사슬 참회자", "charset-battler-people4-0", 9,
    { maxHp: 700, maxMp: 0, attack: 88, defense: 34, mind: 10, agility: 20 },
    [act("skill_fs_inq_rapture", 40, { kind: "hp", minPercent: 0, maxPercent: 35 }), act("skill_fs_inq_penance", 14, { kind: "turn", start: 2, interval: 3 }),
      act("skill_fs_inq_chain", 6), act("skill_attack", 4)], 84, 30,
    { stateRates: { [PIERCED]: "E", state_stop: "B", state_paralysis: "B", state_sleep: "C" } } as Partial<EnemyRecord>);
  make(fanatic, FS_INQ.spy, "변장한 첩자", "charset-battler-people2-1", 8,
    { maxHp: 260, maxMp: 0, attack: 74, defense: 20, mind: 30, agility: 60 },
    [act("skill_fs_inq_smoke", 9, { kind: "turn", start: 1, interval: 4 }), act("skill_fs_inq_needle", 7), act("skill_attack", 4)], 56, 40,
    { rewards: { exp: 56, gold: 40, dropRatePercent: 0, drops: [{ itemId: "item_antidote", ratePercent: 60, quantity: 1, condition: { kind: "always" } }] } } as Partial<EnemyRecord>);
  // 옛 둘(광신도·설교자)도 새 무리와 같은 무게로 — 지하 2·3층에서만 나온다.
  const f = db.enemies.find((x) => x.id === FANATIC); if (f) { f.stats = { ...f.stats, maxHp: 290, attack: 76 }; f.level = 8; }
  const pr = db.enemies.find((x) => x.id === PREACHER); if (pr) { pr.stats = { ...pr.stats, maxHp: 260, mind: 82 }; pr.level = 8; }
  // 광신도·설교자도 사람 크기로(무리 안에서 혼자 커 보이지 않게).
  for (const id of [FANATIC, PREACHER]) { const e = db.enemies.find((x) => x.id === id) as (EnemyRecord & Rec) | undefined; if (e) delete e.battleScalePercent; }

  // ── 무리 ──
  const troop = (id: string, name: string, members: Array<[string, boolean?]>, pages: TroopRecord["battleEventPages"] = []): void => {
    upsert(db.troops, {
      id, name, enemyIds: members.map(([e]) => e),
      members: members.map(([enemyId, hidden], i) => ({ enemyId, x: 80 + i * 60, y: 96, hidden: hidden === true })),
      autoAlign: true, uncapturable: true,
      backdropLayers: [{ preset: "fog", opacity: 40 }, { preset: "embers", opacity: 25 }],
      battleEventPages: pages,
    } as unknown as TroopRecord);
  };
  const T = FS_VAULT_TROOPS;
  troop(T.b2Kitchen, "광신도와 채찍 고행자", [[FANATIC], [FS_INQ.flagellant]]);
  troop(T.b2Crypt, "방패병과 설교자", [[FS_INQ.shield], [PREACHER]]);
  troop(T.b2Library, "석궁수와 광신도", [[FANATIC], [FS_INQ.crossbow]]);
  troop(T.b2Prisoner, "포로였던 자", [[FS_INQ.spy], [FS_INQ.flagellant], [FANATIC]]);
  troop(T.b3Gallery, "방패 줄", [[FS_INQ.shield], [FS_INQ.crossbow], [FS_INQ.shield]]);
  troop(T.b3West, "달의 방 기도회", [[FS_INQ.flagellant], [FS_INQ.priest], [FANATIC]]);
  const kennel = (id: string, name: string, lead: Array<[string, boolean?]>): void => troop(id, name, [...lead, [FS_INQ.handler], [FS_INQ.hound], [FS_INQ.hound, true]], [
    { id: `${id}_whistle`, name: "휘파람 — 사냥개 하나 더", span: "battle", runOnce: true,
      conditions: [sw(SW_HOUND_CALL), { kind: "enemyHp", enemyId: FS_INQ.handler, minPercent: 1, maxPercent: 100 }],
      commands: [narrate("어둠 속에서 개 한 마리가 더 뛰어든다."), appear(FS_INQ.hound)] },
    { id: `${id}_master_down`, name: "주인을 잃은 개", span: "battle", runOnce: true,
      conditions: [{ kind: "enemiesAlive", enemyId: FS_INQ.handler, atMost: 0 }, { kind: "enemiesAlive", enemyId: FS_INQ.hound, atMost: 3 }],
      commands: [narrate("주인이 쓰러지자 사냥개들이 꼬리를 만다."), enemyState(FS_INQ.hound, "remove", FS_ZEAL_STATE), enemyState(FS_INQ.hound, "add", "state_attack_down")] },
  ]);
  kennel(T.b3East, "사냥개지기", []);
  troop(T.b3Levers, "사슬 참회자와 설교자", [[FS_INQ.penitent], [PREACHER]]);
  troop(T.b3Patrol, "지하반 순찰대", [[FS_INQ.flagellant], [FS_INQ.shield], [FS_INQ.crossbow]]);
  troop(T.b3Ledge, "난간 위의 고행자들", [[FS_INQ.flagellant], [FS_INQ.priest], [FS_INQ.flagellant]]);
  kennel(T.b3Alarm, "경종 증원", [[FS_INQ.penitent]]);
  // 옛 세 무리는 남긴다(다른 곳에서 부를 수 있다) — 지하 이벤트는 위 무리로 바꾼다.

  dragon(project);
}

// ════════════════════════════════════════════════════════════════════
// 달빛의 용
// ════════════════════════════════════════════════════════════════════

function dragon(project: Project): void {
  const db = project.database;
  const enemy = db.enemies.find((e) => e.id === DRAGON);
  const troopRec = db.troops.find((t) => t.id === DRAGON_TROOP) as (TroopRecord & Rec) | undefined;
  if (!enemy || !troopRec) throw new Error("[fallen-star vault] 달빛의 용·트룹이 없다(act1Finale database 다음에 부른다)");
  const base = db.skills.find((s) => s.id === "skill_fs_dragon_breath") as SkillRecord;
  const breath = base as SkillRecord & Rec;
  breath.power = 140;
  breath.chargeBreak = { stateIds: [PIERCED], message: "갈라진 비늘 틈으로 숨이 새어 나간다!" };
  breath.description = "한 차례 숨을 모았다가 서리를 내뿜는다.";
  upsert(db.skills, {
    ...clone(base), id: "skill_fs_dragon_roar", name: "만월의 포효", power: 185, chargeTurns: 2, elementId: undefined, animationId: "anim_gen_sonic_wave",
    description: "머리를 치켜들고 두 차례 달빛을 들이마신 뒤 내지른다.",
    chargeBreak: { stateIds: [PIERCED], damage: 700, message: "포효가 목에 걸려 끊겼다!" },
  } as unknown as SkillRecord);
  for (const [id, power] of [["skill_fs_dragon_bite", 120], ["skill_fs_dragon_tail", 64]] as const) {
    const s = db.skills.find((x) => x.id === id);
    if (s) s.power = power;
  }
  const scales = db.skills.find((s) => s.id === "skill_fs_dragon_scales") as SkillRecord;
  scales.stateEffects = [{ stateId: PIERCED, chance: 100, operation: "remove" }, { stateId: "state_defense_up", chance: 100, operation: "add" }];

  // 비늘은 칼날도 반쯤 흘린다(물리 55%) — 찌르기만으로 밀어붙이면 오래 걸리고, 그 사이 숨결·포효가 쌓인다. 마법은 0 → 갈라지면 3배.
  enemy.damageTypeRates = { magic: 0, physical: 55 } as EnemyRecord["damageTypeRates"];
  enemy.stats = { maxHp: 4600, maxMp: 99, attack: 182, defense: 100, mind: 60, agility: 44 };
  enemy.skillIds = ["skill_fs_dragon_bite", "skill_fs_dragon_tail", "skill_fs_dragon_breath", "skill_fs_dragon_scales", "skill_fs_dragon_roar"];
  enemy.actions = [
    act("skill_fs_dragon_bite", 6), act("skill_fs_dragon_tail", 5),
    act("skill_fs_dragon_breath", 30, { kind: "turn", start: 3, interval: 4 }),
    act("skill_fs_dragon_scales", 25, { kind: "turn", start: 6, interval: 4 }),
    // 2막부터 — 전투 이벤트가 장전하면(스위치) 다음 차례에 포효를 모은다. 쓰고 나면 스위치를 끈다.
    act("skill_fs_dragon_roar", 60, { kind: "switch", switchId: SW_DRAGON_ROAR, value: true }, undefined, SW_DRAGON_ROAR),
    // 오래 끌면 숨결이 두 차례마다 — 비늘을 가르지 않고 버티면 진다.
    act("skill_fs_dragon_breath", 31, { kind: "turn", start: 16, interval: 2 }),
  ];
  enemy.rewards = { ...enemy.rewards, exp: 640, gold: 480 } as EnemyRecord["rewards"];

  const text = (body: string, speaker?: string): Command => (speaker ? say(speaker, body) : narrate(body));
  const keep = (troopRec.battleEventPages ?? []).filter((p) => p.id === "troop_fs_dragon_open" || p.id === "troop_fs_dragon_crack");
  troopRec.battleEventPages = [
    ...keep.map((p) => p.id === "troop_fs_dragon_open"
      ? { ...p, commands: [...p.commands, setSw(SW_DRAGON_P2, false), setSw(SW_DRAGON_P3, false), setSw(SW_DRAGON_ROAR, false), setSw(SW_DRAGON_MIRROR, false)] }
      : p),
    { id: "troop_fs_dragon_close", name: "관통상 풀림 — 비늘이 닫혔다", span: "battle", runOnce: false,
      conditions: [{ kind: "enemyState", enemyId: DRAGON, stateId: PIERCED, present: false }, sw(SW_DRAGON_CRACK, true), sw(SW_DRAGON_P2, false)],
      commands: [setSw(SW_DRAGON_CRACK, false), text("비늘이 다시 닫힌다!")] },
    // 2막의 비늘은 닫히면서 거울이 된다 — 단일 주문은 튕겨 나온다(가르면 거울도 깨진다: 찌르기 두 기술이 거울을 벗긴다).
    { id: "troop_fs_dragon_close_mirror", name: "2막 — 닫힌 비늘이 거울이 된다", span: "battle", runOnce: false,
      conditions: [{ kind: "enemyState", enemyId: DRAGON, stateId: PIERCED, present: false }, sw(SW_DRAGON_P2, true), sw(SW_DRAGON_MIRROR, false)],
      commands: [setSw(SW_DRAGON_CRACK, false), setSw(SW_DRAGON_MIRROR), enemyState(DRAGON, "add", FS_MIRROR_STATE), anim(DRAGON, "anim_gen_guard_barrier"),
        text("닫힌 비늘이 달빛을 받아\n거울처럼 번득인다.")] },
    { id: "troop_fs_dragon_mirror_broken", name: "2막 — 거울이 깨졌다", span: "battle", runOnce: false,
      conditions: [{ kind: "enemyState", enemyId: DRAGON, stateId: PIERCED, present: true }, sw(SW_DRAGON_MIRROR, true)],
      commands: [setSw(SW_DRAGON_MIRROR, false), enemyState(DRAGON, "remove", FS_MIRROR_STATE), text("거울 비늘이 쩍 갈라진다!")] },
    { id: "troop_fs_dragon_phase2", name: "2막 — 체력 60%, 날개를 편다", span: "battle", runOnce: true,
      conditions: [{ kind: "enemyHpBelow", enemyId: DRAGON, percent: 60 }],
      commands: [setSw(SW_DRAGON_P2), m2("m2-048-shake-screen", { intensity: "6", durationMs: 700, direction: "vertical" }),
        enemyState(DRAGON, "remove", PIERCED), anim(DRAGON, "anim_gen_power_aura"),
        text("달빛의 용이 날개를 활짝 편다.\n천장의 물방울이 달빛처럼 흩날린다."),
        setSw(SW_DRAGON_ROAR)] },
    // 2막 동안 다섯 차례마다 포효를 장전한다.
    { id: "troop_fs_dragon_roar_arm", name: "2막 — 포효 장전", span: "turn", runOnce: false,
      conditions: [{ kind: "turn", start: 4, interval: 4 }, sw(SW_DRAGON_P2, true), sw(SW_DRAGON_ROAR, false)],
      commands: [setSw(SW_DRAGON_ROAR)] },
    { id: "troop_fs_dragon_phase3", name: "3막 — 체력 25%, 달이 기운다", span: "battle", runOnce: true,
      conditions: [{ kind: "enemyHpBelow", enemyId: DRAGON, percent: 25 }],
      commands: [setSw(SW_DRAGON_P3), enemyState(DRAGON, "add", "state_agility_up"), anim(DRAGON, "anim_gen_power_aura"),
        text("용의 숨이 거칠어진다.\n비늘 틈마다 푸른 빛이 끓는다."), setSw(SW_DRAGON_ROAR)] },
  ] as TroopRecord["battleEventPages"];
}
