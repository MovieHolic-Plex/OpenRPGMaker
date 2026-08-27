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
  };
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
  if (patch.initialEquipment !== undefined) normalized.initialEquipment = normalizeInitialEquipment(patch.initialEquipment);
  if (patch.options !== undefined) normalized.options = normalizeOptions(patch.options);
  if (patch.learnedSkills !== undefined) normalized.learnedSkills = normalizeLearnedSkills(patch.learnedSkills);
  if (patch.stateRates !== undefined) normalized.stateRates = normalizeRates(patch.stateRates);
  if (patch.elementRates !== undefined) normalized.elementRates = defaultElementRates(patch.elementRates);
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
    weapon: cleanOptionalId(equipment?.weapon),
    shield: cleanOptionalId(equipment?.shield),
    armor: cleanOptionalId(equipment?.armor),
    helmet: cleanOptionalId(equipment?.helmet),
    accessory: cleanOptionalId(equipment?.accessory),
  };
}

function normalizeOptions(options: Partial<ActorOptions> | undefined): ActorOptions {
  return {
    dualWield: options?.dualWield ?? false,
    autoBattle: options?.autoBattle ?? false,
    fixedEquipment: options?.fixedEquipment ?? false,
    mightyGuard: options?.mightyGuard ?? false,
  };
}

function normalizeLearnedSkills(
  learnedSkills: readonly Partial<ActorLearnedSkill>[] | undefined,
  skillIds: readonly SkillId[] = []
): ActorLearnedSkill[] {
  const source = learnedSkills ?? skillIds.map((skillId) => ({ level: ACTOR_LEVEL_MIN, skillId }));
  return source
    .filter((entry): entry is ActorLearnedSkill => typeof entry.skillId === "string" && entry.skillId.length > 0)
    .map((entry) => ({ level: clampLevel(entry.level ?? ACTOR_LEVEL_MIN), skillId: entry.skillId }))
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
