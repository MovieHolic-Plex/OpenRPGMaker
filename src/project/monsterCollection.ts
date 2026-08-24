import type { Rng } from "@/util/rng";
import { mulberry32 } from "@/util/rng";
import { ACTOR_LEVEL_MAX, totalExpForLevel } from "@/project/actorModel";
import type {
  ActorExperienceCurve,
  ActorLearnedSkill,
  EnemyRecord,
  EnemyStats,
  ItemRecord,
  ItemId,
  SkillId,
  MonsterSpeciesGraphic,
  MonsterSpeciesId,
  MonsterEvolutionRecord,
  MonsterEvolutionRequirement,
  MonsterSpeciesRecord,
  Project,
} from "@/project/types";
import type { MonsterCaughtAt, MonsterInstance, MonsterInstanceIvs, PlaySession } from "@/project/session";
import { syncMonsterPartyFollowers } from "@/project/followers";
import { transitionItemState } from "@/project/itemTransitions";

export const MONSTER_PARTY_MAX = 6;
export const MONSTER_SKILL_MAX = 4;

export type GiveMonsterInput = {
  readonly speciesId: MonsterSpeciesId;
  readonly level: number;
  readonly nickname?: string;
  readonly exp?: number;
  readonly ivs?: MonsterInstanceIvs;
  readonly friendship?: number;
  readonly caughtAt?: MonsterCaughtAt;
  readonly currentHp?: number;
  readonly stateIds?: readonly string[];
  readonly stateTurns?: Readonly<Record<string, number>>;
  readonly skillIds?: readonly SkillId[];
  readonly skillPp?: Readonly<Record<SkillId, number>>;
};

export type GiveMonsterResult =
  | { readonly ok: true; readonly instance: MonsterInstance; readonly location: "party" | "box" }
  | { readonly ok: false; readonly reason: "missingSpecies" };

export type MoveMonsterResult =
  | { readonly ok: true; readonly from: "party" | "box" | "none"; readonly to: "party" | "box" }
  | { readonly ok: false; readonly reason: "missingInstance" | "partyFull" };

export type EvolveMonsterInput = {
  readonly instanceId: string;
  readonly toSpeciesId?: MonsterSpeciesId;
  readonly allowItemEvolution?: boolean;
};

export type EvolveMonsterResult =
  | {
      readonly ok: true;
      readonly instance: MonsterInstance;
      readonly fromSpeciesId: MonsterSpeciesId;
      readonly toSpeciesId: MonsterSpeciesId;
      readonly consumedItemId?: ItemId;
      readonly learnedSkillIds: readonly SkillId[];
      readonly previousMaxHp: number;
      readonly nextMaxHp: number;
    }
  | {
      readonly ok: false;
      readonly reason: "missingInstance" | "missingSpecies" | "noEvolution" | "requirementsNotMet" | "missingItem";
      readonly instanceId: string;
      readonly toSpeciesId?: MonsterSpeciesId;
    };

export type MonsterExperienceResult = {
  readonly instanceId: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly learnedSkillIds: readonly SkillId[];
  readonly evolution?: EvolveMonsterResult;
};

export type MonsterSkillChoiceResult =
  | { readonly ok: true; readonly instance: MonsterInstance }
  | { readonly ok: false; readonly reason: "missingPendingSkill" | "missingActiveSkill" };

export const DEFAULT_MONSTER_EXP_CURVE: ActorExperienceCurve = { base: 30, extra: 20, acceleration: 30 };

// 0~255 스케일(포켓몬식)로 저작된 레거시 값을 0~1로 이관한다.
// 1을 넘는 값은 0~1 스케일에서 의미가 없으므로 100 분모 환산으로만 해석한다.
function normalizeCaptureRateScale(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.3;
  return value > 1 ? value / 100 : value;
}

export function normalizeMonsterSpeciesRecord(
  record: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">
): MonsterSpeciesRecord {
  const skillsByLevel = normalizeSkillsByLevel(record.skillsByLevel);
  const types = normalizeSpeciesTypes(record.types);
  const evolutions = normalizeEvolutions(record.evolutions);
  return {
    id: record.id,
    name: textOrDefault(record.name, "몬스터"),
    graphic: normalizeSpeciesGraphic(record.graphic),
    types: types.length > 0 ? types : undefined,
    baseStats: normalizeSpeciesStats(record.baseStats),
    expCurve: normalizeExpCurve(record.expCurve),
    captureRate: clampNumber(normalizeCaptureRateScale(record.captureRate), 0, 1),
    skillsByLevel: skillsByLevel.length > 0 ? skillsByLevel : undefined,
    evolutions: evolutions.length > 0 ? evolutions : undefined,
  };
}

export type CaptureModel = "rm2k3" | "gen1";

export type CaptureRateOptions = {
  /** 전투 규칙 엔진. 생략/rm2k3 = 기존 공식 그대로(레거시 프로젝트 무변경). */
  readonly model?: CaptureModel;
  /** 상태이상 보너스(수면/빙결 ×2, 독/화상/마비 ×1.5). gen1 에서만 곱한다. */
  readonly statusMultiplier?: number;
};

export function captureSuccessRate(
  captureRate: number,
  currentHp: number,
  maxHp: number,
  itemMultiplier = 1,
  options?: CaptureRateOptions
): number {
  const hpRatio = maxHp > 0 ? clampNumber(currentHp / maxHp, 0, 1) : 1;
  if (options?.model === "gen1") {
    // Gen1 계열 HP 항: (3M - 2H) / 3M — 만HP 1/3, 빈사 ≈1. captureRate 는 0~1 저장
    // 도메인을 유지한다: 원전의 rate255/255 가 곱으로만 쓰여 255 가 약분되므로
    // 스케일 전환(0~255)은 표기 이득뿐이고, 과거 스케일 사고(repair-capture-rate-
    // residue.mts)를 반복할 이유가 없다. 원전과의 차이는 문서화한다 — 진짜 Gen1 은
    // 볼 판정→4회 흔들림의 2단계 롤이고 여기는 단발 확률로 접는다(흔들림 연출은
    // 별도 단계에서 이 확률을 재해석해 얹는다).
    const hpTerm = (3 - 2 * hpRatio) / 3;
    const status = options.statusMultiplier ?? 1;
    return clampNumber(captureRate * hpTerm * itemMultiplier * status, 0, 1);
  }
  return clampNumber(captureRate * (1 - hpRatio * 0.7) * itemMultiplier, 0, 1);
}

/**
 * 포획 상태 보너스. Gen1 관례: 수면·빙결 ×2, 독·화상·마비 ×1.5, 복수 상태면 최대값
 * 하나만(곱하지 않는다). 판별자는 stateId 부분 문자열 — StateRecord 에 종류 필드가
 * 없어 기존 관례(battleStates.ts 의 id 하드코딩, battleFieldDom.stateIconToken)를 따른다.
 */
export function captureStatusMultiplier(stateIds: readonly string[]): number {
  let best = 1;
  for (const stateId of stateIds) {
    if (stateId.includes("sleep") || stateId.includes("freeze")) best = Math.max(best, 2);
    else if (stateId.includes("poison") || stateId.includes("burn") || stateId.includes("paraly")) best = Math.max(best, 1.5);
  }
  return best;
}

export function captureItemMultiplier(item: ItemRecord | undefined): number {
  const multiplier = item?.captureProfile?.multiplier;
  return typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function rollMonsterIvs(rng: Rng): MonsterInstanceIvs {
  return {
    hp: rollIv(rng),
    atk: rollIv(rng),
    def: rollIv(rng),
    spd: rollIv(rng),
  };
}

export function deterministicMonsterIvs(seed: string | number): MonsterInstanceIvs {
  return rollMonsterIvs(mulberry32(typeof seed === "number" ? seed : hashString(seed)));
}

export function monsterSpeciesForEnemy(project: Project, enemy: EnemyRecord | undefined): MonsterSpeciesRecord | undefined {
  if (!enemy) return undefined;
  const species = project.database.monsterSpecies ?? [];
  if (enemy.speciesId) return species.find((record) => record.id === enemy.speciesId);
  return species.find((record) => record.id === enemy.id);
}

export function monsterSpeciesById(project: Project, speciesId: MonsterSpeciesId): MonsterSpeciesRecord | undefined {
  return (project.database.monsterSpecies ?? []).find((record) => record.id === speciesId);
}

export function giveMonster(project: Project, session: PlaySession, input: GiveMonsterInput): GiveMonsterResult {
  ensureMonsterSessionFields(session);
  const species = monsterSpeciesById(project, input.speciesId);
  if (!species) return { ok: false, reason: "missingSpecies" };
  const instanceId = nextMonsterInstanceId(session);
  const instance: MonsterInstance = {
    instanceId,
    speciesId: species.id,
    nickname: cleanOptionalText(input.nickname),
    level: clampInteger(input.level, 1, 99),
    exp: Math.max(0, Math.trunc(input.exp ?? 0)),
    ivs: input.ivs ?? deterministicMonsterIvs(`${session.rng?.seed ?? 1}:${instanceId}:${species.id}`),
    friendship: clampInteger(input.friendship ?? 70, 0, 255),
    caughtAt: input.caughtAt ?? { mapId: session.currentMapId, x: session.x, y: session.y },
    currentHp: input.currentHp,
    stateIds: input.stateIds ? [...input.stateIds] : undefined,
    stateTurns: input.stateTurns ? { ...input.stateTurns } : undefined,
    skillIds: input.skillIds ? [...input.skillIds] : undefined,
    skillPp: input.skillPp ? { ...input.skillPp } : undefined,
  };
  const maxHp = monsterMaxHpFor(project, species, instance);
  const hydrated = normalizeMonsterInstanceBattleState(project, {
    ...instance,
    currentHp: input.currentHp ?? maxHp,
  });
  session.monsterInstances[instanceId] = hydrated;
  if (session.monsterParty.length < MONSTER_PARTY_MAX) {
    session.monsterParty.push(instanceId);
    syncMonsterPartyFollowers(project, session);
    return { ok: true, instance: hydrated, location: "party" };
  }
  session.monsterBox.push(instanceId);
  return { ok: true, instance: hydrated, location: "box" };
}

export function moveMonster(
  session: PlaySession,
  instanceId: string,
  to: "party" | "box",
  project?: Project
): MoveMonsterResult {
  ensureMonsterSessionFields(session);
  if (!session.monsterInstances[instanceId]) return { ok: false, reason: "missingInstance" };
  const from: "party" | "box" | "none" = session.monsterParty.includes(instanceId)
    ? "party"
    : session.monsterBox.includes(instanceId)
      ? "box"
      : "none";
  if (to === "party" && from !== "party" && session.monsterParty.length >= MONSTER_PARTY_MAX) {
    return { ok: false, reason: "partyFull" };
  }
  session.monsterParty = session.monsterParty.filter((id) => id !== instanceId);
  session.monsterBox = session.monsterBox.filter((id) => id !== instanceId);
  if (to === "party") session.monsterParty.push(instanceId);
  else session.monsterBox.push(instanceId);
  if (project) syncMonsterPartyFollowers(project, session);
  return { ok: true, from, to };
}

export function monsterDisplayName(project: Project, instance: MonsterInstance | undefined): string {
  if (!instance) return "몬스터";
  if (instance.nickname) return instance.nickname;
  return monsterSpeciesById(project, instance.speciesId)?.name ?? instance.speciesId;
}

export function monsterMaxHp(project: Project, instance: MonsterInstance | undefined): number {
  if (!instance) return 1;
  const species = monsterSpeciesById(project, instance.speciesId);
  return monsterMaxHpFor(project, species, instance);
}

export function monsterCurrentHp(project: Project, instance: MonsterInstance | undefined): number {
  if (!instance) return 0;
  return clampInteger(instance.currentHp ?? monsterMaxHp(project, instance), 0, monsterMaxHp(project, instance));
}

export function monsterSkillIds(project: Project, instance: MonsterInstance | undefined): SkillId[] {
  if (!instance) return [];
  const species = monsterSpeciesById(project, instance.speciesId);
  if (instance.skillIds !== undefined) return uniqueSkillIds(instance.skillIds).slice(-MONSTER_SKILL_MAX);
  return species ? latestMonsterSkillIdsForSpecies(species, instance.level) : [];
}

/**
 * Hydrates optional legacy monster battle fields without mutating the source instance.
 * An authored empty skillIds list remains empty; only a missing list derives the latest four moves.
 */
export function normalizeMonsterInstanceBattleState(project: Project, instance: MonsterInstance): MonsterInstance {
  const skillIds = monsterSkillIds(project, instance);
  const pendingSkillIds = uniqueSkillIds(instance.pendingSkillIds ?? []).filter((skillId) => !skillIds.includes(skillId));
  const skillPp = normalizedMonsterSkillPp(project, skillIds, instance.skillPp);
  return {
    ...instance,
    currentHp: instance.currentHp === undefined ? undefined : monsterCurrentHp(project, instance),
    skillIds: instance.skillIds !== undefined || skillIds.length > 0 ? skillIds : undefined,
    skillPp: Object.keys(skillPp).length > 0 ? skillPp : undefined,
    pendingSkillIds: pendingSkillIds.length > 0 ? pendingSkillIds : undefined,
  };
}

/** Returns a fully-restored copy for Pokemon-center/recover-all paths. */
export function recoverMonsterInstance(project: Project, instance: MonsterInstance): MonsterInstance {
  const normalized = normalizeMonsterInstanceBattleState(project, instance);
  return {
    ...normalized,
    currentHp: monsterMaxHp(project, normalized),
    stateIds: [],
    stateTurns: {},
    skillPp: fullMonsterSkillPp(project, normalized.skillIds ?? []),
  };
}

export type Gen1FieldPoisonStepResult = {
  readonly ticked: boolean;
  readonly damagedInstanceIds: readonly string[];
};

/** Applies the Red/Blue field rule after one completed player step. */
export function applyGen1FieldPoisonStep(project: Project, session: PlaySession): Gen1FieldPoisonStepResult {
  const monsterPartyMode = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true;
  if (!monsterPartyMode) return { ticked: false, damagedInstanceIds: [] };

  const poisonStateIds = new Set(
    project.database.states
      .filter((state) => state.gen1MajorStatus === "poison")
      .map((state) => state.id),
  );
  const poisonedParty = session.monsterParty.flatMap((instanceId) => {
    const instance = session.monsterInstances[instanceId];
    if (!instance || !(instance.stateIds ?? []).some((stateId) => poisonStateIds.has(stateId))) return [];
    return [{ instanceId, instance }];
  });
  if (poisonedParty.length === 0) {
    session.monsterFieldPoisonSteps = 0;
    return { ticked: false, damagedInstanceIds: [] };
  }

  const nextStep = (Math.max(0, Math.trunc(session.monsterFieldPoisonSteps ?? 0)) + 1) % 4;
  session.monsterFieldPoisonSteps = nextStep;
  if (nextStep !== 0) return { ticked: false, damagedInstanceIds: [] };

  const damagedInstanceIds: string[] = [];
  for (const { instanceId, instance } of poisonedParty) {
    const currentHp = monsterCurrentHp(project, instance);
    if (currentHp <= 1) continue;
    session.monsterInstances[instanceId] = { ...instance, currentHp: currentHp - 1 };
    damagedInstanceIds.push(instanceId);
  }
  return { ticked: true, damagedInstanceIds };
}

export function replacePendingMonsterSkill(
  project: Project,
  instance: MonsterInstance,
  pendingSkillId: SkillId,
  replacedSkillId: SkillId,
): MonsterSkillChoiceResult {
  const normalized = normalizeMonsterInstanceBattleState(project, instance);
  if (!(normalized.pendingSkillIds ?? []).includes(pendingSkillId)) {
    return { ok: false, reason: "missingPendingSkill" };
  }
  const skillIds = [...(normalized.skillIds ?? [])];
  const replaceIndex = skillIds.indexOf(replacedSkillId);
  if (replaceIndex < 0) return { ok: false, reason: "missingActiveSkill" };
  skillIds[replaceIndex] = pendingSkillId;
  const previousPp = { ...(normalized.skillPp ?? {}) };
  delete previousPp[replacedSkillId];
  delete previousPp[pendingSkillId];
  const next: MonsterInstance = {
    ...normalized,
    skillIds,
    pendingSkillIds: normalized.pendingSkillIds?.filter((skillId) => skillId !== pendingSkillId),
    skillPp: previousPp,
  };
  return { ok: true, instance: normalizeMonsterInstanceBattleState(project, next) };
}

export function rejectPendingMonsterSkill(
  instance: MonsterInstance,
  pendingSkillId: SkillId,
): MonsterSkillChoiceResult {
  if (!(instance.pendingSkillIds ?? []).includes(pendingSkillId)) {
    return { ok: false, reason: "missingPendingSkill" };
  }
  const pendingSkillIds = instance.pendingSkillIds?.filter((skillId) => skillId !== pendingSkillId) ?? [];
  return {
    ok: true,
    instance: {
      ...instance,
      pendingSkillIds: pendingSkillIds.length > 0 ? pendingSkillIds : undefined,
    },
  };
}

/**
 * 진화 그래프에서 사이클(A→B→A, 자기 진화 포함)에 속한 종족 id를 정렬해 반환한다.
 * 레벨업마다 evolveMonster 가 호출되므로 사이클은 두 종족을 무한 왕복시킨다.
 */
export function monsterEvolutionCycleSpeciesIds(species: readonly MonsterSpeciesRecord[]): string[] {
  const targets = new Map<string, readonly string[]>();
  for (const record of species) targets.set(record.id, (record.evolutions ?? []).map((entry) => entry.toSpeciesId));
  const state = new Map<string, "visiting" | "done">();
  const cycled = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string): void => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      // 스택에서 이 노드까지 되짚어 올라간 구간이 사이클이다.
      for (let index = stack.lastIndexOf(id); index >= 0 && index < stack.length; index += 1) {
        const member = stack[index];
        if (member) cycled.add(member);
      }
      return;
    }
    state.set(id, "visiting");
    stack.push(id);
    for (const target of targets.get(id) ?? []) {
      if (targets.has(target)) visit(target);
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const record of species) visit(record.id);
  return [...cycled].sort();
}

export function applyMonsterExperienceAndEvolution(
  project: Project,
  session: PlaySession,
  earnedExp: number,
  // 지정 시 이 인스턴스들에만 경험치를 준다(전투 참전 몬스터 한정). 미지정이면 파티 전원(기존 동작).
  participantInstanceIds?: readonly string[]
): MonsterExperienceResult[] {
  ensureMonsterSessionFields(session);
  const exp = Math.max(0, Math.trunc(earnedExp));
  if (exp <= 0) return [];
  const eligible = participantInstanceIds ? new Set(participantInstanceIds) : null;
  const results: MonsterExperienceResult[] = [];
  for (const instanceId of session.monsterParty) {
    if (eligible && !eligible.has(instanceId)) continue;
    const rawBefore = session.monsterInstances[instanceId];
    const before = rawBefore ? normalizeMonsterInstanceBattleState(project, rawBefore) : undefined;
    if (!before) continue;
    const species = monsterSpeciesById(project, before.speciesId);
    if (!species) continue;
    const fromLevel = before.level;
    const nextExp = Math.max(0, Math.trunc(before.exp ?? 0)) + exp;
    const toLevel = monsterLevelForExp(species, fromLevel, nextExp);
    const learned = newSkillsForLevelRange(
      species,
      fromLevel,
      toLevel,
      [...(before.skillIds ?? []), ...(before.pendingSkillIds ?? [])],
    );
    session.monsterInstances[instanceId] = applyLearnedMonsterSkills(project, {
      ...before,
      exp: nextExp,
      level: toLevel,
      currentHp: monsterCurrentHp(project, before),
    }, learned);
    const evolution = toLevel > fromLevel ? evolveMonster(project, session, { instanceId, allowItemEvolution: false }) : undefined;
    results.push({ instanceId, fromLevel, toLevel, learnedSkillIds: learned, evolution });
  }
  return results;
}

export type MonsterLevelUpPreview = {
  readonly instanceId: string;
  readonly name: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly learnedSkillIds: readonly SkillId[];
};

// 승리 exp 를 적용하면 발생할 몬스터 레벨업을 계산만 한다(세션 변경 없음).
// 결과 화면 표시용이며, 실제 적립은 applyMonsterExperienceAndEvolution 이 담당한다 —
// 둘이 같은 헬퍼(monsterLevelForExp/newSkillsForLevelRange)를 쓰므로 수치가 일치한다.
// 액터와 달리 몬스터는 expForRewardActor 보정 없이 획득 exp 를 그대로 받는다(적립 경로와 동일).
// 진화는 세션 인벤토리를 읽는 selectEvolution 이 필요해 여기서 다루지 않는다.
export function previewMonsterExperience(
  project: Project,
  instances: readonly MonsterInstance[],
  earnedExp: number,
  participantInstanceIds?: readonly string[]
): MonsterLevelUpPreview[] {
  const exp = Math.max(0, Math.trunc(earnedExp));
  if (exp <= 0) return [];
  const eligible = participantInstanceIds ? new Set(participantInstanceIds) : null;
  const results: MonsterLevelUpPreview[] = [];
  for (const instance of instances) {
    if (eligible && !eligible.has(instance.instanceId)) continue;
    const species = monsterSpeciesById(project, instance.speciesId);
    if (!species) continue;
    const fromLevel = instance.level;
    const toLevel = monsterLevelForExp(species, fromLevel, Math.max(0, Math.trunc(instance.exp ?? 0)) + exp);
    if (toLevel <= fromLevel) continue;
    results.push({
      instanceId: instance.instanceId,
      name: monsterDisplayName(project, instance),
      fromLevel,
      toLevel,
      learnedSkillIds: newSkillsForLevelRange(
        species,
        fromLevel,
        toLevel,
        [...monsterSkillIds(project, instance), ...(instance.pendingSkillIds ?? [])],
      ),
    });
  }
  return results;
}

export function evolveMonster(project: Project, session: PlaySession, input: EvolveMonsterInput): EvolveMonsterResult {
  ensureMonsterSessionFields(session);
  const rawInstance = session.monsterInstances[input.instanceId];
  const instance = rawInstance ? normalizeMonsterInstanceBattleState(project, rawInstance) : undefined;
  if (!instance) return { ok: false, reason: "missingInstance", instanceId: input.instanceId, toSpeciesId: input.toSpeciesId };
  const fromSpecies = monsterSpeciesById(project, instance.speciesId);
  if (!fromSpecies) return { ok: false, reason: "missingSpecies", instanceId: input.instanceId, toSpeciesId: input.toSpeciesId };
  const evolution = selectEvolution(project, session, instance, fromSpecies, input);
  if (!evolution) {
    const hasTarget = input.toSpeciesId
      ? (fromSpecies.evolutions ?? []).some((entry) => entry.toSpeciesId === input.toSpeciesId)
      : (fromSpecies.evolutions ?? []).length > 0;
    const missingItem = failedOnlyBecauseOfMissingItem(session, instance, fromSpecies, input);
    return { ok: false, reason: missingItem ? "missingItem" : hasTarget ? "requirementsNotMet" : "noEvolution", instanceId: input.instanceId, toSpeciesId: input.toSpeciesId };
  }
  const toSpecies = monsterSpeciesById(project, evolution.toSpeciesId);
  if (!toSpecies) return { ok: false, reason: "missingSpecies", instanceId: input.instanceId, toSpeciesId: evolution.toSpeciesId };
  const previousMaxHp = monsterMaxHpFor(project, fromSpecies, instance);
  const currentHp = monsterCurrentHp(project, instance);
  const hpRatio = previousMaxHp > 0 ? currentHp / previousMaxHp : 1;
  const nextMaxHp = monsterMaxHpFor(project, toSpecies, instance);
  const nextCurrentHp = currentHp <= 0 ? 0 : clampInteger(Math.round(nextMaxHp * hpRatio), 1, nextMaxHp);
  const learnedSkillIds = newSkillsForLevelRange(
    toSpecies,
    0,
    instance.level,
    [...(instance.skillIds ?? []), ...(instance.pendingSkillIds ?? [])],
  );
  const evolved = applyLearnedMonsterSkills(project, {
    ...instance,
    speciesId: toSpecies.id,
    currentHp: nextCurrentHp,
  }, learnedSkillIds);
  const consumedItemId = evolution.requires.itemId;
  const itemTransition = consumedItemId
    ? transitionItemState(session, project.database.items, { kind: "remove", itemId: consumedItemId, amount: 1 })
    : undefined;
  session.monsterInstances[input.instanceId] = evolved;
  if (itemTransition) {
    session.inventory = itemTransition.inventory;
    session.itemUseCharges = itemTransition.itemUseCharges;
  }
  return {
    ok: true,
    instance: evolved,
    fromSpeciesId: fromSpecies.id,
    toSpeciesId: toSpecies.id,
    consumedItemId,
    learnedSkillIds,
    previousMaxHp,
    nextMaxHp,
  };
}

export function ensureMonsterSessionFields(session: PlaySession): void {
  session.monsterInstances ??= {};
  session.monsterParty ??= [];
  session.monsterBox ??= [];
}

function nextMonsterInstanceId(session: PlaySession): string {
  let index = Object.keys(session.monsterInstances).length + 1;
  while (session.monsterInstances[`monster_${index}`]) index += 1;
  return `monster_${index}`;
}

function rollIv(rng: Rng): number {
  return clampInteger(Math.floor(rng() * 16), 0, 15);
}

function normalizeSpeciesGraphic(graphic: Partial<MonsterSpeciesGraphic> | undefined): MonsterSpeciesGraphic {
  return {
    monsterResourceId: cleanOptionalText(graphic?.monsterResourceId),
    fieldCharsetId: cleanOptionalText(graphic?.fieldCharsetId),
    fieldGraphic: graphic?.fieldGraphic?.sprite?.id ? graphic.fieldGraphic : undefined,
    graphicHue: clampInteger(graphic?.graphicHue ?? 0, 0, 360),
    transparent: graphic?.transparent === true,
    flying: graphic?.flying === true,
  };
}

function normalizeSpeciesStats(stats: Partial<EnemyStats> | undefined): EnemyStats {
  return {
    maxHp: clampInteger(stats?.maxHp ?? 10, 1, 99999),
    maxMp: clampInteger(stats?.maxMp ?? 0, 0, 9999),
    attack: clampInteger(stats?.attack ?? 10, 1, 999),
    defense: clampInteger(stats?.defense ?? 10, 1, 999),
    mind: clampInteger(stats?.mind ?? 10, 1, 999),
    agility: clampInteger(stats?.agility ?? 10, 1, 999),
  };
}

function normalizeSpeciesTypes(types: readonly string[] | undefined): string[] {
  return [...new Set((types ?? []).flatMap((type) => {
    const trimmed = type.trim();
    return trimmed ? [trimmed] : [];
  }))].slice(0, 2);
}

function normalizeEvolutions(evolutions: readonly Partial<MonsterEvolutionRecord>[] | undefined): MonsterEvolutionRecord[] {
  return (evolutions ?? [])
    .flatMap((evolution): MonsterEvolutionRecord[] => {
      const toSpeciesId = cleanOptionalText(evolution.toSpeciesId);
      if (!toSpeciesId) return [];
      return [{ toSpeciesId, requires: normalizeEvolutionRequirement(evolution.requires) }];
    })
    .sort((left, right) => left.toSpeciesId.localeCompare(right.toSpeciesId));
}

function normalizeEvolutionRequirement(requires: Partial<MonsterEvolutionRequirement> | undefined): MonsterEvolutionRequirement {
  return {
    level: typeof requires?.level === "number" ? clampInteger(requires.level, 1, ACTOR_LEVEL_MAX) : undefined,
    itemId: cleanOptionalText(requires?.itemId),
    friendshipAtLeast: typeof requires?.friendshipAtLeast === "number" ? clampInteger(requires.friendshipAtLeast, 0, 255) : undefined,
  };
}

function normalizeExpCurve(curve: Partial<ActorExperienceCurve> | undefined): ActorExperienceCurve | undefined {
  if (!curve) return undefined;
  return {
    base: clampInteger(curve.base ?? 30, 0, 99999),
    extra: clampInteger(curve.extra ?? 20, 0, 99999),
    acceleration: clampInteger(curve.acceleration ?? 30, 0, 999),
  };
}

function normalizeSkillsByLevel(skills: readonly Partial<ActorLearnedSkill>[] | undefined): ActorLearnedSkill[] {
  return (skills ?? [])
    .filter((skill): skill is ActorLearnedSkill => typeof skill.skillId === "string" && skill.skillId.length > 0)
    .map((skill) => ({ level: clampInteger(skill.level ?? 1, 1, 99), skillId: skill.skillId }))
    .sort((left, right) => left.level - right.level || left.skillId.localeCompare(right.skillId));
}

export interface MonsterBattleStats {
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attack: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
}

// 포켓몬 유사 스탯 공식(EV 없음, IV 0~15):
//   HP     = floor((2*base + iv) * level / 100) + level + 10
//   기타   = floor((2*base + iv) * level / 100) + 5
// MP는 원작에 대응이 없어 base를 레벨로 완만 스케일한다. mind는 IV가 없어 iv=0.
export function monsterBattleStatsForSpecies(
  species: MonsterSpeciesRecord | undefined,
  level: number,
  ivs: MonsterInstance["ivs"]
): MonsterBattleStats {
  const base = species?.baseStats;
  const lv = clampInteger(level, 1, ACTOR_LEVEL_MAX);
  const other = (statBase: number, iv: number): number =>
    Math.max(1, Math.floor((2 * statBase + iv) * lv / 100) + 5);
  const hp = Math.floor((2 * (base?.maxHp ?? 1) + (ivs?.hp ?? 0)) * lv / 100) + lv + 10;
  return {
    maxHp: Math.max(1, hp),
    maxMp: Math.max(0, Math.floor((base?.maxMp ?? 0) * (1 + lv / 50))),
    attack: other(base?.attack ?? 1, ivs?.atk ?? 0),
    defense: other(base?.defense ?? 1, ivs?.def ?? 0),
    mind: other(base?.mind ?? 1, 0),
    agility: other(base?.agility ?? 1, ivs?.spd ?? 0),
  };
}

/** 인스턴스의 전투 유효 스탯(종족+레벨+IV). 전투 배틀러 생성에 사용. */
export function monsterBattleStats(project: Project, instance: MonsterInstance): MonsterBattleStats {
  return monsterBattleStatsForSpecies(monsterSpeciesById(project, instance.speciesId), instance.level, instance.ivs);
}

/**
 * Compatibility helper for tests / tooling that want a single-stat scale probe.
 * Prefer monsterBattleStatsForSpecies for real combat stats.
 * Note: growthFactor is reserved for older linear probes; Pokemon-style formula ignores it.
 */
export function monsterStatAtLevel(base: number, iv: number, level: number, _growthFactor = 10): number {
  const lv = clampInteger(level, 1, ACTOR_LEVEL_MAX);
  // Mirror non-HP other-stat formula used by monsterBattleStatsForSpecies.
  return Math.max(1, Math.floor((2 * base + iv) * lv / 100) + 5);
}

function monsterMaxHpFor(_project: Project, species: MonsterSpeciesRecord | undefined, instance: MonsterInstance): number {
  return monsterBattleStatsForSpecies(species, instance.level, instance.ivs).maxHp;
}

function monsterSkillIdsForSpecies(species: MonsterSpeciesRecord, level: number): SkillId[] {
  return (species.skillsByLevel ?? [])
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.skillId);
}

function latestMonsterSkillIdsForSpecies(species: MonsterSpeciesRecord, level: number): SkillId[] {
  return uniqueSkillIds(monsterSkillIdsForSpecies(species, level)).slice(-MONSTER_SKILL_MAX);
}

function newSkillsForLevelRange(
  species: MonsterSpeciesRecord,
  fromLevel: number,
  toLevel: number,
  knownSkillIds: readonly SkillId[]
): SkillId[] {
  const known = new Set(knownSkillIds);
  return (species.skillsByLevel ?? [])
    .filter((entry) => entry.level > fromLevel && entry.level <= toLevel && !known.has(entry.skillId))
    .map((entry) => entry.skillId);
}

function uniqueSkillIds(skillIds: readonly SkillId[]): SkillId[] {
  const result: SkillId[] = [];
  for (const skillId of skillIds) {
    if (!result.includes(skillId)) result.push(skillId);
  }
  return result;
}

function applyLearnedMonsterSkills(
  project: Project,
  instance: MonsterInstance,
  learnedSkillIds: readonly SkillId[],
): MonsterInstance {
  const normalized = normalizeMonsterInstanceBattleState(project, instance);
  const skillIds = [...(normalized.skillIds ?? [])];
  const pendingSkillIds = [...(normalized.pendingSkillIds ?? [])];
  for (const skillId of uniqueSkillIds(learnedSkillIds)) {
    if (skillIds.includes(skillId) || pendingSkillIds.includes(skillId)) continue;
    if (skillIds.length < MONSTER_SKILL_MAX) skillIds.push(skillId);
    else pendingSkillIds.push(skillId);
  }
  return normalizeMonsterInstanceBattleState(project, {
    ...normalized,
    skillIds,
    pendingSkillIds,
  });
}

function normalizedMonsterSkillPp(
  project: Project,
  skillIds: readonly SkillId[],
  previous: Readonly<Record<SkillId, number>> | undefined,
): Record<SkillId, number> {
  const result: Record<SkillId, number> = {};
  for (const skillId of skillIds) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    if (skill?.maxPp === undefined) continue;
    const maxPp = Math.max(1, Math.trunc(skill.maxPp));
    const current = previous?.[skillId];
    result[skillId] = typeof current === "number" && Number.isFinite(current)
      ? Math.max(0, Math.min(maxPp, Math.trunc(current)))
      : maxPp;
  }
  return result;
}

function fullMonsterSkillPp(project: Project, skillIds: readonly SkillId[]): Record<SkillId, number> {
  const result: Record<SkillId, number> = {};
  for (const skillId of skillIds) {
    const maxPp = project.database.skills.find((record) => record.id === skillId)?.maxPp;
    if (maxPp !== undefined) result[skillId] = Math.max(1, Math.trunc(maxPp));
  }
  return result;
}

function monsterLevelForExp(species: MonsterSpeciesRecord, currentLevel: number, exp: number): number {
  const curve = species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  let level = clampInteger(currentLevel, 1, ACTOR_LEVEL_MAX);
  while (level < ACTOR_LEVEL_MAX && exp >= totalExpForLevel(curve, level + 1)) level += 1;
  return level;
}

function selectEvolution(
  project: Project,
  session: PlaySession,
  instance: MonsterInstance,
  species: MonsterSpeciesRecord,
  input: EvolveMonsterInput
): MonsterEvolutionRecord | undefined {
  const evolutions = (species.evolutions ?? [])
    .filter((evolution) => !input.toSpeciesId || evolution.toSpeciesId === input.toSpeciesId)
    .filter((evolution) => monsterSpeciesById(project, evolution.toSpeciesId));
  return evolutions.find((evolution) => evolutionRequirementMet(session, instance, evolution.requires, input.allowItemEvolution === true));
}

function evolutionRequirementMet(
  session: PlaySession,
  instance: MonsterInstance,
  requires: MonsterEvolutionRequirement,
  allowItemEvolution: boolean
): boolean {
  if (requires.level !== undefined && instance.level < requires.level) return false;
  if (requires.friendshipAtLeast !== undefined && instance.friendship < requires.friendshipAtLeast) return false;
  if (!requires.itemId) return true;
  if (!allowItemEvolution) return false;
  return (session.inventory[requires.itemId] ?? 0) > 0;
}

function failedOnlyBecauseOfMissingItem(
  session: PlaySession,
  instance: MonsterInstance,
  species: MonsterSpeciesRecord,
  input: EvolveMonsterInput
): boolean {
  if (input.allowItemEvolution !== true) return false;
  return (species.evolutions ?? [])
    .filter((evolution) => !input.toSpeciesId || evolution.toSpeciesId === input.toSpeciesId)
    .some((evolution) => {
      const requires = evolution.requires;
      if (!requires.itemId || (session.inventory[requires.itemId] ?? 0) > 0) return false;
      const { itemId: _itemId, ...withoutItem } = requires;
      return evolutionRequirementMet(session, instance, withoutItem, true);
    });
}

function textOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = cleanOptionalText(value);
  return trimmed ?? fallback;
}

function cleanOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 1;
}
