// 감정(emotion) 상태와 약점 추가 행동.
//
// 감정: StateRecord.emotion = { family, tier }. 규칙(오모리식):
//   - 배틀러는 감정 상태를 한 번에 하나만 가진다. 다른 계열 감정을 걸면 바꿔 끼운다.
//   - 같은 계열을 다시 걸면 한 단계 오른다(걸린 상태의 단계가 더 높으면 그 단계로). 최고 단계에서 멈춘다.
//   - 공격자 감정 계열 × 대상 감정 계열 배율은 system.emotionCycle 표가 정한다(없으면 1).
// 감정 상태가 하나도 없는 프로젝트는 이 모듈을 거쳐도 상태·rng 흐름이 예전과 같다.
//
// 약점 추가 행동(system.weaknessExtraAction): 아군 공격이 속성 약점(배율 > 1)을 찌르면 그 적을
// 「쓰러뜨리고」 한 번 더 행동한다. 쓰러진 적은 제 차례가 오기 전까지 다시 약점을 맞아도 행동을 더 주지 않는다.
import type { MutableBattler } from "@/battle/battleBattlers";
import { applyStateEffects, stateResistancePercent, type InflictResult } from "@/battle/battleStates";
import type { DatabaseStateEffect, Project, StateEmotion, StateRecord } from "@/project/types";
import type { Rng } from "@/util/rng";

export function stateEmotionOf(project: Pick<Project, "database">, stateId: string): StateEmotion | undefined {
  const emotion = project.database.states.find((state) => state.id === stateId)?.emotion;
  return emotion && emotion.family.trim() !== "" ? emotion : undefined;
}

/** 배틀러의 현재 감정(첫 감정 상태). 없으면 undefined. */
export function battlerEmotion(
  project: Pick<Project, "database">,
  battler: { readonly stateIds: readonly string[] },
): { readonly stateId: string; readonly emotion: StateEmotion } | undefined {
  for (const stateId of battler.stateIds) {
    const emotion = stateEmotionOf(project, stateId);
    if (emotion) return { stateId, emotion };
  }
  return undefined;
}

/** 공격자·대상 감정 계열 상성 배율. 표가 없거나 어느 쪽이든 감정이 없으면 1. */
export function emotionDamageMultiplier(
  project: Pick<Project, "database" | "system">,
  user: { readonly stateIds: readonly string[] },
  target: { readonly stateIds: readonly string[] },
): number {
  const rules = project.system.emotionCycle;
  if (!rules || rules.length === 0) return 1;
  const attacker = battlerEmotion(project, user)?.emotion.family;
  const defender = battlerEmotion(project, target)?.emotion.family;
  if (!attacker || !defender) return 1;
  const rule = rules.find((entry) => entry.attackerFamily === attacker && entry.targetFamily === defender);
  return rule && Number.isFinite(rule.multiplier) && rule.multiplier >= 0 ? rule.multiplier : 1;
}

/** 계열의 상태를 단계 오름차순으로. 같은 단계면 DB 순서를 지킨다. */
function familyStates(project: Pick<Project, "database">, family: string): StateRecord[] {
  return project.database.states
    .filter((state) => state.emotion?.family === family)
    .sort((left, right) => (left.emotion?.tier ?? 0) - (right.emotion?.tier ?? 0));
}

/**
 * 감정 상태 하나를 건다(확률 판정은 호출자). 같은 계열이면 단계를 올리고, 다른 감정은 떼어 낸다.
 * 돌려주는 added 는 최종적으로 남은 상태(바뀌지 않았으면 비어 있음), removed 는 떼어 낸 감정들.
 */
export function addEmotionState(project: Pick<Project, "database">, target: MutableBattler, stateId: string): InflictResult {
  const emotion = stateEmotionOf(project, stateId);
  if (!emotion) return { added: [], removed: [] };
  const current = battlerEmotion(project, target);
  const wantedTier = current && current.emotion.family === emotion.family
    ? Math.max(current.emotion.tier + 1, emotion.tier)
    : emotion.tier;
  const candidates = familyStates(project, emotion.family);
  const reached = candidates.filter((state) => (state.emotion?.tier ?? 0) <= wantedTier);
  const finalStateId = reached[reached.length - 1]?.id ?? stateId;
  if (current?.stateId === finalStateId) return { added: [], removed: [] };
  const removed = target.stateIds.filter((id) => stateEmotionOf(project, id) !== undefined);
  target.stateIds = [...target.stateIds.filter((id) => !removed.includes(id)), finalStateId];
  for (const id of removed) delete target.stateTurns[id];
  target.stateTurns[finalStateId] = 0;
  return { added: [finalStateId], removed };
}

/**
 * applyStateEffects 의 감정 인식판. 감정 상태 부여가 없으면 그대로 위임한다(기존 프로젝트 동작 동일).
 * 감정 부여는 같은 저항(stateRates) 판정 뒤 addEmotionState 로 단계를 올린다.
 */
export function applyStateEffectsWithEmotion(
  project: Project,
  target: MutableBattler,
  effects: readonly DatabaseStateEffect[] | undefined,
  rng: Rng,
): InflictResult {
  const list = effects ?? [];
  const isEmotionAdd = (effect: DatabaseStateEffect) => effect.operation === "add" && stateEmotionOf(project, effect.stateId) !== undefined;
  if (!list.some(isEmotionAdd)) return applyStateEffects(project, target, list, rng);
  const added: string[] = [];
  const removed: string[] = [];
  for (const effect of list) {
    if (!isEmotionAdd(effect)) {
      const result = applyStateEffects(project, target, [effect], rng);
      added.push(...result.added);
      removed.push(...result.removed);
      continue;
    }
    const chance = (effect.chance * stateResistancePercent(project, target, effect.stateId)) / 100;
    // battleStates.rollPercent 와 같은 규칙: 100 이상은 굴리지 않고 성공, 0 이하는 굴리지 않고 실패.
    if (chance <= 0 || (chance < 100 && rng() * 100 >= chance)) continue;
    const result = addEmotionState(project, target, effect.stateId);
    added.push(...result.added);
    removed.push(...result.removed);
  }
  return { added, removed };
}

/** 약점 추가 행동 장부. 전투 하나에 하나 만든다. */
export interface WeaknessTracker {
  /** 아군 → 적 피해 명중 한 번. 약점을 새로 찔렀으면 true(이번 행동에 추가 행동을 예약). */
  noteHit(user: MutableBattler, target: MutableBattler, elementMultiplier: number, userIsActor: boolean): boolean;
  /** 배우가 새 행동을 시작한다 — 지난 행동에서 못 쓴 예약은 버린다. */
  beginAction(actorRecordId: string): void;
  /** 예약된 추가 행동을 하나 쓴다. */
  consume(actorRecordId: string): boolean;
  /** 적이 제 차례를 맞으면 일어선다. */
  standUp(enemyId: string): void;
  isDowned(enemyId: string): boolean;
}

export function createWeaknessTracker(project: Pick<Project, "system">): WeaknessTracker {
  const enabled = project.system.weaknessExtraAction === true;
  const downed = new Set<string>();
  const pending = new Map<string, number>();
  return {
    noteHit(user, target, elementMultiplier, userIsActor) {
      if (!enabled || !userIsActor || elementMultiplier <= 1 || downed.has(target.id)) return false;
      downed.add(target.id);
      // 한 행동에서 여러 적의 약점을 찔러도 추가 행동은 하나다(페르소나의 One More 는 행동당 한 번).
      if (!pending.has(user.recordId)) pending.set(user.recordId, 1);
      return true;
    },
    beginAction(actorRecordId) {
      pending.delete(actorRecordId);
    },
    consume(actorRecordId) {
      const remaining = pending.get(actorRecordId) ?? 0;
      if (remaining <= 0) return false;
      pending.delete(actorRecordId);
      return true;
    },
    standUp(enemyId) {
      downed.delete(enemyId);
    },
    isDowned(enemyId) {
      return downed.has(enemyId);
    },
  };
}
