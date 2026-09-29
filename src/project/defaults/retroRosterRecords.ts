// retro2003 2차 로스터(계약 src/assets/retroRoster.ts + 묶음 src/assets/retroRosterSkills/*)의 기본 DB 레코드 생성기.
//
// 걷기 칩 약 100개마다 직업 하나(class_<key>)·예비 배우 하나(actor_<key>)·스킬 8개. 800개를 손으로 쓰지 않는다 —
// 스킬은 계약의 motion·레이어 앵커·설명 낱말에서 scope·위력·MP·속성·상태를 규칙 필드로 **유도**한다(deriveRosterSkillSeed).
// 규칙 엔진에 없는 뜻은 기존 12직업 씨앗과 같은 방식으로 가장 가까운 상태로 대신한다.
// 시작 파티(STARTER_ACTOR_IDS)는 바꾸지 않는다. 묶음 파일이 비어 있으면 그 직업은 스킬 없이 들어간다.
import type { ActorRecord, ClassRecord, DatabaseStateEffect, SkillRecord } from "../types";
import type { RetroClassSkill, RetroFxLayer } from "@/assets/retroClassSkills";
import { RETRO_ROSTER, retroRosterClass, type RetroRosterClass } from "@/assets/retroRoster";
import { RETRO_PARTY_PIXEL_SHEETS, RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { charsetBattlerIdForChip, charsetBattler } from "@/assets/charsetBattlers";
import { partyPixelResourceId } from "@/assets/partyPixelSheets";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { generatedEffectDatabaseAnimationId as anim } from "@/assets/generatedEffectSheets";
import { ACTOR_LEVEL_MAX, createActorRecord } from "../actorModel";
import { normalizeClassRecord, normalizeSkillRecord } from "../databaseRecordModel";
import { RETRO_MECHANIC_AREA_RADIUS, type RetroSkillMechanic } from "@/assets/retroSkillMechanics";
import { DEFAULT_ANIMATION_ID, DEFAULT_EQUIPMENT_ID, DEFAULT_SKILL_ID } from "./constants";
import {
  CLERIC_EQUIPMENT_IDS, EQUIPMENT_FOCUS_CHARM_ID, EQUIPMENT_LEATHER_ARMOR_ID, EQUIPMENT_MAGE_STAFF_ID, EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_SCOUT_DAGGER_ID, EQUIPMENT_TRAVELER_HAT_ID, GUARDIAN_EQUIPMENT_IDS, HERO_EQUIPMENT_IDS, MAGE_EQUIPMENT_IDS, RANGER_EQUIPMENT_IDS, SCOUT_EQUIPMENT_IDS,
} from "./defaultDatabaseRecordIds";
import { add, record, remove, type Seed } from "./retroClassSkillRecords";

/** 이미 기본 DB 에 있는 직업(마도사). 로스터 표에는 칩 이전 표시로만 들어 있다. */
const EXISTING_CLASS_IDS: ReadonlySet<string> = new Set(["class_mage"]);

// ── 직업 성장 곡선 ───────────────────────────────────────────────────────────────────────────────────
// [시작, 끝] 순서: maxHp · maxMp · attack · defense · mind · agility. 기존 4역할(roleParameterCurves)과 같은 규모(끝값 최대 200)다.
type Pair = readonly [number, number];
interface RoleCurve { readonly hp: Pair; readonly mp: Pair; readonly atk: Pair; readonly def: Pair; readonly mind: Pair; readonly agi: Pair }
const ROLE_CURVES: Readonly<Record<string, RoleCurve>> = {
  물리: { hp: [45, 760], mp: [10, 130], atk: [22, 200], def: [14, 95], mind: [12, 60], agi: [14, 95] },
  탱커: { hp: [60, 980], mp: [10, 120], atk: [16, 110], def: [22, 200], mind: [12, 80], agi: [10, 65] },
  마법: { hp: [34, 560], mp: [26, 340], atk: [10, 55], def: [10, 70], mind: [22, 200], agi: [14, 85] },
  회복: { hp: [40, 640], mp: [26, 320], atk: [10, 50], def: [14, 90], mind: [22, 190], agi: [12, 75] },
  지원: { hp: [38, 620], mp: [24, 300], atk: [12, 70], def: [14, 90], mind: [20, 160], agi: [16, 120] },
  민첩: { hp: [38, 640], mp: [12, 150], atk: [18, 140], def: [12, 70], mind: [12, 70], agi: [22, 200] },
  원거리: { hp: [36, 600], mp: [14, 170], atk: [20, 175], def: [11, 65], mind: [12, 80], agi: [18, 130] },
  소환: { hp: [36, 600], mp: [24, 300], atk: [12, 65], def: [12, 75], mind: [20, 180], agi: [14, 95] },
  운: { hp: [40, 660], mp: [14, 170], atk: [16, 110], def: [12, 80], mind: [14, 100], agi: [20, 150] },
  지휘: { hp: [46, 780], mp: [16, 200], atk: [18, 130], def: [18, 130], mind: [16, 110], agi: [14, 95] },
  혼합: { hp: [42, 700], mp: [20, 240], atk: [18, 150], def: [14, 90], mind: [18, 150], agi: [15, 100] },
};

function curve([start, end]: Pair): number[] {
  const last = Math.max(1, ACTOR_LEVEL_MAX - 1);
  return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) => Math.round(start + (end - start) * (index / last)));
}

/** 역할 → 직업 성장 곡선. 모르는 역할은 혼합. */
export function rosterParameterCurves(role: string): ClassRecord["parameterCurves"] {
  const row = ROLE_CURVES[role] ?? ROLE_CURVES.혼합!;
  return { maxHp: curve(row.hp), maxMp: curve(row.mp), attack: curve(row.atk), defense: curve(row.def), mind: curve(row.mind), agility: curve(row.agi) };
}

const STANDARD_BATTLE_COMMANDS = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "기술", kind: "skill" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
  { id: "cmd_change", name: "교체", kind: "switch" },
] as const;

const ROLE_EQUIPMENT: Readonly<Record<string, readonly string[]>> = {
  물리: HERO_EQUIPMENT_IDS, 탱커: GUARDIAN_EQUIPMENT_IDS, 마법: MAGE_EQUIPMENT_IDS, 회복: CLERIC_EQUIPMENT_IDS, 지원: CLERIC_EQUIPMENT_IDS,
  민첩: SCOUT_EQUIPMENT_IDS, 원거리: RANGER_EQUIPMENT_IDS, 소환: MAGE_EQUIPMENT_IDS, 운: SCOUT_EQUIPMENT_IDS, 지휘: HERO_EQUIPMENT_IDS, 혼합: HERO_EQUIPMENT_IDS,
};

/** 근접 무장이 어울리는 역할은 검, 시전 역할은 지팡이, 재빠른 역할은 단검. */
function rosterWeapon(role: string): string {
  if (["마법", "회복", "지원", "소환"].includes(role)) return EQUIPMENT_MAGE_STAFF_ID;
  if (["민첩", "원거리", "운"].includes(role)) return EQUIPMENT_SCOUT_DAGGER_ID;
  return DEFAULT_EQUIPMENT_ID;
}

/**
 * 배우 능력치 배율(hp·mp·공·방·정신·민첩). **전투 능력치의 정본은 배우 parameterCurves** 라서 직업 곡선만 고치면 파티원이 다 똑같다.
 * 기본 배우 곡선(Lv1 HP 514 척도)에 역할 배율을 곱한다 — 기본 적 척도를 유지하면서 역할 색을 낸다.
 */
const ROLE_ACTOR_MULT: Readonly<Record<string, readonly [number, number, number, number, number, number]>> = {
  물리: [1.05, 0.7, 1.25, 0.95, 0.7, 1.0], 탱커: [1.3, 0.7, 0.85, 1.35, 0.7, 0.75], 마법: [0.8, 1.5, 0.6, 0.7, 1.35, 0.95],
  회복: [0.9, 1.4, 0.6, 0.9, 1.3, 0.9], 지원: [0.9, 1.3, 0.75, 0.9, 1.15, 1.15], 민첩: [0.9, 0.8, 1.05, 0.8, 0.8, 1.35],
  원거리: [0.85, 0.9, 1.2, 0.7, 0.85, 1.1], 소환: [0.85, 1.35, 0.65, 0.8, 1.25, 1.0], 운: [0.95, 0.9, 0.95, 0.85, 0.95, 1.2],
  지휘: [1.1, 1.0, 1.0, 1.1, 0.95, 0.95], 혼합: [1.0, 1.15, 1.1, 0.95, 1.1, 1.0],
};

/** 배우 곡선에 역할 배율을 곱한다. */
export function rosterActorCurves(role: string, base: ActorRecord["parameterCurves"]): ActorRecord["parameterCurves"] {
  const mult = ROLE_ACTOR_MULT[role] ?? ROLE_ACTOR_MULT.혼합!;
  const scale = (curve: readonly number[], factor: number) => curve.map((value) => Math.max(1, Math.round(value * factor)));
  return {
    maxHp: scale(base.maxHp, mult[0]), maxMp: scale(base.maxMp, mult[1]), attack: scale(base.attack, mult[2]),
    defense: scale(base.defense, mult[3]), mind: scale(base.mind, mult[4]), agility: scale(base.agility, mult[5]),
  };
}

/** 직업 레코드 id → 로스터 행. */
export function rosterClassIds(): readonly string[] {
  return RETRO_ROSTER.filter((row) => !EXISTING_CLASS_IDS.has(row.classId)).map((row) => row.classId);
}

/** 로스터 직업 레코드(마도사는 기존 것이라 뺀다). 습득 스킬은 defaultClassRecords 의 공용 루프가 계약 레벨대로 붙인다. */
export function retroRosterClassRecords(): ClassRecord[] {
  return RETRO_ROSTER.filter((row) => !EXISTING_CLASS_IDS.has(row.classId)).map((row) => {
    const humanoid = row.body === "humanoid";
    return normalizeClassRecord({
      id: row.classId,
      name: row.name,
      // 쌍도·쌍검 계열은 양손 무장, 방어 태세가 직업인 역할은 강한 방어.
      options: {
        dualWield: /쌍검|쌍도|쌍/.test(row.concept), autoBattle: false, fixedEquipment: false,
        mightyGuard: row.role === "탱커",
      },
      animationId: DEFAULT_ANIMATION_ID,
      skillIds: [DEFAULT_SKILL_ID],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      parameterCurves: rosterParameterCurves(row.role),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
        // 사람이 아닌 몸(짐승·탈것·몬스터)은 장신구만 허용한다 — 무기와 옷은 그림에 그려지지 않는다.
        equipmentIds: humanoid ? [...(ROLE_EQUIPMENT[row.role] ?? HERO_EQUIPMENT_IDS)] : [EQUIPMENT_FOCUS_CHARM_ID],
      },
    });
  });
}

// ── 예비 배우 ────────────────────────────────────────────────────────────────────────────────────────
/** "actor1-5" → { sheet: "actor1", index: 5 }, "animal-0" → { sheet: "animal", index: 0 }. */
export function rosterChip(chip: string): { readonly sheet: string; readonly index: number } {
  const match = /^([a-z]+\d*)-(\d)$/.exec(chip);
  if (!match) throw new Error(`로스터 칩 표기가 이상하다: ${chip}`);
  return { sheet: match[1]!, index: Number(match[2]) };
}

/** 배우 id: class_<key> → actor_<key>. */
export function rosterActorId(classId: string): string {
  return classId.replace(/^class_/, "actor_");
}

/**
 * 이 로스터 직업의 전투 그림 id.
 *  · Actor 칩 — 걷기 칩 전투 시트(항상 있다). People 칩 — 시트가 이미 있을 때만(없으면 undefined = 기존 폴백, 나중에 자동 대응이 잡는다).
 *  · 짐승·탈것·몬스터 — 묶음이 9칸 시트를 등록했을 때만 "party-pixel-<칩>", 아니면 undefined.
 */
export function rosterBattleResourceId(row: RetroRosterClass): string | undefined {
  const { sheet, index } = rosterChip(row.chip);
  if (row.body === "humanoid") {
    const id = charsetBattlerIdForChip(`easyrpg-charset-${sheet}`, index);
    return charsetBattler(id) ? id : undefined;
  }
  return RETRO_PARTY_PIXEL_SHEETS.some((entry) => entry.chip === row.chip) ? partyPixelResourceId(row.chip) : undefined;
}

export function retroRosterActorRecords(): ActorRecord[] {
  return RETRO_ROSTER.filter((row) => !EXISTING_CLASS_IDS.has(row.classId)).map((row) => {
    const { sheet, index } = rosterChip(row.chip);
    const characterResourceId = `easyrpg-charset-${sheet}`;
    const battleCharacterResourceId = rosterBattleResourceId(row);
    const face = reviewedFaceIdForCharset(characterResourceId, index);
    const humanoid = row.body === "humanoid";
    const created = createActorRecord(rosterActorId(row.classId), row.classId, {
      characterResourceId,
      battleCharacterResourceId,
      defaultSkillId: DEFAULT_SKILL_ID,
      unarmedAnimationId: DEFAULT_ANIMATION_ID,
    });
    const actor: ActorRecord = {
      ...created,
      parameterCurves: rosterActorCurves(row.role, created.parameterCurves),
      name: row.name,
      nickname: "없음",
      characterResourceId,
      characterIndex: index,
      battleCharacterResourceId,
      initialEquipment: humanoid
        ? {
          weapon: rosterWeapon(row.role),
          armor: ["마법", "회복", "지원", "소환"].includes(row.role) ? EQUIPMENT_MYSTIC_ROBE_ID : EQUIPMENT_LEATHER_ARMOR_ID,
          helmet: EQUIPMENT_TRAVELER_HAT_ID,
          accessory: EQUIPMENT_FOCUS_CHARM_ID,
        }
        : { accessory: EQUIPMENT_FOCUS_CHARM_ID },
    };
    // 얼굴이 없어야 하는 칸(탈것·사물)은 비운다. createActorRecord 가 넣는 기본 얼굴을 지운다.
    if (face) return { ...actor, faceResourceId: face };
    const { faceResourceId: _drop, ...rest } = actor;
    return rest as ActorRecord;
  });
}

// ── 스킬 레코드 유도 ─────────────────────────────────────────────────────────────────────────────────
const HEAL = /치유|회복|치료|힐|재생|수복|약초|우유|찻|차 대접|응급|돌보|보살|성가|기도|염불|생명|소생|부활|되살|heal|cure/;
const REVIVE = /부활|소생|되살아|revive/;
const CLEANSE = /정화|해독|씻어|해제|디스펠|purify|cleanse/;
const STEAL = /훔치|절도|steal/;
const ENEMY = /적|상대|몬스터/;
const ALLY = /아군|동료|파티|자신|스스로/;
const ALL_WORDS = /전체|광역|모든 적|적 전원|전원|난사|일제|한꺼번|사방|폭풍|비처럼|휩쓸/;
const SINGLE_WORDS = /하나|한 명|단일|일격|한 방/;
const DRAIN = /흡수|흡혈|흡정|빨아/;

/** 상태 부여(적에게). [낱말, 상태, 확률]. 여러 개가 걸리면 앞의 둘까지. */
const DEBUFF_RULES: readonly (readonly [RegExp, readonly (readonly [string, number])[]])[] = [
  [/맹독/, [["state_deep_poison", 55]]],
  [/독|중독|독침|toxin|venom|poison/, [["state_poison", 70]]],
  [/수면|잠재|재우|자장|졸음|sleep/, [["state_sleep", 50]]],
  [/마비|감전|경직|기절|스턴|stun|paraly/, [["state_paralysis", 35]]],
  [/침묵|봉인|입막|silence/, [["state_silence", 45]]],
  [/매혹|혼란|현혹|유혹|착란|환각|악몽/, [["state_attack_down", 55], ["state_defense_down", 55]]],
  [/약화|위축|겁|공포|포효|호통|기세를 꺾|저주|hex|curse/, [["state_attack_down", 50]]],
  [/방어 (?:하락|무시|파괴)|갑옷 파괴|부수|파쇄|약점|분석|간파|녹여|부식|균열/, [["state_defense_down", 45]]],
  [/감속|둔화|속박|묶|휘감|늪|덫|얼려|빙결|끈적|거미줄|발목|붙잡|넘어뜨/, [["state_agility_down", 50]]],
];

/** 아군·자신 강화. */
const BUFF_RULES: readonly (readonly [RegExp, string])[] = [
  [/가속|속도|민첩|회피|질풍|신속|빠르|시간|타임|정찰/, "state_agility_up"],
  [/방어|수호|보호|철벽|장갑|갑옷|방패|결계|장막|털|단단|버티|견고|막아|감싸/, "state_defense_up"],
  [/공격|힘|기합|분노|광폭|사기|호령|고무|함성|투지|왕명|명령|축복|강화|올린/, "state_attack_up"],
];

// 속성 낱말은 **한국어 이름·설명**에서만 찾는다(짧은 낱말은 오탐이 많다: 「물어뜯기」의 물, 「빙글」의 빙, 「풍선」의 풍, 「수류탄」의 수류).
// 레이어 키의 영어 낱말은 아래 KEY 표로 좁게만 본다(hit·wave 같은 낱말은 속성이 아니다).
const ELEMENT_RULES: readonly (readonly [RegExp, string])[] = [
  [/화염|불꽃|불길|불덩|불태|불타|불의|불을|불사|불기둥|불새|지옥불|폭염|용암|열기|화룡|업화|화살에 불|점화|폭죽|fire|flame/, "fire"],
  [/얼음|빙결|빙하|빙벽|빙설|서리|냉기|눈보라|얼려|얼어|한파|frost|blizzard/, "ice"],
  [/번개|낙뢰|천둥|뇌격|뇌운|뇌광|전기|감전|스파크|thunder|lightning/, "thunder"],
  [/물대포|물줄기|물결|물살|물보라|물기둥|물총|파도|해일|수룡|수류(?!탄)|폭포|우유 물|급류/, "water"],
  [/대지|암석|바위|흙|모래|땅|지진|낙석|굴착|진흙|늪|earth/, "earth"],
  [/질풍|돌풍|강풍|바람|회오리|깃털|풍압|검풍|폭풍우|태풍|wind/, "wind"],
  [/성광|신성|성스|천사|심판|후광|성검|성가|holy/, "holy"],
  [/어둠|암흑|저주|흡혈|영혼|사신|죽음|악몽|그림자|지옥|망령|dark/, "dark"],
];
const ELEMENT_KEY_RULES: readonly (readonly [RegExp, string])[] = [
  [/fire|flame|meteor/, "fire"], [/frost|blizzard|ice_/, "ice"], [/thunder|lightning/, "thunder"],
  [/holy|halo/, "holy"], [/shadow|dark|venom/, "dark"],
];
const WEAPON_RULES: readonly (readonly [RegExp, string])[] = [
  [/창|찌르|꿰뚫|투창|lance|spear|pierce/, "spear"],
  [/활|화살|석궁|사격|저격|연사|총|탄환|투척|던지|부메랑|작살|암기|대포|함포|포격|폭탄|수류탄|arrow|bow/, "bow"],
  [/주먹|발차기|킥|권|타격|강타|박치기|들이받|받기|뿔|몽둥이|망치|곤봉|밟|짓밟|내려찍|뒷발|꼬리|채찍|투석|punch|kick|bash/, "hit"],
  [/검|도끼|낫|칼|베|참|쌍도|거합|레이피어|할퀴|발톱|송곳니|물기|물어|이빨|쪼|긁|sword|slash|blade/, "sword"],
];
const MAGIC_ELEMENTS: ReadonlySet<string> = new Set(["fire", "ice", "thunder", "water", "earth", "wind", "holy", "dark"]);
const MAGIC_ROLES: ReadonlySet<string> = new Set(["마법", "회복", "지원", "소환"]);

/** 레벨 곡선(레벨 1·3·5·7·10·12·16·22). 기존 12직업 씨앗의 위력·MP 를 이은 값이다. */
const LEVELS = [1, 3, 5, 7, 10, 12, 16, 22] as const;
const POWER = [62, 70, 78, 86, 98, 110, 128, 225] as const;
const HEAL_POWER = [42, 44, 46, 48, 50, 54, 58, 80] as const;
const ATTACK_MP = [3, 4, 6, 8, 9, 12, 16, 30] as const;
const SUPPORT_MP = [4, 5, 6, 8, 10, 12, 14, 30] as const;
const HEAL_MP = [4, 5, 6, 8, 10, 12, 14, 32] as const;

function tier(level: number): number {
  let best = 0;
  for (let i = 0; i < LEVELS.length; i += 1) if (LEVELS[i]! <= level) best = i;
  return best;
}

function layerKeys(layers: readonly RetroFxLayer[]): string {
  return layers.map((layer) => layer.key.replace(/_/g, " ")).join(" ");
}

/** 속성: 한국어 이름·설명 → 레이어 키(좁은 표) 순. 무기 속성은 공격력 기술만 받고 한국어 낱말에서만 찾는다(없으면 타격). */
function pickElement(korean: string, keys: string, allowWeapon: boolean): string | undefined {
  const magical = ELEMENT_RULES.find(([pattern]) => pattern.test(korean))?.[1] ?? ELEMENT_KEY_RULES.find(([pattern]) => pattern.test(keys))?.[1];
  if (magical) return magical;
  if (!allowWeapon) return undefined;
  return WEAPON_RULES.find(([pattern]) => pattern.test(korean))?.[1] ?? "hit";
}

function debuffStates(text: string, chanceScale = 1): DatabaseStateEffect[] {
  const found: DatabaseStateEffect[] = [];
  for (const [pattern, states] of DEBUFF_RULES) {
    if (!pattern.test(text)) continue;
    for (const [stateId, chance] of states) {
      if (found.some((entry) => entry.stateId === stateId)) continue;
      found.push(add(stateId, Math.min(100, Math.round(chance * chanceScale))));
    }
    if (found.length >= 2) break;
  }
  return found.slice(0, 2);
}

function buffStates(text: string): DatabaseStateEffect[] {
  const states: DatabaseStateEffect[] = [];
  for (const [pattern, stateId] of BUFF_RULES) {
    if (pattern.test(text) && !states.some((entry) => entry.stateId === stateId)) states.push(add(stateId));
    if (states.length >= 2) break;
  }
  return states.length > 0 ? states : [add("state_attack_up")];
}

/** 애니메이션(retro2003 이 아닌 스킨에서만 쓰는 옛 이펙트 층). 속성·종류에서 고른다. */
function animationFor(kind: Seed["kind"], element: string | undefined, text: string, finisher: boolean): string {
  if (kind === "healing") return REVIVE.test(text) ? anim("revive-rise") : anim("heal-bloom");
  if (kind === "steal") return anim("smoke-vanish");
  if (kind === "support") {
    if (CLEANSE.test(text)) return anim("cleanse-sparkle");
    if (/수면|잠|자장/.test(text)) return anim("sleep-dust");
    if (/혼란|매혹|현혹/.test(text)) return anim("confusion-spiral");
    if (/마비|속박|묶/.test(text)) return anim("paralysis-bind");
    if (/독/.test(text)) return anim("poison-mist");
    if (/연막|안개/.test(text)) return anim("blind-veil");
    if (/노래|음악|선율/.test(text)) return anim("sonic-wave");
    if (/방어|결계|장막|방패|철벽/.test(text)) return anim("guard-barrier");
    return anim("power-aura");
  }
  if (finisher && !element) return anim("critical-burst");
  if (/운석|메테오|낙하/.test(text)) return anim("meteor-fall");
  if (/흡수|흡혈|흡정/.test(text)) return anim("drain-orbs");
  if (/독/.test(text) && !element) return anim("poison-mist");
  if (/노래|음파|울음|포효|외침/.test(text) && !element) return anim("sonic-wave");
  switch (element) {
    case "fire": return anim("fire-burst");
    case "ice": return anim("ice-shatter");
    case "thunder": return anim("thunder-strike");
    case "water": return anim("water-column");
    case "earth": return anim("earth-spike");
    case "wind": return anim("wind-slice");
    case "holy": return anim("holy-beam");
    case "dark": return anim("shadow-pulse");
    case "bow": return anim("projectile-shot");
    case "hit": return /할퀴|발톱|물기|물어|송곳니|이빨/.test(text) ? anim("claw-rake") : anim("tackle-impact");
    case "spear": case "sword": return /할퀴|발톱|물기|물어|송곳니|이빨/.test(text) ? anim("claw-rake") : anim("slash-steel");
    default: return anim("arcane-nova");
  }
}

/**
 * 계약 스킬 하나 → 레코드 씨앗. **순수 함수** — 같은 계약이면 언제나 같은 결과라 편집기·테스트가 그대로 부를 수 있다.
 * 판정 순서: 훔치기 → 부활 → 정화 → (버프 모션 / 아군·자신 앵커) 회복·강화·약체화 → 적 공격.
 * 대상 편의 정본은 레이어 앵커(allTargets = 전체, allAllies = 아군 전체, user 만 = 자신)다. 낱말은 앵커가 없을 때 보조한다.
 */
export function deriveRosterSkillSeed(skill: Pick<RetroClassSkill, "name" | "description" | "motion" | "level" | "layers">, role: string): Seed {
  const korean = `${skill.name} ${skill.description}`;
  const keys = layerKeys(skill.layers);
  const text = `${korean} ${keys}`;
  const i = tier(skill.level);
  const finisher = skill.motion === "finisher" || skill.level >= 22;
  const anchors = new Set(skill.layers.map((layer) => layer.anchor));
  const enemyAnchor = anchors.has("target") || anchors.has("allTargets");
  const allyAnchor = anchors.has("allAllies");
  const selfOnly = !enemyAnchor && !allyAnchor;
  const allEnemies = anchors.has("allTargets") || skill.motion === "spin" || (!anchors.has("target") && ALL_WORDS.test(text) && !SINGLE_WORDS.test(text))
    || (finisher && anchors.has("screen") && !SINGLE_WORDS.test(text) && (MAGIC_ROLES.has(role) || !/일격/.test(text)));
  const hasEnemyWords = ENEMY.test(skill.description);
  const hasAllyWords = ALLY.test(skill.description);
  const allWords = ALL_WORDS.test(text) || /전체|모두/.test(skill.description);

  // ① 훔치기
  if (STEAL.test(text)) return { scope: "enemy", mp: 0, kind: "steal", animation: animationFor("steal", undefined, text, false) };

  // ② 회복류 — 아군 앵커·버프 모션·시전 모션이면서 적 낱말이 없을 때.
  const supportShaped = skill.motion === "buff" || allyAnchor || (selfOnly && skill.motion !== "finisher")
    || ((HEAL.test(text) || CLEANSE.test(text)) && !hasEnemyWords && skill.motion === "cast");
  if (supportShaped && !(enemyAnchor && !HEAL.test(text) && hasEnemyWords && !hasAllyWords)) {
    if (HEAL.test(text) && !DRAIN.test(skill.description) && !(hasEnemyWords && !hasAllyWords && !REVIVE.test(text))) {
      if (REVIVE.test(text)) {
        return { scope: allyAnchor || allWords ? "allAllies" : "ally", mp: allyAnchor || allWords ? 26 : 20, kind: "healing", power: allyAnchor || allWords ? 50 : 60,
          animation: animationFor("healing", undefined, text, false), states: [remove("state_death")] };
      }
      const scope = allyAnchor || allWords ? "allAllies" : selfOnly || /자신|스스로/.test(skill.description) ? "self" : "ally";
      const power = Math.round(HEAL_POWER[i]! * (scope === "allAllies" ? 0.9 : 1) * (finisher ? 1.1 : 1));
      return { scope, mp: HEAL_MP[i]! + (scope === "allAllies" ? 3 : 0), kind: "healing", power, animation: animationFor("healing", undefined, text, false),
        states: /재생/.test(text) ? [add("state_regen")] : undefined };
    }
    if (CLEANSE.test(text) && !hasEnemyWords) {
      return { scope: allyAnchor || allWords ? "allAllies" : "ally", mp: SUPPORT_MP[i]!, kind: "support", animation: animationFor("support", undefined, text, false),
        states: ["state_poison", "state_deep_poison", "state_sleep", "state_paralysis", "state_silence", "state_attack_down", "state_defense_down", "state_agility_down"].map(remove) };
    }
    // 적을 약하게 하는 「버프 모션」(연막·자장가·저주 시선)은 적 쪽으로 간다.
    const debuffs = debuffStates(text, 1.4);
    if (debuffs.length > 0 && !allyAnchor && (enemyAnchor || (hasEnemyWords && !hasAllyWords))) {
      return { scope: anchors.has("allTargets") || allEnemies ? "allEnemies" : "enemy", mp: SUPPORT_MP[i]! + (allEnemies ? 3 : 0), kind: "support",
        animation: animationFor("support", undefined, text, false), states: debuffs.map((entry) => ({ ...entry, chance: Math.min(90, entry.chance ?? 75) })) };
    }
    const scope = allyAnchor || (allWords && !/자신|스스로/.test(skill.description)) ? "allAllies" : "self";
    return { scope, mp: SUPPORT_MP[i]! + (scope === "allAllies" ? 4 : 0), kind: "support", animation: animationFor("support", undefined, text, false), states: buffStates(text) };
  }

  // ③ 회복 필살기(아군 앵커 없이 화면 연출만 있는 성가·기도)
  if (finisher && HEAL.test(text) && !hasEnemyWords) {
    return { scope: "allAllies", mp: 34, kind: "healing", power: 90, animation: animationFor("healing", undefined, text, true), states: [remove("state_death")] };
  }

  // ④ 적 공격
  const magical = pickElement(korean, keys, false);
  const magicalElement = magical !== undefined && MAGIC_ELEMENTS.has(magical);
  // 정신력(mind) 피해는 시전 역할(마법·회복·지원·소환)의 몫이다 — 배우 곡선이 역할별이라 물리 역할의 마법 낱말 기술도 공격력으로 친다.
  // 혼합·운·지휘는 시전 모션이거나 속성 필살기일 때만 정신력.
  const flexible = role === "혼합" || role === "운" || role === "지휘";
  const kind: "attack" | "mind" = MAGIC_ROLES.has(role) && skill.motion !== "dash-strike" && skill.motion !== "leap-strike" && skill.motion !== "flurry" && skill.motion !== "spin"
    ? "mind"
    : flexible && (skill.motion === "cast" || (finisher && magicalElement)) ? "mind" : "attack";
  // 정신력 마법은 무기 속성이 없다(속성 낱말이 없으면 무속성). 공격력 기술만 검·창·활·타격 속성을 갖는다.
  const element = magical ?? (kind === "attack" ? pickElement(korean, keys, true) : undefined);
  const all = allEnemies;
  const base = POWER[i]! * (skill.motion === "flurry" ? 0.92 : 1);
  const power = Math.round(base * (all ? (finisher ? 0.8 : 0.72) : 1));
  const mp = Math.round(ATTACK_MP[i]! * (all && !finisher ? 1.4 : 1)) + (finisher && all ? 6 : 0);
  const critical = /급소|암살|저격|치명|필중|일섬|거합|찌르/.test(text) ? (finisher ? 35 : 25) : skill.motion === "flurry" || skill.motion === "blink-strike" ? 15 : undefined;
  const states = debuffStates(text, 0.75);
  const kindWord: Seed["kind"] = kind;
  return {
    scope: all ? "allEnemies" : "enemy",
    mp: Math.max(kind === "attack" && skill.level <= 1 ? 2 : 3, mp),
    kind: kindWord,
    power,
    ...(element ? { element } : {}),
    animation: animationFor(kindWord, element, korean, finisher),
    ...(states.length > 0 ? { states } : {}),
    ...(critical !== undefined ? { critical } : {}),
    ...(/저격|필중/.test(text) ? { hitRate: 100 } : {}),
  };
}

/**
 * 계약의 기믹 칸(mechanic)을 유도 레코드 위에 덮는다. 적힌 필드가 우선, 나머지는 유도 값 그대로.
 * **순수 함수** — 어휘·규칙은 src/assets/retroSkillMechanics.ts 머리 주석.
 */
export function applyRetroSkillMechanic(base: SkillRecord, mechanic: RetroSkillMechanic): SkillRecord {
  const next: SkillRecord = { ...base };
  const baseStat = base.effect.kind === "damage" || base.effect.kind === "healing" ? base.effect.statistic : "attack";
  const baseAffects = base.effect.kind === "damage" || base.effect.kind === "healing" ? base.effect.affects : "hp";
  const kind = mechanic.kind ?? (base.effect.kind === "damage" || base.effect.kind === "healing" || base.effect.kind === "steal" || base.effect.kind === "scan" ? base.effect.kind : "support");
  const affects = mechanic.affects ?? baseAffects;
  if (kind === "damage") next.effect = { kind: "damage", statistic: mechanic.stat ?? (base.effect.kind === "damage" ? baseStat : "attack"), affects };
  else if (kind === "healing") next.effect = { kind: "healing", statistic: mechanic.stat ?? "mind", affects };
  else if (kind === "steal") next.effect = { kind: "steal" };
  else if (kind === "scan") next.effect = { kind: "scan" };
  else next.effect = { kind: "support" };
  if (kind !== base.effect.kind) {
    next.variance = kind === "damage" || kind === "healing" ? 15 : 0;
    next.hitRate = kind === "damage" && next.effect.kind === "damage" && next.effect.statistic === "attack" ? 95 : 100;
    if (kind !== "damage") { delete next.criticalRate; if (kind !== "healing") next.elementId = undefined; }
  }
  if (mechanic.scope) next.scope = mechanic.scope;
  if (mechanic.power !== undefined) next.power = mechanic.power;
  if (mechanic.mp !== undefined) next.mpCost = { flat: mechanic.mp, percentMax: 0 };
  if (mechanic.hits && mechanic.hits.length > 0) next.hitSequence = [...mechanic.hits];
  if (mechanic.area) next.area = { shape: mechanic.area, radius: RETRO_MECHANIC_AREA_RADIUS[mechanic.area] };
  if (mechanic.formula) next.damageFormula = mechanic.formula;
  if (mechanic.hpCost) next.hpCostPercent = mechanic.hpCost;
  if (mechanic.drain) next.drainPercent = mechanic.drain;
  if (mechanic.element === null) next.elementId = undefined;
  else if (mechanic.element) next.elementId = mechanic.element;
  if (mechanic.crit !== undefined) next.criticalRate = mechanic.crit;
  if (mechanic.hitRate !== undefined) next.hitRate = mechanic.hitRate;
  if (mechanic.priority) next.movePriority = mechanic.priority;
  if (mechanic.cooldown) next.cooldownTurns = mechanic.cooldown;
  let states: DatabaseStateEffect[] | undefined = mechanic.states
    ? mechanic.states.map((state) => ({ stateId: state.id, chance: state.chance ?? 100, operation: state.op ?? "add" }))
    : base.stateEffects ? [...base.stateEffects] : undefined;
  if (mechanic.revive && !states?.some((state) => state.stateId === "state_death" && state.operation === "remove")) {
    states = [...(states ?? []), remove("state_death")];
  }
  next.stateEffects = states && states.length > 0 ? states : undefined;
  return normalizeSkillRecord(next);
}

/** 로스터 스킬 전부의 레코드(묶음 순서 그대로). 역할을 모르는 직업(계약 밖)은 혼합으로 본다. */
export function retroRosterSkillRecords(): SkillRecord[] {
  const seen = new Set<string>();
  const records: SkillRecord[] = [];
  for (const skill of RETRO_ROSTER_SKILLS) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    const role = retroRosterClass(skill.classId)?.role ?? "혼합";
    const derived = record(skill.id, skill.name, skill.description, deriveRosterSkillSeed(skill, role));
    records.push(skill.mechanic ? applyRetroSkillMechanic(derived, skill.mechanic) : derived);
  }
  return records;
}
