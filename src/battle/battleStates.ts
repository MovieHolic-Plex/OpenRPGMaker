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
  // 수면/마비 등 행동 불가 여부.
  readonly restrictsAction: boolean;
  // 매 턴 최대 HP 대비 지속 피해 비율(%). 0 이면 지속 피해 없음.
  readonly hpDamagePercentPerTurn: number;
  // 공격/방어 배율(공격 상승 = 2, 방어 하락 = 0.5 등). 기본 1.
  readonly attackMultiplier: number;
  readonly defenseMultiplier: number;
  // 전투 종료 시 해제 여부(독처럼 "유지" 이면 false).
  readonly removeOnBattleEnd: boolean;
  // 피격 시 해제 확률(%). 수면 등.
  readonly recoverWhenHitChance: number;
  // 자연 회복 시작 턴 / 확률(%).
  readonly recoverNaturallyFromTurn: number;
  readonly recoverNaturallyChance: number;
}

// hpTurn 문자열/숫자에서 매 턴 지속 피해 비율을 추출.
// "매 턴 최대 HP의 -6%" → 6, 양수/무변화 → 0, record.hpReleaseTurn 숫자 → 절댓값.
function hpDamagePercentFrom(hpTurn: string): number {
  const percentMatch = /(-?)\s*(\d+)\s*%/.exec(hpTurn);
  if (percentMatch) return percentMatch[1] === "-" ? Number(percentMatch[2]) : 0;
  const bareMatch = /^\s*(-?\d+)\s*$/.exec(hpTurn);
  if (bareMatch) return Math.abs(Number(bareMatch[1]));
  return 0;
}

export function stateBehavior(record: StateRecord): StateBehavior {
  const resolved = resolvedStateValues(record.id, record.name, record);
  const runtime = record.runtimeEffects;
  return {
    stateId: record.id,
    name: record.name,
    restrictsAction: runtime?.restrictsAction ?? restrictsActionFrom(record.id, resolved.restriction),
    hpDamagePercentPerTurn: runtime?.hpDamagePercentPerTurn ?? hpDamagePercentFrom(resolved.hpTurn),
    attackMultiplier: runtime?.attackMultiplier ?? attackMultiplierFrom(record.id, resolved.actorStatus),
    defenseMultiplier: runtime?.defenseMultiplier ?? defenseMultiplierFrom(record.id, resolved.actorStatus),
    removeOnBattleEnd: runtime?.removeOnBattleEnd ?? removeOnBattleEndFrom(record.id, resolved.removalCondition),
    recoverWhenHitChance: resolved.recoverWhenHitChance,
    recoverNaturallyFromTurn: resolved.recoverNaturallyFromTurn,
    recoverNaturallyChance: resolved.recoverNaturallyChance,
  };
}

function restrictsActionFrom(stateId: string, value: string): boolean {
  if (stateId === "state_sleep") return true;
  return /\b(cannot act|stun|sleep|paraly[sz]ed|immobilized)\b/i.test(value);
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
  return !/\b(persist|keep|remain)\b/i.test(value);
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

// 대상의 상태 저항(%)을 stateRates 등급에서 계산. 등급 없으면 100(저항 없음).
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
  readonly removedStateIds: readonly string[];
}

// 배틀러 턴 시작 시의 상태 처리: 지속 피해 + 자연 회복 판정.
// 지속 피해는 HP 를 1 미만으로 떨어뜨리지 않는다(상태이상만으로 전투불능 방지, RM2K3 방식).
export function runStateUpkeep(project: Project, battler: MutableBattler, rng: Rng = defaultRng): UpkeepResult {
  let hpDamage = 0;
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
    const turns = battler.stateTurns[stateId] ?? 0;
    if (turns >= behavior.recoverNaturallyFromTurn && rollPercent(behavior.recoverNaturallyChance, rng)) {
      removeState(battler, stateId);
      removedStateIds.push(stateId);
    }
  }
  return { hpDamage, removedStateIds };
}

// 행동 가능 여부. 행동 불가 상태가 하나라도 있으면 false.
export function canBattlerAct(project: Project, battler: MutableBattler): boolean {
  return !battler.stateIds.some((stateId) => behaviorFor(project, stateId)?.restrictsAction);
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

export function attackMultiplierForStates(project: Project, battler: MutableBattler): number {
  return battler.stateIds.reduce((factor, stateId) => factor * (behaviorFor(project, stateId)?.attackMultiplier ?? 1), 1);
}

export function defenseMultiplierForStates(project: Project, battler: MutableBattler): number {
  return battler.stateIds.reduce((factor, stateId) => factor * (behaviorFor(project, stateId)?.defenseMultiplier ?? 1), 1);
}
