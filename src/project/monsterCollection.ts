import { normalizeGenderRatio, rollMonsterIdentity } from "@/project/monsterIdentity";
import type { Rng } from "@/util/rng";
import { mulberry32 } from "@/util/rng";
import { ACTOR_LEVEL_MAX, totalExpForLevel } from "@/project/actorModel";
import { normalizeMonsterAbility } from "@/battle/abilities";
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
import type { MonsterCaughtAt, MonsterInstance, MonsterInstanceEvs, MonsterInstanceIvs, PlaySession } from "@/project/session";
import { clampMonsterEvs, monsterNatureById, monsterStatRulesOf, natureIdFromSeed, type MonsterNatureStat } from "@/project/monsterStatRules";
import { recordMonsterCaught } from "@/project/monsterJournal";
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
  /** 성격 id(monsterStatRules). system.monsterStatRules.natures 일 때만 쓰인다. */
  readonly nature?: string;
  readonly friendship?: number;
  readonly caughtAt?: MonsterCaughtAt;
  readonly currentHp?: number;
  readonly stateIds?: readonly string[];
  readonly stateTurns?: Readonly<Record<string, number>>;
  readonly skillIds?: readonly SkillId[];
  readonly skillPp?: Readonly<Record<SkillId, number>>;
  /** 포획에 쓴 볼(아이템 id). */
  readonly caughtBallId?: string;
  /** 직접 정할 때(이벤트·이관). 생략하면 종 genderRatio·system.shinyRate 로 개체 번호에서 정해진다. */
  readonly gender?: "male" | "female";
  readonly shiny?: boolean;
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
  /** 지정하면 이 아이템을 요구하는 진화 경로만 쓴다(진화의 돌 — 같은 종으로 가는 레벨 경로가 먼저 걸려 돌이 안 쓰이는 일을 막는다). */
  readonly itemId?: ItemId;
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
  | { readonly ok: false; readonly reason: "missingPendingSkill" | "missingActiveSkill" | "unforgettable" };

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
  const machineSkillIds = uniqueSkillIds((Array.isArray(record.machineSkillIds) ? record.machineSkillIds : []).filter((id): id is SkillId => typeof id === "string" && id.trim() !== "").map((id) => id.trim() as SkillId));
  const ability = normalizeMonsterAbility(record.ability);
  const evYield = normalizeEvYield(record.evYield);
  return {
    id: record.id,
    name: textOrDefault(record.name, "몬스터"),
    graphic: normalizeSpeciesGraphic(record.graphic),
    types: types.length > 0 ? types : undefined,
    baseStats: normalizeSpeciesStats(record.baseStats),
    expCurve: normalizeExpCurve(record.expCurve),
    captureRate: clampNumber(normalizeCaptureRateScale(record.captureRate), 0, 1),
    skillsByLevel: skillsByLevel.length > 0 ? skillsByLevel : undefined,
    machineSkillIds: machineSkillIds.length > 0 ? machineSkillIds : undefined,
    evolutions: evolutions.length > 0 ? evolutions : undefined,
    ...(ability ? { ability } : {}),
    ...(evYield ? { evYield } : {}),
    ...(typeof record.dexNote === "string" && record.dexNote.trim() ? { dexNote: record.dexNote.trim().slice(0, 200) } : {}),
    ...(normalizeGenderRatio(record.genderRatio) !== undefined ? { genderRatio: normalizeGenderRatio(record.genderRatio) } : {}),
  };
}

/** 종목당 0~3, 합계 3 이하로 자른다. 전부 0 이면 필드를 두지 않는다(저장 바이트 그대로). */
function normalizeEvYield(value: MonsterSpeciesRecord["evYield"]): MonsterSpeciesRecord["evYield"] {
  if (!value || typeof value !== "object") return undefined;
  const out: { hp?: number; atk?: number; def?: number; spd?: number } = {};
  let left = 3;
  for (const key of ["hp", "atk", "def", "spd"] as const) {
    const raw = value[key];
    const amount = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(3, Math.trunc(raw), left)) : 0;
    if (amount > 0) { out[key] = amount; left -= amount; }
  }
  return Object.keys(out).length > 0 ? out : undefined;
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

function identityOf(project: Project, species: MonsterSpeciesRecord, input: GiveMonsterInput, seedKey: string): { gender?: "male" | "female"; shiny?: true } {
  const rolled = rollMonsterIdentity(project, species, seedKey);
  const gender = input.gender ?? rolled.gender;
  const shiny = input.shiny ?? rolled.shiny === true;
  return { ...(gender ? { gender } : {}), ...(shiny ? { shiny: true as const } : {}) };
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

/**
 * 몬스터로 싸우는 게임인가 — 포획이 켜진 수집 게임이거나, 포획 없이 몬스터 파티로만 싸우는 게임(대회형).
 * 포획(`monsterCollection`)과 파티 전투(`monsterBattleParty`/`battleParty:"monsters"`)는 별개 축이라, 둘 중 하나면 몬스터 게임이다.
 * QA 자동 플레이어의 몬스터 전술·수련·회복은 이 판정을 쓴다(포획 켜짐만 보면 대회형 게임이 영웅 혼자 싸우는 경로로 간다).
 */
export function isMonsterPartyGame(project: Pick<Project, "system">): boolean {
  const system = project.system;
  return system?.monsterCollection === true || system?.monsterBattleParty === true || system?.battleParty === "monsters";
}

/** 포획 없음을 명시한 몬스터 게임(`monsterCollection:false` + 몬스터 파티 전투). 「포획을 켜는 걸 잊음」(undefined)과 다르다. */
export function isMonsterNoCaptureGame(project: Pick<Project, "system">): boolean {
  const system = project.system;
  return system?.monsterCollection === false && (system.monsterBattleParty === true || system.battleParty === "monsters");
}

/**
 * 몬스터 파티 전투 설정과 지금 파티 몬스터 — 실제 전투(playSceneBattle)·헤드리스 러너·랜덤 조우가 같은 판정을 쓴다.
 * requested 인데 party 가 비면(스타터를 아직 안 받음) 전투를 열 수 없다.
 */
export function monsterBattlePartyOf(project: Project, session: Pick<PlaySession, "monsterParty" | "monsterInstances">): { requested: boolean; party: MonsterInstance[] } {
  const requested = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true;
  const party = requested
    ? (session.monsterParty ?? []).flatMap((instanceId) => {
        const instance = session.monsterInstances?.[instanceId];
        return instance ? [instance] : [];
      })
    : [];
  return { requested, party };
}

export function monsterSpeciesById(project: Project, speciesId: MonsterSpeciesId): MonsterSpeciesRecord | undefined {
  return (project.database.monsterSpecies ?? []).find((record) => record.id === speciesId);
}

export function giveMonster(project: Project, session: PlaySession, input: GiveMonsterInput): GiveMonsterResult {
  ensureMonsterSessionFields(session);
  const species = monsterSpeciesById(project, input.speciesId);
  if (!species) return { ok: false, reason: "missingSpecies" };
  const instanceId = nextMonsterInstanceId(session);
  const level = clampInteger(input.level, 1, 99);
  const instance: MonsterInstance = {
    instanceId,
    speciesId: species.id,
    nickname: cleanOptionalText(input.nickname),
    level,
    // Experience is cumulative. Captures/gifts without an explicit value start
    // at their level's floor; explicit values (including zero) remain authored.
    exp: Math.max(0, Math.trunc(input.exp ?? totalExpForLevel(species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE, level))),
    ivs: input.ivs ?? deterministicMonsterIvs(`${session.rng?.seed ?? 1}:${instanceId}:${species.id}`),
    // 성격(옵트인): 인스턴스 id 가 같으면 같은 성격. 규칙이 꺼진 프로젝트는 필드를 두지 않는다(저장 바이트 그대로).
    ...(monsterStatRulesOf(project).natures ? { nature: monsterNatureById(input.nature) ? input.nature : natureIdFromSeed(`${session.rng?.seed ?? 1}:${instanceId}:${species.id}:nature`) } : {}),
    friendship: clampInteger(input.friendship ?? 70, 0, 255),
    caughtAt: input.caughtAt ?? { mapId: session.currentMapId, x: session.x, y: session.y },
    currentHp: input.currentHp,
    stateIds: input.stateIds ? [...input.stateIds] : undefined,
    stateTurns: input.stateTurns ? { ...input.stateTurns } : undefined,
    skillIds: input.skillIds ? [...input.skillIds] : undefined,
    skillPp: input.skillPp ? { ...input.skillPp } : undefined,
    ...(input.caughtBallId ? { caughtBallId: input.caughtBallId } : {}),
    ...identityOf(project, species, input, `${session.rng?.seed ?? 1}:${instanceId}:${species.id}`),
  };
  const maxHp = monsterMaxHpFor(project, species, instance);
  const hydrated = normalizeMonsterInstanceBattleState(project, {
    ...instance,
    currentHp: input.currentHp ?? maxHp,
  });
  session.monsterInstances[instanceId] = hydrated;
  recordMonsterCaught(project, session, species.id);
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

export type SwapMonsterPartyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "notInParty" | "same" };

/** 파티 안의 두 몬스터 자리를 맞바꾼다(맨 앞 = 먼저 출전하는 선두). 박스 몬스터·같은 몬스터는 거절한다. */
export function swapMonsterPartyOrder(session: PlaySession, aId: string, bId: string, project?: Project): SwapMonsterPartyResult {
  ensureMonsterSessionFields(session);
  if (aId === bId) return { ok: false, reason: "same" };
  const a = session.monsterParty.indexOf(aId), b = session.monsterParty.indexOf(bId);
  if (a < 0 || b < 0) return { ok: false, reason: "notInParty" };
  const next = [...session.monsterParty];
  next[a] = bId;
  next[b] = aId;
  session.monsterParty = next;
  if (project) syncMonsterPartyFollowers(project, session);
  return { ok: true };
}

export function monsterDisplayName(project: Project, instance: MonsterInstance | undefined): string {
  if (!instance) return "몬스터";
  if (instance.nickname) return instance.nickname;
  return monsterSpeciesById(project, instance.speciesId)?.name ?? instance.speciesId;
}

/** 적 이름에 저자가 먼저 붙여 둔 「야생」/「야생의」 접두를 떼어 낸다.
 *  전투 인트로·3세대 호칭은 접두를 문장이 직접 붙이므로, 이름에 이미 있으면
 *  「야생의 야생 슬라임이 나타났다!」·「야생 야생 슬라임」으로 두 번 읽혔다.
 *  접두 뒤 공백을 요구하므로 「야생화 꿀」처럼 접두가 아닌 낱말은 그대로다. */
export function stripWildNamePrefix(name: string): string {
  return name.replace(/^야생(?:의)?\s+/u, "") || name;
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
      .filter((state) => state.gen1MajorStatus === "poison" || state.gen1MajorStatus === "toxic")
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
  // 비전머신 기술은 잊을 수 없다 — 메뉴가 후보에서 빼지만 이 경로를 직접 부르는 이벤트·도구도 막는다.
  if (project.database.skills.find((skill) => skill.id === replacedSkillId)?.unforgettable === true) return { ok: false, reason: "unforgettable" };
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

export type TeachMonsterSkillResult =
  | { readonly ok: true; readonly instance: MonsterInstance; readonly outcome: "learned" | "pending" }
  | { readonly ok: false; readonly reason: "missingSpecies" | "unknownSkill" | "alreadyKnown" | "incompatible" };

/** 이 종이 기술머신으로 이 기술을 배울 수 있는가 — species.machineSkillIds 가 비어 있으면 제한 없음(기존 동작). */
export function monsterCanLearnMachineSkill(project: Project, instance: MonsterInstance, skillId: SkillId): boolean {
  const species = monsterSpeciesById(project, instance.speciesId);
  if (!species) return false;
  const allowed = species.machineSkillIds ?? [];
  return allowed.length === 0 || allowed.includes(skillId);
}

/**
 * 기술머신·비전머신으로 몬스터에게 기술을 가르친다. 칸(MONSTER_SKILL_MAX)이 남으면 바로 익히고, 가득 찼으면 레벨업 때와 같이
 * pendingSkillIds 로 두어 메뉴의 「기술 교체」에서 고르게 한다(잊을 수 없는 기술은 그 후보에서 빠진다).
 */
export function teachMonsterSkill(project: Project, instance: MonsterInstance, skillId: SkillId): TeachMonsterSkillResult {
  if (!monsterSpeciesById(project, instance.speciesId)) return { ok: false, reason: "missingSpecies" };
  if (!project.database.skills.some((skill) => skill.id === skillId)) return { ok: false, reason: "unknownSkill" };
  const normalized = normalizeMonsterInstanceBattleState(project, instance);
  if ((normalized.skillIds ?? []).includes(skillId) || (normalized.pendingSkillIds ?? []).includes(skillId)) return { ok: false, reason: "alreadyKnown" };
  if (!monsterCanLearnMachineSkill(project, instance, skillId)) return { ok: false, reason: "incompatible" };
  const next = applyLearnedMonsterSkills(project, normalized, [skillId]);
  return { ok: true, instance: next, outcome: (next.skillIds ?? []).includes(skillId) ? "learned" : "pending" };
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

/** 레벨업 뒤 자동 진화(아이템 없는 조건)가 일어날지 미리 본다 — 세션은 바꾸지 않는다. 진화 장면이 보상 반영 전에 돌 수 있게 한다. */
export function previewMonsterEvolution(
  project: Project,
  session: PlaySession,
  instanceId: string,
  atLevel: number,
): { readonly name: string; readonly fromSpeciesId: MonsterSpeciesId; readonly toSpeciesId: MonsterSpeciesId } | undefined {
  const raw = session.monsterInstances[instanceId];
  const instance = raw ? normalizeMonsterInstanceBattleState(project, raw) : undefined;
  const species = instance ? monsterSpeciesById(project, instance.speciesId) : undefined;
  if (!instance || !species) return undefined;
  const evolution = selectEvolution(project, session, { ...instance, level: atLevel }, species, { instanceId, allowItemEvolution: false });
  return evolution ? { name: monsterDisplayName(project, instance), fromSpeciesId: species.id, toSpeciesId: evolution.toSpeciesId } : undefined;
}

/** 이 아이템(진화의 돌 등)이 어떤 종의 진화 조건에 쓰이는가. */
export function isEvolutionItemId(project: Project, itemId: ItemId): boolean {
  return (project.database.monsterSpecies ?? []).some((species) => (species.evolutions ?? []).some((evolution) => evolution.requires.itemId === itemId));
}

/** 이 개체에게 이 아이템을 쓰면 진화하는가(읽기 전용). 레벨·친밀도 조건은 그대로 따진다. 아이템 보유 여부는 보지 않는다. 개체가 없으면 undefined. */
export function previewMonsterItemEvolution(
  project: Project,
  session: PlaySession,
  instanceId: string,
  itemId: ItemId,
): { readonly name: string; readonly fromSpeciesId: MonsterSpeciesId; readonly toSpeciesId?: MonsterSpeciesId; readonly reason?: string } | undefined {
  const raw = session.monsterInstances[instanceId];
  const instance = raw ? normalizeMonsterInstanceBattleState(project, raw) : undefined;
  const species = instance ? monsterSpeciesById(project, instance.speciesId) : undefined;
  if (!instance || !species) return undefined;
  const name = monsterDisplayName(project, instance);
  const paths = (species.evolutions ?? []).filter((evolution) => evolution.requires.itemId === itemId && monsterSpeciesById(project, evolution.toSpeciesId));
  if (paths.length === 0) return { name, fromSpeciesId: species.id, reason: "효과가 없습니다" };
  const met = paths.find((evolution) => evolutionRequirementMet(session, instance, evolution.requires, true));
  if (met) return { name, fromSpeciesId: species.id, toSpeciesId: met.toSpeciesId };
  const need = paths[0]!.requires;
  const reason = need.level !== undefined && instance.level < need.level ? `Lv.${need.level} 이상이어야 진화합니다` : "아직 진화할 준비가 되지 않았습니다";
  return { name, fromSpeciesId: species.id, reason };
}

/** 이 레벨이 되면 일어날 진화를 끝까지(아이템 없는 조건만) 미리 센다 — 이상한 사탕이 Lv16·Lv34 를 한꺼번에 넘으면 두 번 진화한다. 세션은 바꾸지 않는다. */
export function previewMonsterEvolutionChain(
  project: Project,
  session: PlaySession,
  instanceId: string,
  atLevel: number,
): readonly MonsterSpeciesId[] {
  const raw = session.monsterInstances[instanceId];
  const instance = raw ? normalizeMonsterInstanceBattleState(project, raw) : undefined;
  if (!instance) return [];
  const chain: MonsterSpeciesId[] = [];
  let speciesId = instance.speciesId;
  for (let step = 0; step < 6; step += 1) {
    const species = monsterSpeciesById(project, speciesId);
    const evolution = species ? selectEvolution(project, session, { ...instance, speciesId, level: atLevel }, species, { instanceId, allowItemEvolution: false }) : undefined;
    if (!evolution || chain.includes(evolution.toSpeciesId) || evolution.toSpeciesId === instance.speciesId) break;
    chain.push(evolution.toSpeciesId);
    speciesId = evolution.toSpeciesId;
  }
  return chain;
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
    const nextExp = monsterExpInLevelBand(species, fromLevel, before.exp) + exp;
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
  /**
   * learnedSkillIds 중 기술 칸(MONSTER_SKILL_MAX)이 모자라 바로 익히지 못하고 보류(pendingSkillIds)로 가는 것.
   * 비어 있으면 필드 자체가 없다 — 「배웠다!」 문장은 여기 없는 것만 말해야 한다.
   */
  readonly overflowSkillIds?: readonly SkillId[];
};

/** 새로 배울 기술을 칸이 남는 만큼은 바로 익히고, 나머지는 보류로 가르는 것(applyLearnedMonsterSkills 와 같은 순서·같은 기준). */
export function splitLearnedMonsterSkills(
  activeSkillIds: readonly SkillId[],
  learnedSkillIds: readonly SkillId[],
): { readonly learned: SkillId[]; readonly overflow: SkillId[] } {
  const free = Math.max(0, MONSTER_SKILL_MAX - activeSkillIds.length);
  const fresh = uniqueSkillIds(learnedSkillIds).filter((skillId) => !activeSkillIds.includes(skillId));
  return { learned: fresh.slice(0, free), overflow: fresh.slice(free) };
}

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
    const toLevel = monsterLevelForExp(species, fromLevel, monsterExpInLevelBand(species, fromLevel, instance.exp) + exp);
    if (toLevel <= fromLevel) continue;
    const activeSkillIds = monsterSkillIds(project, instance);
    const learnedSkillIds = newSkillsForLevelRange(
      species,
      fromLevel,
      toLevel,
      [...activeSkillIds, ...(instance.pendingSkillIds ?? [])],
    );
    const { overflow } = splitLearnedMonsterSkills(activeSkillIds, learnedSkillIds);
    results.push({
      instanceId: instance.instanceId,
      name: monsterDisplayName(project, instance),
      fromLevel,
      toLevel,
      learnedSkillIds,
      ...(overflow.length > 0 ? { overflowSkillIds: overflow } : {}),
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
  recordMonsterCaught(project, session, fromSpecies.id);
  recordMonsterCaught(project, session, toSpecies.id);
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
  // 개체 수 + 1 에서 시작하면, 놓아주기·교환·합성으로 지운 뒤 방금 지운 id 를 다시 쓴다 — 그 id 를 가리키던
  // 이벤트 명령이 엉뚱한 새 개체를 건드린다. 지금까지 쓴 가장 큰 번호 다음부터 센다(지운 것이 없으면 예전과 같다).
  let index = Object.keys(session.monsterInstances).length + 1;
  for (const id of Object.keys(session.monsterInstances)) {
    const match = /^monster_(\d+)$/.exec(id);
    if (match) index = Math.max(index, Number(match[1]) + 1);
  }
  const retired = session.retiredMonsterInstanceSeq ?? 0;
  if (retired >= index) index = retired + 1;
  while (session.monsterInstances[`monster_${index}`]) index += 1;
  return `monster_${index}`;
}

function rollIv(rng: Rng): number {
  return clampInteger(Math.floor(rng() * 16), 0, 15);
}

function normalizeSpeciesGraphic(graphic: Partial<MonsterSpeciesGraphic> | undefined): MonsterSpeciesGraphic {
  return {
    monsterResourceId: cleanOptionalText(graphic?.monsterResourceId),
    backResourceId: cleanOptionalText(graphic?.backResourceId),
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

// 포켓몬 유사 스탯 공식(IV 0~15, EV·성격은 옵트인):
//   HP     = floor((2*base + iv + floor(ev/4)) * level / 100) + level + 10
//   기타   = floor(floor((2*base + iv + floor(ev/4)) * level / 100) + 5) * 성격 보정(0.9/1/1.1))
// EV·성격(extras)을 안 주면(기본) 예전 식 그대로다. MP는 원작에 대응이 없어 base를 레벨로 완만 스케일한다. mind는 IV가 없어 iv=0.
export type MonsterStatExtras = {
  readonly nature?: string;
  readonly evs?: Partial<MonsterInstanceEvs>;
};

export function monsterBattleStatsForSpecies(
  species: MonsterSpeciesRecord | undefined,
  level: number,
  ivs: MonsterInstance["ivs"],
  extras?: MonsterStatExtras
): MonsterBattleStats {
  const base = species?.baseStats;
  const lv = clampInteger(level, 1, ACTOR_LEVEL_MAX);
  const nature = monsterNatureById(extras?.nature);
  const evs = extras?.evs ? clampMonsterEvs(extras.evs) : undefined;
  // 성격 ±10%: 능력치가 작은 게임(한 자리 능력치)에서도 보이도록 최소 ±1 은 움직인다. 두 자리 이상에서는 floor(raw*1.1)/floor(raw*0.9)와 같다.
  const natured = (raw: number, stat: MonsterNatureStat): number => {
    if (nature?.up === stat) return Math.max(Math.floor(raw * 1.1), raw + 1);
    if (nature?.down === stat) return Math.max(1, Math.min(Math.floor(raw * 0.9), raw - 1));
    return raw;
  };
  const other = (statBase: number, iv: number, ev: number, stat: MonsterNatureStat): number => {
    const raw = Math.floor((2 * statBase + iv + Math.floor(ev / 4)) * lv / 100) + 5;
    return Math.max(1, natured(raw, stat));
  };
  const hp = Math.floor((2 * (base?.maxHp ?? 1) + (ivs?.hp ?? 0) + Math.floor((evs?.hp ?? 0) / 4)) * lv / 100) + lv + 10;
  return {
    maxHp: Math.max(1, hp),
    maxMp: Math.max(0, Math.floor((base?.maxMp ?? 0) * (1 + lv / 50))),
    attack: other(base?.attack ?? 1, ivs?.atk ?? 0, evs?.atk ?? 0, "attack"),
    defense: other(base?.defense ?? 1, ivs?.def ?? 0, evs?.def ?? 0, "defense"),
    mind: other(base?.mind ?? 1, 0, 0, "mind"),
    agility: other(base?.agility ?? 1, ivs?.spd ?? 0, evs?.spd ?? 0, "agility"),
  };
}

/** 프로젝트 규칙이 켜져 있을 때만 인스턴스의 성격·노력치를 공식에 넘긴다(꺼져 있으면 undefined = 예전 식). */
export function monsterStatExtrasFor(project: Pick<Project, "system">, instance: Pick<MonsterInstance, "nature" | "evs"> | undefined): MonsterStatExtras | undefined {
  if (!instance) return undefined;
  const rules = monsterStatRulesOf(project);
  if (!rules.natures && !rules.evs) return undefined;
  return { ...(rules.natures && instance.nature ? { nature: instance.nature } : {}), ...(rules.evs && instance.evs ? { evs: instance.evs } : {}) };
}

/** 인스턴스의 전투 유효 스탯(종족+레벨+IV). 전투 배틀러 생성에 사용. */
export function monsterBattleStats(project: Project, instance: MonsterInstance): MonsterBattleStats {
  return monsterBattleStatsForSpecies(monsterSpeciesById(project, instance.speciesId), instance.level, instance.ivs, monsterStatExtrasFor(project, instance));
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

function monsterMaxHpFor(project: Project, species: MonsterSpeciesRecord | undefined, instance: MonsterInstance): number {
  return monsterBattleStatsForSpecies(species, instance.level, instance.ivs, monsterStatExtrasFor(project, instance)).maxHp;
}

function monsterSkillIdsForSpecies(species: MonsterSpeciesRecord, level: number): SkillId[] {
  return (species.skillsByLevel ?? [])
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.skillId);
}

/** 이 레벨까지 배운 기술 중 슬롯에 남는 최근 것. 플레이어 몬스터와 빈 적 행동이 같은 목록을 쓴다. */
export function monsterSkillIdsAtLevel(species: MonsterSpeciesRecord, level: number): SkillId[] {
  return uniqueSkillIds(monsterSkillIdsForSpecies(species, level)).slice(-MONSTER_SKILL_MAX);
}

function latestMonsterSkillIdsForSpecies(species: MonsterSpeciesRecord, level: number): SkillId[] {
  return monsterSkillIdsAtLevel(species, level);
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

/** 저장된 경험치를 현재 레벨 구간 [그 레벨 누적, 다음 레벨 누적-1] 안으로 맞춘다. 레벨만 바꾼 저장본(이벤트·디버그·옛 데이터)이
 *  경험치 2800을 들고 Lv14 로 남아 있으면 한 번의 승리로 Lv20 까지 뛰었다(2026-10-07 플레이 영상). */
export function monsterExpInLevelBand(species: MonsterSpeciesRecord, level: number, exp: number | undefined): number {
  const curve = species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  const current = clampInteger(level, 1, ACTOR_LEVEL_MAX);
  const floor = totalExpForLevel(curve, current);
  if (current >= ACTOR_LEVEL_MAX) return Math.max(floor, Math.trunc(exp ?? 0));
  const ceiling = totalExpForLevel(curve, current + 1) - 1;
  return Math.min(ceiling, Math.max(floor, Math.trunc(exp ?? 0)));
}

/** 이 개체를 `levels` 레벨 올리는 데 필요한 경험치(상한 레벨이면 0). 이상한 사탕이 레벨 문턱까지 정확히 채우는 데 쓴다. */
export function monsterExpToRaiseLevels(species: MonsterSpeciesRecord, instance: Pick<MonsterInstance, "level" | "exp">, levels: number): { readonly toLevel: number; readonly exp: number } {
  const curve = species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  const level = clampInteger(instance.level, 1, ACTOR_LEVEL_MAX);
  const toLevel = clampInteger(level + Math.max(0, Math.trunc(levels)), 1, ACTOR_LEVEL_MAX);
  if (toLevel <= level) return { toLevel: level, exp: 0 };
  return { toLevel, exp: Math.max(1, totalExpForLevel(curve, toLevel) - monsterExpInLevelBand(species, level, instance.exp)) };
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
    .filter((evolution) => !input.itemId || evolution.requires.itemId === input.itemId)
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
