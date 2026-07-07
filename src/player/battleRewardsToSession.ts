import type { BattleResult } from "@/battle/runtime";
import type { BattleBattlerSnapshot, BattleEventStateSnapshot, BattleRewardsSnapshot } from "@/battle/types";
import { computeActorLevelUp, type BattleLevelUpResult } from "@/battle/battleLevelUp";
import { changeGold, changeItem, type PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type BattleRewardsOutcome = {
  readonly result: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
  // 전투 종료 시점 아군 배틀러 스냅샷. 전투 중 소모/피해가 필드 세션 HP/MP로 이어지도록 반영한다.
  readonly actors?: readonly BattleBattlerSnapshot[];
  // 전투 종료 시점 스위치/변수/인벤토리(전투 개시 때 세션에서 시드됨).
  // 전투 중 아이템 소모와 전투 이벤트의 스위치/변수 변경을 세션에 되돌려 쓴다.
  readonly eventState?: BattleEventStateSnapshot;
};

// 승리 보상을 세션에 적립하고, 누적 경험치 기준 자동 레벨업을 판정/반영한다.
// 반환값은 발생한 레벨업 목록(결과 화면 연출/후속 메시지용). 비승리면 빈 배열.
export function applyBattleRewardsToSession(
  session: PlaySession,
  outcome: BattleRewardsOutcome,
  project: Project
): readonly BattleLevelUpResult[] {
  // RM2K3 관례: 승리/도주 모두 전투에서 입은 피해와 MP 소모가 필드로 유지된다.
  if (outcome.result === "victory" || outcome.result === "escape") {
    applyBattleVitalsToSession(session, outcome.actors ?? []);
    applyBattleStatesToSession(session, outcome.actors ?? []);
    applyBattleEventStateToSession(session, outcome.eventState);
  }
  if (outcome.result !== "victory") return [];
  const earnedExp = Math.max(0, Math.trunc(outcome.rewards.exp));
  const levelUps: BattleLevelUpResult[] = [];
  const processed = new Set<string>();
  for (const actorId of session.partyActorIds) {
    session.actorExperience[actorId] = (session.actorExperience[actorId] ?? 0) + earnedExp;
    if (processed.has(actorId)) continue;
    processed.add(actorId);
    const levelUp = applyActorLevelUp(session, project, actorId);
    if (levelUp) levelUps.push(levelUp);
  }
  changeGold(session, "+=", Math.max(0, Math.trunc(outcome.rewards.gold)));
  for (const itemId of outcome.rewards.items) {
    changeItem(session, itemId, "+=", 1);
  }
  return levelUps;
}

function applyBattleStatesToSession(session: PlaySession, actors: readonly BattleBattlerSnapshot[]): void {
  session.actorStateIds ??= {};
  for (const actor of actors) {
    session.actorStateIds[actor.recordId] = [...actor.stateIds];
  }
}

// 전투 이벤트 상태(아이템 소모, 전투 이벤트가 바꾼 스위치/변수)를 세션에 되돌려 쓴다.
// 전투 개시 때 세션에서 시드된 사본이므로 그대로 덮어써도 안전하다.
function applyBattleEventStateToSession(session: PlaySession, eventState: BattleEventStateSnapshot | undefined): void {
  if (!eventState) return;
  for (const [key, value] of Object.entries(eventState.switches)) session.switches[key] = value;
  for (const [key, value] of Object.entries(eventState.variables)) session.variables[key] = value;
  for (const [key, value] of Object.entries(eventState.inventory)) session.inventory[key] = value;
}

// 전투 종료 시점의 아군 HP/MP를 세션 바이탈에 되돌려 쓴다(레벨업 가산 이전에 수행).
function applyBattleVitalsToSession(session: PlaySession, actors: readonly BattleBattlerSnapshot[]): void {
  for (const actor of actors) {
    const vitals = session.actorVitals[actor.recordId];
    if (!vitals) continue;
    session.actorVitals[actor.recordId] = {
      ...vitals,
      hp: Math.max(0, Math.min(vitals.maxHp, actor.hp)),
      mp: Math.max(0, Math.min(vitals.maxMp, actor.mp)),
    };
  }
}

// 액터 한 명의 레벨업을 세션에 반영: 레벨/능력치(현재치 보전 가산)/습득 스킬.
function applyActorLevelUp(session: PlaySession, project: Project, actorId: string): BattleLevelUpResult | null {
  const currentLevel = session.actorLevels[actorId] ?? 1;
  const totalExp = session.actorExperience[actorId] ?? 0;
  const result = computeActorLevelUp(project, actorId, currentLevel, totalExp);
  if (!result) return null;

  session.actorLevels[actorId] = result.toLevel;

  // maxHp/maxMp 증가분만큼 최대치와 현재치를 함께 올린다(RM2K3: 증가분 가산).
  const vitals = session.actorVitals[actorId];
  if (vitals) {
    vitals.hp += result.maxHpGain;
    vitals.mp += result.maxMpGain;
    session.actorVitals[actorId] = {
      maxHp: vitals.maxHp + result.maxHpGain,
      maxMp: vitals.maxMp + result.maxMpGain,
      hp: Math.min(vitals.hp, vitals.maxHp + result.maxHpGain),
      mp: Math.min(vitals.mp, vitals.maxMp + result.maxMpGain),
    };
  }

  // 새로 배우는 직업/레벨 스킬을 세션 스킬 목록에 추가(중복 없이).
  if (result.learnedSkillIds.length > 0) {
    const known = session.actorSkillIds[actorId] ?? [];
    const merged = [...known];
    for (const skillId of result.learnedSkillIds) {
      if (!merged.includes(skillId)) merged.push(skillId);
    }
    session.actorSkillIds[actorId] = merged;
  }

  return result;
}
