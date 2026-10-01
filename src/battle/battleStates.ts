// 전투 상태이상(독/수면/강화/약화 등) 순수 로직.
// DB 상태(States) 탭 레코드 + 상태 온톨로지에서 행동을 읽어 구동한다.
// 모든 확률 판정은 주입 가능한 rng로 처리해 테스트와 리플레이에서 결정적으로 만들 수 있다.
import { stateRatePercentage } from "@/project/actorModel";
import { resolvedStateValues } from "@/project/ontology/databaseStateOntology";
import type { DatabaseStateEffect, Project, StateRecord } from "@/project/types";
import type { MutableBattler } from "@/battle/battleBattlers";

export type Rng = () => number;
const defaultRng: Rng = () => {
  throw new Error("battle state effect requires an rng; pass a deterministic rng.");
};

// 확률(0~100)을 rng 로 굴린다. chance>=100 이면 항상 성공, <=0 이면 항상 실패.
function rollPercent(chance: number, rng: Rng): boolean {
  if (chance >= 100) return true;
  if (chance <= 0) return false;
  return rng() * 100 < chance;
}

export interface StateBehavior {
  readonly stateId: string;
  readonly name: string;
  // 수면/마비 등 행동 불가 여부와 침묵의 스킬 사용 제한.
  readonly restrictsAction: boolean;
  readonly blocksSkillUse: boolean;
  // 매 턴 최대 HP 대비 지속 피해/회복 비율(%). 0 이면 효과 없음.
  readonly hpDamagePercentPerTurn: number;
  readonly hpHealPercentPerTurn: number;
  // 공격/방어/민첩 배율(공격 상승 = 2, 방어 하락 = 0.5 등). 기본 1.
  readonly attackMultiplier: number;
  readonly defenseMultiplier: number;
  readonly agilityMultiplier: number;
  // 전투 종료 시 해제 여부(독처럼 "유지" 이면 false).
  readonly removeOnBattleEnd: boolean;
  // 피격 시 해제 확률(%). 수면 등.
  readonly recoverWhenHitChance: number;
  // 자연 회복 시작 턴 / 확률(%).
  readonly recoverNaturallyFromTurn: number;
  readonly recoverNaturallyChance: number;
  // Chrono 계열 상태(스톱·프로텍트/실드·버서크·속성 덮어쓰기). 모두 runtimeEffects 에서만 온다.
  readonly freezesGauge: boolean;
  readonly physicalDefenseMultiplier: number;
  readonly magicDefenseMultiplier: number;
  readonly forcedAction?: "attackRandom";
  readonly elementRates?: Readonly<Record<string, string>>;
  // 반격·도발·감싸기·회피·리플렉·리레이즈·선고(2026-10-01). 모두 runtimeEffects 에서만 온다.
  readonly counterChance: number;
  readonly taunt: boolean;
  readonly cover: boolean;
  readonly evasionChance: number;
  readonly reflect: boolean;
  readonly reraisePercent: number;
  readonly doomTurns: number;
}

// hpTurn 문자열/숫자에서 매 턴 HP 변화 비율(부호 포함)을 추출.
// "매 턴 최대 HP의 -6%" → -6, "+8%" → 8, record.hpReleaseTurn 숫자 → 그대로.
// 자료집 칸(「전투 중(턴당%)」, -100~100)도 음수 = 피해, 양수 = 회복이다. 예전에는 맨 숫자를
// 절댓값으로 읽어 「+8% 재생」을 칸에 다시 저장하면 8% 피해가 됐다.
function hpTurnSignedPercent(hpTurn: string): number {
  const percentMatch = /([+-]?)\s*(\d+)\s*%/.exec(hpTurn);
  if (percentMatch) return percentMatch[1] === "-" ? -Number(percentMatch[2]) : Number(percentMatch[2]);
  const bareMatch = /^\s*([+-]?\d+)\s*$/.exec(hpTurn);
  if (bareMatch) return Number(bareMatch[1]);
  return 0;
}

function hpDamagePercentFrom(hpTurn: string): number {
  return Math.max(0, -hpTurnSignedPercent(hpTurn));
}

function hpHealPercentFrom(hpTurn: string): number {
  return Math.max(0, hpTurnSignedPercent(hpTurn));
}

export function hpDamagePercentForStateExplicit(project: Project, stateId: string): number {
  const behavior = behaviorFor(project, stateId);
  if (!behavior) return 0;
  return behavior.hpDamagePercentPerTurn ?? 0;
}

export function stateBehavior(record: StateRecord): StateBehavior {
  const resolved = resolvedStateValues(record.id, record.name, record);
  const runtime = record.runtimeEffects;
  return {
    stateId: record.id,
    name: record.name,
    restrictsAction: runtime?.restrictsAction ?? restrictsActionFrom(record.id, resolved.restriction),
    blocksSkillUse: runtime?.blocksSkillUse ?? blocksSkillUseFrom(record.id, resolved.restriction),
    hpDamagePercentPerTurn: runtime?.hpDamagePercentPerTurn ?? hpDamagePercentFrom(resolved.hpTurn),
    hpHealPercentPerTurn: runtime?.hpHealPercentPerTurn ?? hpHealPercentFrom(resolved.hpTurn),
    attackMultiplier: runtime?.attackMultiplier ?? attackMultiplierFrom(record.id, resolved.actorStatus),
    defenseMultiplier: runtime?.defenseMultiplier ?? defenseMultiplierFrom(record.id, resolved.actorStatus),
    agilityMultiplier: runtime?.agilityMultiplier ?? 1,
    removeOnBattleEnd: runtime?.removeOnBattleEnd ?? removeOnBattleEndFrom(record.id, resolved.removalCondition),
    recoverWhenHitChance: resolved.recoverWhenHitChance,
    recoverNaturallyFromTurn: resolved.recoverNaturallyFromTurn,
    recoverNaturallyChance: resolved.recoverNaturallyChance,
    freezesGauge: runtime?.freezesGauge === true,
    physicalDefenseMultiplier: runtime?.physicalDefenseMultiplier ?? 1,
    magicDefenseMultiplier: runtime?.magicDefenseMultiplier ?? 1,
    ...(runtime?.forcedAction === "attackRandom" ? { forcedAction: "attackRandom" as const } : {}),
    ...(runtime?.elementRates ? { elementRates: runtime.elementRates } : {}),
    counterChance: clampPercent(runtime?.counterChance),
    taunt: runtime?.taunt === true,
    cover: runtime?.cover === true,
    evasionChance: Math.min(95, clampPercent(runtime?.evasionChance)),
    reflect: runtime?.reflect === true,
    reraisePercent: clampPercent(runtime?.reraisePercent),
    doomTurns: Math.max(0, Math.min(9, Math.round(Number(runtime?.doomTurns ?? 0) || 0))),
  };
}

function clampPercent(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function restrictsActionFrom(stateId: string, value: string): boolean {
  if (stateId === "state_sleep") return true;
  // 자료집 「제한」 드롭다운의 한국어 값도 읽는다.
  return /행동 불가/.test(value) || /\b(cannot act|stun|sleep|paraly[sz]ed|immobilized)\b/i.test(value);
}

function blocksSkillUseFrom(stateId: string, value: string): boolean {
  if (stateId === "state_silence") return true;
  return /스킬 사용 불가/.test(value) || /\b(cannot use skills?|silence[dn]?)\b/i.test(value);
}

function attackMultiplierFrom(stateId: string, value: string): number {
  if (stateId === "state_attack_up") return 2;
  const match = /\battack\s*(?:x|×)\s*(\d+(?:\.\d+)?)\b/i.exec(value);
  return match ? Math.max(0, Number(match[1])) : 1;
}

function defenseMultiplierFrom(stateId: string, value: string): number {
  if (stateId === "state_defense_up") return 2;
  if (stateId === "state_defense_down") return 0.5;
  const match = /\bdefen[cs]e\s*(?:x|×)\s*(\d+(?:\.\d+)?)\b/i.exec(value);
  return match ? Math.max(0, Number(match[1])) : 1;
}

function removeOnBattleEndFrom(stateId: string, value: string): boolean {
  if (stateId === "state_poison") return false;
  // 「해제 조건」 드롭다운의 「전투 종료 후 유지」.
  return !(/유지/.test(value) || /\b(persist|keep|remain)\b/i.test(value));
}

export function stateRecordsById(project: Project): Map<string, StateRecord> {
  const map = new Map<string, StateRecord>();
  for (const record of project.database.states) map.set(record.id, record);
  return map;
}

function behaviorFor(project: Project, stateId: string): StateBehavior | undefined {
  const record = project.database.states.find((entry) => entry.id === stateId);
  return record ? stateBehavior(record) : undefined;
}

// 대상의 상태 저항(%)을 stateRates 등급에서 계산. 미지정 등급은 100(추가 저항 없음).
export function stateResistancePercent(project: Project, battler: MutableBattler, stateId: string): number {
  const actor = project.database.actors.find((entry) => entry.id === battler.recordId);
  const enemy = project.database.enemies.find((entry) => entry.id === battler.recordId);
  const grade = actor?.stateRates?.[stateId] ?? enemy?.stateRates?.[stateId];
  return grade ? stateRatePercentage(grade) : 100;
}

function addState(battler: MutableBattler, stateId: string): void {
  if (!battler.stateIds.includes(stateId)) battler.stateIds = [...battler.stateIds, stateId];
  battler.stateTurns[stateId] = 0;
}

function removeState(battler: MutableBattler, stateId: string): void {
  battler.stateIds = battler.stateIds.filter((id) => id !== stateId);
  delete battler.stateTurns[stateId];
}

export interface InflictResult {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

// 스킬/아이템의 상태 효과를 대상에 적용. add 는 (chance × 저항)% 로, remove 는 즉시.
export function applyStateEffects(
  project: Project,
  target: MutableBattler,
  effects: readonly DatabaseStateEffect[] | undefined,
  rng: Rng = defaultRng
): InflictResult {
  const added: string[] = [];
  const removed: string[] = [];
  for (const effect of effects ?? []) {
    if (!behaviorFor(project, effect.stateId)) continue;
    if (effect.operation === "remove") {
      if (target.stateIds.includes(effect.stateId)) {
        removeState(target, effect.stateId);
        removed.push(effect.stateId);
      }
      continue;
    }
    if (equipmentResistsState(target, effect.stateId, rng)) continue;
    const resistance = stateResistancePercent(project, target, effect.stateId);
    const chance = (effect.chance * resistance) / 100;
    if (rollPercent(chance, rng) && !target.stateIds.includes(effect.stateId)) {
      addState(target, effect.stateId);
      added.push(effect.stateId);
    }
  }
  return { added, removed };
}

function equipmentResistsState(target: MutableBattler, stateId: string, rng: Rng): boolean {
  const effects = target.equipmentEffects;
  if (!effects || effects.stateDefenseMode !== "resist") return false;
  if (!effects.stateDefenseIds.includes(stateId)) return false;
  return rollPercent(effects.stateResistanceChance, rng);
}

export interface UpkeepResult {
  readonly hpDamage: number;
  readonly hpHealing: number;
  readonly removedStateIds: readonly string[];
  /** 선고(doomTurns)가 다 차서 쓰러뜨린 상태 id. 쓰러지기 직전 HP 는 doomedHp. */
  readonly doomedStateId?: string;
  readonly doomedHp?: number;
}

// 배틀러 턴 시작 시의 상태 처리: 지속 피해 + 자연 회복 판정.
// 지속 피해는 HP 를 1 미만으로 떨어뜨리지 않는다(상태이상만으로 전투불능 방지, RM2K3 방식).
export function runStateUpkeep(project: Project, battler: MutableBattler, rng: Rng = defaultRng): UpkeepResult {
  let hpDamage = 0;
  let hpHealing = 0;
  const removedStateIds: string[] = [];
  for (const stateId of [...battler.stateIds]) {
    const behavior = behaviorFor(project, stateId);
    if (!behavior) continue;
    battler.stateTurns[stateId] = (battler.stateTurns[stateId] ?? 0) + 1;
    if (behavior.hpDamagePercentPerTurn > 0 && battler.hp > 1) {
      const tick = Math.max(1, Math.floor((battler.maxHp * behavior.hpDamagePercentPerTurn) / 100));
      const applied = Math.min(tick, battler.hp - 1);
      battler.hp -= applied;
      hpDamage += applied;
    }
    if (behavior.hpHealPercentPerTurn > 0 && battler.hp > 0 && battler.hp < battler.maxHp) {
      const tick = Math.max(1, Math.floor((battler.maxHp * behavior.hpHealPercentPerTurn) / 100));
      const applied = Math.min(tick, battler.maxHp - battler.hp);
      battler.hp += applied;
      hpHealing += applied;
    }
    const turns = battler.stateTurns[stateId] ?? 0;
    // 선고: 자기 턴이 doomTurns 만큼 지나면 쓰러진다. 자연 회복보다 먼저 본다(회복 굴림으로 피하지 못한다).
    if (behavior.doomTurns > 0 && turns >= behavior.doomTurns && battler.hp > 0) {
      const doomedHp = battler.hp;
      battler.hp = 0;
      removeState(battler, stateId);
      removedStateIds.push(stateId);
      return { hpDamage, hpHealing, removedStateIds, doomedStateId: stateId, doomedHp };
    }
    if (turns >= behavior.recoverNaturallyFromTurn && rollPercent(behavior.recoverNaturallyChance, rng)) {
      removeState(battler, stateId);
      removedStateIds.push(stateId);
    }
  }
  return { hpDamage, hpHealing, removedStateIds };
}

// 행동 가능 여부. 행동 불가 상태(스톱 포함)가 하나라도 있으면 false.
export function canBattlerAct(project: Project, battler: { readonly stateIds: readonly string[] }): boolean {
  return !battler.stateIds.some((stateId) => {
    const behavior = behaviorFor(project, stateId);
    return behavior?.restrictsAction === true || behavior?.freezesGauge === true;
  });
}

export function stateBlocksSkillUse(project: Project, battler: { readonly stateIds?: readonly string[] }): boolean {
  // 몬스터·적 배틀러는 stateIds 를 들고 오지 않는 경로가 있다(Gen1 PP 경로에서 실측).
  return (battler.stateIds ?? []).some((stateId) => behaviorFor(project, stateId)?.blocksSkillUse);
}

// 피격 시 상태 해제 판정(수면 등). 해제된 상태 id 목록 반환.
export function recoverStatesWhenHit(project: Project, battler: MutableBattler, rng: Rng = defaultRng): readonly string[] {
  const removed: string[] = [];
  for (const stateId of [...battler.stateIds]) {
    const behavior = behaviorFor(project, stateId);
    if (!behavior || behavior.recoverWhenHitChance <= 0) continue;
    if (rollPercent(behavior.recoverWhenHitChance, rng)) {
      removeState(battler, stateId);
      removed.push(stateId);
    }
  }
  return removed;
}

// 전투 종료 시 해제 대상 상태를 제거.
export function clearBattleEndStates(project: Project, battler: MutableBattler): void {
  for (const stateId of [...battler.stateIds]) {
    if (behaviorFor(project, stateId)?.removeOnBattleEnd) removeState(battler, stateId);
  }
}

const STATE_MULTIPLIER_MIN = 0.4;
const STATE_MULTIPLIER_MAX = 2.5;

function clampStateMultiplier(value: number): number {
  return Math.max(STATE_MULTIPLIER_MIN, Math.min(STATE_MULTIPLIER_MAX, value));
}

export function attackMultiplierForStates(project: Project, battler: { readonly stateIds: readonly string[] }): number {
  const raw = battler.stateIds.reduce((factor, stateId) => factor * (behaviorFor(project, stateId)?.attackMultiplier ?? 1), 1);
  return clampStateMultiplier(raw);
}

export function agilityMultiplierForStates(project: Project, battler: { readonly stateIds: readonly string[] }): number {
  const raw = battler.stateIds.reduce((factor, stateId) => factor * (behaviorFor(project, stateId)?.agilityMultiplier ?? 1), 1);
  return clampStateMultiplier(raw);
}

export function defenseMultiplierForStates(project: Project, battler: { readonly stateIds: readonly string[] }): number {
  const raw = battler.stateIds.reduce((factor, stateId) => factor * (behaviorFor(project, stateId)?.defenseMultiplier ?? 1), 1);
  return clampStateMultiplier(raw);
}

/**
 * 피해 계열(공격=물리, 마력=마법)별 방어 배율. 공용 defenseMultiplier 에 프로텍트/실드 같은 한쪽 배율을 곱한다.
 * 한쪽 배율이 없는 상태만 있으면 defenseMultiplierForStates 와 같은 값이다(기존 동작 그대로).
 */
export function defenseMultiplierForStatesByKind(
  project: Project,
  battler: { readonly stateIds: readonly string[] },
  kind: "attack" | "mind",
): number {
  const raw = battler.stateIds.reduce((factor, stateId) => {
    const behavior = behaviorFor(project, stateId);
    if (!behavior) return factor;
    const split = kind === "mind" ? behavior.magicDefenseMultiplier : behavior.physicalDefenseMultiplier;
    return factor * behavior.defenseMultiplier * split;
  }, 1);
  return clampStateMultiplier(raw);
}

/** 스톱: 게이지가 멈추는 상태가 하나라도 있으면 true. */
export function gaugeFrozenByStates(project: Project, battler: { readonly stateIds: readonly string[] }): boolean {
  return battler.stateIds.some((stateId) => behaviorFor(project, stateId)?.freezesGauge === true);
}

/** 버서크: 강제 행동 상태가 있으면 그 종류. */
export function forcedActionForStates(project: Project, battler: { readonly stateIds: readonly string[] }): "attackRandom" | undefined {
  return battler.stateIds.some((stateId) => behaviorFor(project, stateId)?.forcedAction === "attackRandom") ? "attackRandom" : undefined;
}

/** 반격 확률(%): 걸린 상태 중 가장 큰 값. */
export function counterChanceForStates(project: Project, battler: { readonly stateIds: readonly string[] }): number {
  return battler.stateIds.reduce((best, stateId) => Math.max(best, behaviorFor(project, stateId)?.counterChance ?? 0), 0);
}

/** 회피 확률(%): 걸린 상태 중 가장 큰 값(최대 95). */
export function evasionChanceForStates(project: Project, battler: { readonly stateIds: readonly string[] }): number {
  return battler.stateIds.reduce((best, stateId) => Math.max(best, behaviorFor(project, stateId)?.evasionChance ?? 0), 0);
}

/** 도발·감싸기·리플렉: 걸린 상태 중 하나라도 켜져 있으면 true. */
export function stateFlag(project: Project, battler: { readonly stateIds: readonly string[] }, flag: "taunt" | "cover" | "reflect"): boolean {
  return battler.stateIds.some((stateId) => behaviorFor(project, stateId)?.[flag] === true);
}

/** 리레이즈: 일어날 HP % 와 그 상태 id(가장 큰 것). 없으면 undefined. */
export function reraiseForStates(project: Project, battler: { readonly stateIds: readonly string[] }): { readonly stateId: string; readonly percent: number } | undefined {
  let best: { stateId: string; percent: number } | undefined;
  for (const stateId of battler.stateIds) {
    const percent = behaviorFor(project, stateId)?.reraisePercent ?? 0;
    if (percent > 0 && (!best || percent > best.percent)) best = { stateId, percent };
  }
  return best;
}

/** 활성 상태가 덮어쓰는 속성 등급. 나중에 걸린 상태가 이긴다. 없으면 undefined. */
export function stateElementRateOverride(project: Project, battler: { readonly stateIds: readonly string[] }, elementId: string): string | undefined {
  let grade: string | undefined;
  for (const stateId of battler.stateIds) {
    const override = behaviorFor(project, stateId)?.elementRates?.[elementId];
    if (override) grade = override;
  }
  return grade;
}
