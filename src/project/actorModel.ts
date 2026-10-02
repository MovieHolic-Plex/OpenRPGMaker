import { normalizeCharacterMotion, type CharacterMotionSettings } from "@/battle/characterMotion";
import { normalizeLoadoutSlots } from "@/project/skillLoadout";
import type {
  ActorCritical,
  ActorExperienceCurve,
  ActorInitialEquipment,
  ActorLearnedSkill,
  ActorOptions,
  ActorParameterCurves,
  ActorParameterKey,
  ActorRateGrade,
  ActorRecord,
  BattleAnimationId,
  ClassId,
  EquipmentId,
  SkillId,
} from "@/project/types";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";

export { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";

export const ACTOR_LEVEL_MIN = 1;
export const ACTOR_LEVEL_MAX = 99;

export const ACTOR_PARAMETER_KEYS: readonly ActorParameterKey[] = [
  "maxHp",
  "maxMp",
  "attack",
  "defense",
  "mind",
  "agility",
] as const;

export const ACTOR_RATE_GRADES: readonly ActorRateGrade[] = ["A", "B", "C", "D", "E"] as const;
export const ACTOR_STATE_RATE_PERCENTAGES: Readonly<Record<ActorRateGrade, number>> = {
  A: 100,
  B: 80,
  C: 60,
  D: 30,
  E: 0,
};

export const DEFAULT_ELEMENT_RATE_LABELS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "sword", name: "Sword" },
  { id: "spear", name: "Spear" },
  { id: "hit", name: "Hit" },
  { id: "bow", name: "Bow" },
  { id: "fire", name: "Fire" },
  { id: "ice", name: "Ice" },
  { id: "thunder", name: "Thunder" },
  { id: "water", name: "Water" },
  { id: "earth", name: "Earth" },
  { id: "wind", name: "Wind" },
  { id: "holy", name: "Holy" },
  // dark 는 elements 테이블(defaultElementRecords)에 원래 있었는데 이 시드 표에만 빠져
  // 있었다. 새 개념 추가가 아니라 표 사이 불일치 교정이다. 등급이 비면 둘이 죽는다:
  //  (1) DB 편집기의 저항 행이 이 표로 그려져서(actorRecordBattlePanels) dark 행 자체가
  //      없다 — 아무도 dark 저항을 저작할 수 없고 적의 skill_dark 는 영원히 중립이다.
  //  (2) runtime.elementMultiplierFor 는 등급이 없으면 typeMultiplier 만 돌려주고 조기
  //      반환하므로, 장비의 dark 속성 방어(equipmentEffects.elementalDefenseIds)까지
  //      함께 무시된다. 등급 "C"(=1.0 중립)를 깔면 그 경로가 살아난다.
  // 방향 주의: 적이 dark 로 때릴 때 소비되는 건 맞는 쪽인 **액터·직업의** elementRates 다
  // (적의 elementRates 는 플레이어가 적을 때릴 때 쓰인다).
  { id: "dark", name: "Dark" },
] as const;

export function defaultActorCharacterResourceId(actor: Pick<ActorRecord, "id">): string | undefined {
  switch (actor.id) {
    case "actor_hero":
      return "easyrpg-charset-actor1";
    default:
      return undefined;
  }
}

type ActorResourceDefaults = {
  readonly characterResourceId?: string;
  readonly battleCharacterResourceId?: string;
  readonly defaultEquipmentId?: EquipmentId;
  readonly defaultSkillId?: SkillId;
  readonly unarmedAnimationId?: BattleAnimationId;
};

type LegacyActorRecord = {
  readonly battleMotion?: CharacterMotionSettings;
  readonly appearanceId?: string;
  readonly id: string;
  readonly name: string;
  readonly nickname?: string;
  readonly classId: ClassId;
  readonly initialLevel: number;
  readonly maxLevel: number;
  readonly faceResourceId?: string;
  readonly characterResourceId?: string;
  readonly characterIndex?: number;
  readonly characterTransparent?: boolean;
  readonly battleCharacterResourceId?: string;
  readonly critical?: Partial<ActorCritical>;
  readonly parameterCurves?: Partial<ActorParameterCurves>;
  readonly expCurve?: Partial<ActorExperienceCurve>;
  readonly initialEquipment?: Partial<ActorInitialEquipment>;
  readonly unarmedAnimationId?: BattleAnimationId;
  readonly options?: Partial<ActorOptions>;
  readonly learnedSkills?: readonly Partial<ActorLearnedSkill>[];
  readonly skillIds?: readonly SkillId[];
  readonly stateRates?: Record<string, ActorRateGrade>;
  readonly elementRates?: Record<string, ActorRateGrade>;
  readonly loadoutSlots?: number;
  readonly battleCommandIds?: readonly string[];
};

const PARAMETER_LEVEL_ONE: Record<ActorParameterKey, number> = {
  maxHp: 514,
  maxMp: 43,
  attack: 45,
  defense: 59,
  mind: 45,
  agility: 43,
};

const PARAMETER_LEVEL_NINETY_NINE: Record<ActorParameterKey, number> = {
  maxHp: 5140,
  maxMp: 430,
  attack: 420,
  defense: 360,
  mind: 340,
  agility: 320,
};

export function createActorRecord(id: string, classId: ClassId, defaults: ActorResourceDefaults = {}): ActorRecord {
  return normalizeActorRecord({
    id,
    name: "새 주인공",
    nickname: "None",
    classId,
    initialLevel: ACTOR_LEVEL_MIN,
    maxLevel: ACTOR_LEVEL_MAX,
    characterResourceId: defaults.characterResourceId,
    battleCharacterResourceId: defaults.battleCharacterResourceId,
    initialEquipment: {
      weapon: defaults.defaultEquipmentId,
      armor: defaults.defaultEquipmentId,
    },
    unarmedAnimationId: defaults.unarmedAnimationId,
    learnedSkills: defaults.defaultSkillId ? [{ level: ACTOR_LEVEL_MIN, skillId: defaults.defaultSkillId }] : [],
  });
}

export function normalizeActorRecord(actor: LegacyActorRecord): ActorRecord {
  const initialLevel = clampLevel(actor.initialLevel ?? ACTOR_LEVEL_MIN);
  const maxLevel = Math.max(initialLevel, clampLevel(actor.maxLevel ?? ACTOR_LEVEL_MAX));
  const characterResourceId = cleanOptionalId(actor.characterResourceId) ?? defaultActorCharacterResourceId(actor);
  return {
    id: actor.id,
    ...(normalizeCharacterMotion(actor.battleMotion) ? {battleMotion:normalizeCharacterMotion(actor.battleMotion)} : {}),
    ...(actor.appearanceId !== undefined ? { appearanceId: actor.appearanceId } : {}),
    name: actor.name,
    nickname: actor.nickname ?? "None",
    classId: actor.classId,
    initialLevel,
    maxLevel,
    faceResourceId: cleanOptionalId(actor.faceResourceId) ?? defaultActorFaceResourceId({ ...actor, characterResourceId }),
    characterResourceId,
    characterIndex: normalizeOptionalSheetIndex(actor.characterIndex, 7),
    characterTransparent: actor.characterTransparent ?? false,
    battleCharacterResourceId: cleanOptionalId(actor.battleCharacterResourceId),
    critical: normalizeCritical(actor.critical),
    parameterCurves: normalizeParameterCurves(actor.parameterCurves),
    expCurve: normalizeExpCurve(actor.expCurve),
    initialEquipment: normalizeInitialEquipment(actor.initialEquipment),
    unarmedAnimationId: actor.unarmedAnimationId,
    options: normalizeOptions(actor.options),
    learnedSkills: normalizeLearnedSkills(actor.learnedSkills, actor.skillIds),
    stateRates: actor.stateRates === undefined
      ? { state_death: "C", state_poison: "C" }
      : normalizeRates(actor.stateRates),
    elementRates: defaultElementRates(actor.elementRates),
    ...(() => {
      const loadoutSlots = normalizeLoadoutSlots(actor.loadoutSlots);
      return loadoutSlots !== undefined ? { loadoutSlots } : {};
    })(),
    ...(() => {
      const battleCommandIds = normalizeBattleCommandIds(actor.battleCommandIds);
      return battleCommandIds ? { battleCommandIds } : {};
    })(),
  };
}

/** 배우 고유 전투 명령 — 빈 값·중복을 걷고, 비면 생략(직업 명령을 쓴다). 메뉴가 넘치지 않게 RM2003 처럼 7개까지. */
export const ACTOR_BATTLE_COMMAND_MAX = 7;
function normalizeBattleCommandIds(ids: readonly unknown[] | undefined): string[] | undefined {
  if (!Array.isArray(ids)) return undefined;
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id.trim() || out.includes(id.trim())) continue;
    out.push(id.trim());
    if (out.length >= ACTOR_BATTLE_COMMAND_MAX) break;
  }
  return out.length > 0 ? out : undefined;
}

export function clampLevel(value: number): number {
  return clampInteger(value, ACTOR_LEVEL_MIN, ACTOR_LEVEL_MAX);
}

export function parameterValueAtLevel(curve: readonly number[], level: number): number {
  const value = curve[clampLevel(level) - 1];
  return value ?? 1;
}

export function totalExpForLevel(curve: ActorExperienceCurve, level: number): number {
  const cappedLevel = clampLevel(level);
  if (cappedLevel === ACTOR_LEVEL_MIN) return 0;
  let total = 0;
  for (let currentLevel = ACTOR_LEVEL_MIN + 1; currentLevel <= cappedLevel; currentLevel++) {
    const growth = curve.base + Math.floor(curve.extra * Math.pow(currentLevel - 1, 0.9));
    total += growth + Math.floor((currentLevel - 2) * curve.acceleration);
  }
  return total;
}

export function stateRatePercentage(grade: ActorRateGrade): number {
  return ACTOR_STATE_RATE_PERCENTAGES[grade];
}

export function normalizeActorPatch(patch: Partial<ActorRecord>): Partial<ActorRecord> {
  const normalized: Partial<ActorRecord> = { ...patch };
  if (patch.initialLevel !== undefined) normalized.initialLevel = clampLevel(patch.initialLevel);
  if (patch.maxLevel !== undefined) normalized.maxLevel = clampLevel(patch.maxLevel);
  if (patch.characterIndex !== undefined) normalized.characterIndex = normalizeOptionalSheetIndex(patch.characterIndex, 7);
  if (patch.critical !== undefined) normalized.critical = normalizeCritical(patch.critical);
  if (patch.parameterCurves !== undefined) normalized.parameterCurves = normalizeParameterCurves(patch.parameterCurves);
  if (patch.expCurve !== undefined) normalized.expCurve = normalizeExpCurve(patch.expCurve);
  if ("battleMotion" in patch) normalized.battleMotion = normalizeCharacterMotion(patch.battleMotion);
  if (patch.initialEquipment !== undefined) normalized.initialEquipment = normalizeInitialEquipment(patch.initialEquipment);
  if (patch.options !== undefined) normalized.options = normalizeOptions(patch.options);
  if (patch.learnedSkills !== undefined) normalized.learnedSkills = normalizeLearnedSkills(patch.learnedSkills);
  if (patch.stateRates !== undefined) normalized.stateRates = normalizeRates(patch.stateRates);
  if (patch.elementRates !== undefined) normalized.elementRates = defaultElementRates(patch.elementRates);
  if ("battleCommandIds" in patch) normalized.battleCommandIds = normalizeBattleCommandIds(patch.battleCommandIds);
  if ("loadoutSlots" in patch) {
    const loadoutSlots = normalizeLoadoutSlots(patch.loadoutSlots);
    if (loadoutSlots === undefined) normalized.loadoutSlots = undefined;
    else normalized.loadoutSlots = loadoutSlots;
  }
  return normalized;
}

/** Keeps 0 as explicit value when authored; omits undefined for compact legacy shape. */
function normalizeOptionalSheetIndex(value: number | undefined, max: number): number | undefined {
  if (value === undefined || value === null || !Number.isFinite(value)) return undefined;
  const clamped = Math.min(max, Math.max(0, Math.trunc(value)));
  return clamped === 0 ? undefined : clamped;
}

function normalizeCritical(critical: Partial<ActorCritical> | undefined): ActorCritical {
  return {
    enabled: critical?.enabled ?? true,
    chanceDenominator: clampInteger(critical?.chanceDenominator ?? 30, 1, 100),
  };
}

function normalizeExpCurve(expCurve: Partial<ActorExperienceCurve> | undefined): ActorExperienceCurve {
  return {
    base: clampInteger(expCurve?.base ?? 1, 0, 999999),
    extra: clampInteger(expCurve?.extra ?? 677, 0, 999999),
    acceleration: clampInteger(expCurve?.acceleration ?? 40, 0, 999999),
  };
}

function normalizeInitialEquipment(equipment: Partial<ActorInitialEquipment> | undefined): ActorInitialEquipment {
  return {
    ...Object.fromEntries(Object.entries(equipment ?? {}).map(([slot, id]) => [slot, cleanOptionalId(id)])),
  };
}

const ACTOR_AUTO_TACTICS: readonly string[] = ["attackAll", "healFirst", "conserveMp", "followOrders"];

function normalizeOptions(options: Partial<ActorOptions> | undefined): ActorOptions {
  return {
    dualWield: options?.dualWield ?? false,
    autoBattle: options?.autoBattle ?? false,
    fixedEquipment: options?.fixedEquipment ?? false,
    mightyGuard: options?.mightyGuard ?? false,
    // 작전은 알려진 값만 남긴다 — 생략이면 기존 자동 전투(균형)와 같다.
    ...(typeof options?.autoTactic === "string" && ACTOR_AUTO_TACTICS.includes(options.autoTactic) ? { autoTactic: options.autoTactic } : {}),
  };
}

function normalizeLearnedSkills(
  learnedSkills: readonly Partial<ActorLearnedSkill>[] | undefined,
  skillIds: readonly SkillId[] = []
): ActorLearnedSkill[] {
  const source = learnedSkills ?? skillIds.map((skillId) => ({ level: ACTOR_LEVEL_MIN, skillId }));
  return source
    .filter((entry): entry is ActorLearnedSkill => typeof entry.skillId === "string" && entry.skillId.length > 0)
    // tp(기술 포인트 문턱)는 양수일 때만 남긴다 — 없는 옛 레코드는 레벨 습득 그대로.
    .map((entry) => ({
      level: clampLevel(entry.level ?? ACTOR_LEVEL_MIN),
      skillId: entry.skillId,
      ...(typeof entry.tp === "number" && Number.isFinite(entry.tp) && entry.tp > 0 ? { tp: clampInteger(entry.tp, 1, 999999) } : {}),
    }))
    .sort((left, right) => left.level - right.level || left.skillId.localeCompare(right.skillId));
}

function normalizeParameterCurves(curves: Partial<ActorParameterCurves> | undefined): ActorParameterCurves {
  return {
    maxHp: normalizeCurve("maxHp", curves?.maxHp),
    maxMp: normalizeCurve("maxMp", curves?.maxMp),
    attack: normalizeCurve("attack", curves?.attack),
    defense: normalizeCurve("defense", curves?.defense),
    mind: normalizeCurve("mind", curves?.mind),
    agility: normalizeCurve("agility", curves?.agility),
  };
}

function normalizeCurve(key: ActorParameterKey, curve: readonly number[] | undefined): number[] {
  if (curve && curve.length >= ACTOR_LEVEL_MAX) {
    return curve.slice(0, ACTOR_LEVEL_MAX).map((value) => clampInteger(value, 1, 99999));
  }
  const start = PARAMETER_LEVEL_ONE[key];
  const end = PARAMETER_LEVEL_NINETY_NINE[key];
  return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) => {
    const ratio = index / (ACTOR_LEVEL_MAX - 1);
    return Math.round(start + (end - start) * ratio * ratio);
  });
}

function defaultElementRates(overrides: Record<string, ActorRateGrade> | undefined): Record<string, ActorRateGrade> {
  const rates: Record<string, ActorRateGrade> = {};
  for (const element of DEFAULT_ELEMENT_RATE_LABELS) rates[element.id] = "C";
  return { ...rates, ...normalizeRates(overrides ?? {}) };
}

function normalizeRates(rates: Record<string, ActorRateGrade>): Record<string, ActorRateGrade> {
  const normalized: Record<string, ActorRateGrade> = {};
  for (const [id, grade] of Object.entries(rates)) normalized[id] = ACTOR_RATE_GRADES.includes(grade) ? grade : "C";
  return normalized;
}

function cleanOptionalId(value: string | undefined): string | undefined {
  return value && value.trim() ? value : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
