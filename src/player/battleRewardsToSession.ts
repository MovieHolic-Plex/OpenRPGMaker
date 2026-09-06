import type { BattleResult } from "@/battle/runtime";
import type { BattleBattlerSnapshot, BattleEventStateSnapshot, BattleRewardsSnapshot } from "@/battle/types";
import { computeActorLevelUp, type BattleLevelUpResult } from "@/battle/battleLevelUp";
import { expForRewardActor, rewardActorIds } from "@/battle/rewardPolicy";
import { changeGold, type PlaySession } from "@/project/session";
import { setRelationshipState } from "@/project/relationshipState";
import { changeActorClass } from "@/project/sessionClass";
import { applyMonsterExperienceAndEvolution } from "@/project/monsterCollection";
import type { Project } from "@/project/types";
import { transitionItemStates } from "@/project/itemTransitions";

export type BattleRewardsOutcome = {
  readonly result: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
  /** Defeat returns to the live session only when the battle was authored as losable. */
  readonly canLose?: boolean;
  // 전투 종료 시점 아군 배틀러 스냅샷. 전투 중 소모/피해가 필드 세션 HP/MP로 이어지도록 반영한다.
  readonly actors?: readonly BattleBattlerSnapshot[];
  // 전투 종료 시점 스위치/변수/인벤토리(전투 개시 때 세션에서 시드됨).
  // 전투 중 아이템 소모와 전투 이벤트의 스위치/변수 변경을 세션에 되돌려 쓴다.
  readonly eventState?: BattleEventStateSnapshot;
  readonly participatingActorIds?: readonly string[];
  // 옵션 A 몬스터 전투 모드였는지. true면 액터 exp/레벨업 루프를 건너뛴다
  // (전투에 나간 건 몬스터라 영웅에게 exp 를 주면 안 됨). 몬스터 exp 는 아래 기존 경로 유지.
  readonly monsterPartyMode?: boolean;
};

// 승리 보상을 세션에 적립하고, 누적 경험치 기준 자동 레벨업을 판정/반영한다.
// 반환값은 발생한 레벨업 목록(결과 화면 연출/후속 메시지용). 비승리면 빈 배열.
export function applyBattleRewardsToSession(
  session: PlaySession,
  outcome: BattleRewardsOutcome,
  project: Project
): readonly BattleLevelUpResult[] {
  // RM2K3 관례: 승리/도주와 패배 분기 복귀 모두 전투 중 변경된 상태를 유지한다.
  // canLose=false 패배는 게임 오버 경로이므로 라이브 세션에 되돌려 쓰지 않는다.
  if (outcome.result === "victory" || outcome.result === "escape" || (outcome.result === "defeat" && outcome.canLose === true)) {
    // 전직(promoteActor) write-back 은 바이탈 write-back 보다 먼저 — changeActorClass 가
    // 세션 바이탈 최대치를 새 클래스 곡선으로 갱신해야 아래 전투 HP/MP 클램프가 새 최대치를 쓴다.
    applyBattleClassOverridesToSession(session, project, outcome.eventState);
    applyBattleVitalsToSession(session, outcome.actors ?? [], outcome.eventState);
    // 파티 몬스터가 싸운 경우, 전투 종료 HP를 인스턴스에 되돌려쓴다(경험치 가산보다 먼저).
    applyBattleMonsterVitalsToSession(session, outcome.actors ?? []);
    applyBattleStatesToSession(session, outcome.actors ?? []);
    applyBattleEventStateToSession(session, outcome.eventState);
  }
  if (outcome.result !== "victory") return [];
  const earnedExp = Math.max(0, Math.trunc(outcome.rewards.exp));
  const levelUps: BattleLevelUpResult[] = [];
  // 몬스터 전투 모드에서는 액터가 출전하지 않았으므로 영웅 exp/레벨업을 적립하지 않는다.
  // (몬스터 exp 는 아래 applyMonsterExperienceAndEvolution 이 담당 — 기존 경로 유지.)
  if (outcome.monsterPartyMode !== true) {
    const processed = new Set<string>();
    const rewardActorIdList = rewardActorIds(project, session.partyActorIds, outcome.participatingActorIds);
    for (const actorId of rewardActorIdList) {
      const actorLevel = session.actorLevels[actorId] ?? 1;
      const actorExp = expForRewardActor(earnedExp, actorLevel, outcome.rewards.enemyLevel, project.system.rewardPolicy);
      session.actorExperience[actorId] = (session.actorExperience[actorId] ?? 0) + actorExp;
      if (processed.has(actorId)) continue;
      processed.add(actorId);
      const levelUp = applyActorLevelUp(session, project, actorId);
      if (levelUp) levelUps.push(levelUp);
    }
  }
  changeGold(session, "+=", Math.max(0, Math.trunc(outcome.rewards.gold)));
  const itemState = transitionItemStates(
    { inventory: session.inventory, itemUseCharges: session.itemUseCharges },
    project.database.items,
    outcome.rewards.items.map((itemId) => ({ kind: "grant" as const, itemId, amount: 1 })),
  );
  session.inventory = itemState.inventory;
  session.itemUseCharges = itemState.itemUseCharges;
  // 몬스터 배틀에서는 명시적 참가자만, 일반 액터 배틀에서는 기존대로 동행 몬스터 전원이 EXP를 받는다.
  // Older callers without participation metadata retain the legacy actor-snapshot fallback.
  const snapshotInstanceIds = (outcome.actors ?? [])
    .map((actor) => actor.monsterInstanceId)
    .filter((id): id is string => typeof id === "string");
  const participantInstanceIds = outcome.monsterPartyMode === true && outcome.participatingActorIds !== undefined
    ? outcome.participatingActorIds.filter((id) => session.monsterInstances[id] !== undefined)
    : snapshotInstanceIds.length > 0
      ? snapshotInstanceIds
      : undefined;
  applyMonsterExperienceAndEvolution(project, session, earnedExp, participantInstanceIds);
  return levelUps;
}

// 파티 몬스터 배틀러의 전투 종료 HP를 세션 인스턴스의 currentHp로 되돌려쓴다.
function applyBattleMonsterVitalsToSession(session: PlaySession, actors: readonly BattleBattlerSnapshot[]): void {
  session.monsterInstances ??= {};
  for (const actor of actors) {
    const instanceId = actor.monsterInstanceId;
    if (!instanceId) continue;
    const instance = session.monsterInstances[instanceId];
    if (!instance) continue;
    if (session.actorStateIds) delete session.actorStateIds[instanceId];
    session.monsterInstances[instanceId] = {
      ...instance,
      currentHp: Math.max(0, Math.min(actor.maxHp, actor.hp)),
      stateIds: [...actor.stateIds],
      stateTurns: actor.stateTurns
        ? { ...actor.stateTurns }
        : Object.fromEntries(Object.entries(instance.stateTurns ?? {}).filter(([stateId]) => actor.stateIds.includes(stateId))),
      skillPp: actor.skillPp ? { ...actor.skillPp } : instance.skillPp,
    };
  }
}

function applyBattleStatesToSession(session: PlaySession, actors: readonly BattleBattlerSnapshot[]): void {
  session.actorStateIds ??= {};
  session.actorSkillPp ??= {};
  for (const actor of actors) {
    if (actor.monsterInstanceId) continue;
    session.actorStateIds[actor.recordId] = [...actor.stateIds];
    if (actor.skillPp) session.actorSkillPp[actor.recordId] = { ...actor.skillPp };
  }
}

// 전투 중 promoteActor 가 갱신한 직업 오버라이드를 세션에 반영한다(Step 3d 2026-08-20).
// 시드값과 같은 항목은 건너뛰고, 바뀐 액터만 맵 경로와 동일한 changeActorClass 로 적용해
// 세션 classOverrides/클래스 스킬 학습/바이탈 클램프를 한 번에 맞춘다.
function applyBattleClassOverridesToSession(
  session: PlaySession,
  project: Project,
  eventState: BattleEventStateSnapshot | undefined
): void {
  if (!eventState?.classOverrides) return;
  for (const [actorId, classId] of Object.entries(eventState.classOverrides)) {
    if (session.classOverrides?.[actorId] === classId) continue;
    changeActorClass(session, project, actorId, classId);
  }
}

// 전투 이벤트 상태(아이템 소모, 전투 이벤트가 바꾼 스위치/변수/골드/파티/스킬)를 세션에 되돌려 쓴다.
// 전투 개시 때 세션에서 시드된 사본이므로 그대로 덮어써도 안전하다.
function applyBattleEventStateToSession(session: PlaySession, eventState: BattleEventStateSnapshot | undefined): void {
  if (!eventState) return;
  for (const [key, value] of Object.entries(eventState.switches)) session.switches[key] = value;
  for (const [key, value] of Object.entries(eventState.variables)) session.variables[key] = value;
  // 셀프 스위치: 스위치/변수와 동일한 RM2K3 관례 — 승리/도주/losable 패배 복귀 모두
  // 전투 이벤트가 바꾼 상태를 유지한다(canLose=false 패배는 게임 오버라 호출 자체가 없음).
  // 전투 개시 때 세션에서 시드된 사본이므로 이벤트 단위로 키를 병합해 되돌려 쓴다.
  if (eventState.selfSwitches) {
    session.selfSwitches ??= {};
    for (const [eventId, keys] of Object.entries(eventState.selfSwitches)) {
      session.selfSwitches[eventId] = { ...session.selfSwitches[eventId], ...keys };
    }
  }
  // 레거시 호환 flags / 타이머 잔여 초: 셀프 스위치와 같은 병합 write-back 패턴(Step 3 2026-08-20).
  if (eventState.flags) {
    for (const [key, value] of Object.entries(eventState.flags)) session.flags[key] = value;
  }
  if (eventState.timers) {
    for (const [timerId, seconds] of Object.entries(eventState.timers)) session.timers[timerId] = seconds;
  }
  // 관계 상태: 셀프 스위치와 같은 병합 write-back. 이게 없으면 트룹 페이지의 setRelationship 이
  // 버려지는 사본만 바꾸고 전투가 끝나면 사라져 troop:"full" 보증이 거짓이 된다.
  // 전투가 쓴 키만 되돌린다. setRelationshipState 를 지나야 single 이 삭제로 반영돼
  // 맵 경로와 저장 정규화기(single 을 저장하지 않음)와 어긋나지 않는다.
  if (eventState.relationships) {
    for (const [key, state] of Object.entries(eventState.relationships)) {
      setRelationshipState(session, key, state);
    }
  }
  for (const [key, value] of Object.entries(eventState.friendship ?? {})) {
    session.friendship ??= {};
    session.friendship[key] = value;
  }
  // 전투 중 changeEquipment 오버레이 write-back(Step 3d): 시드가 세션 사본이라 액터 단위
  // 병합이 idempotent 하다. 장비 전이의 인벤토리 증감은 아래 inventory 덮어쓰기에 포함된다.
  if (eventState.actorEquipment) {
    session.actorEquipment ??= {};
    for (const [actorId, equipment] of Object.entries(eventState.actorEquipment)) {
      session.actorEquipment[actorId] = { ...equipment };
    }
  }
  session.inventory = { ...eventState.inventory };
  session.itemUseCharges = { ...(eventState.itemUseCharges ?? {}) };
  if (typeof eventState.gold === "number") session.gold = Math.max(0, Math.trunc(eventState.gold));
  if (eventState.partyActorIds) session.partyActorIds = [...eventState.partyActorIds];
  if (eventState.actorSkillIds) {
    session.actorSkillIds ??= {};
    for (const [actorId, skills] of Object.entries(eventState.actorSkillIds)) {
      session.actorSkillIds[actorId] = [...skills];
    }
  }
  if (eventState.actorExperience) {
    for (const [actorId, exp] of Object.entries(eventState.actorExperience)) {
      session.actorExperience[actorId] = Math.max(0, Math.trunc(exp));
    }
  }
  if (eventState.actorLevels) {
    for (const [actorId, level] of Object.entries(eventState.actorLevels)) {
      session.actorLevels[actorId] = Math.max(1, Math.min(99, Math.trunc(level)));
    }
  }
}

// 전투 종료 시점의 아군 HP/MP를 세션 바이탈에 되돌려 쓴다(레벨업 가산 이전에 수행).
function applyBattleVitalsToSession(
  session: PlaySession,
  actors: readonly BattleBattlerSnapshot[],
  eventState: BattleEventStateSnapshot | undefined
): void {
  for (const actor of actors) {
    const vitals = session.actorVitals[actor.recordId];
    if (!vitals) continue;
    const level = eventState?.actorLevels?.[actor.recordId];
    const levelChanged = level !== undefined && level !== (session.actorLevels[actor.recordId] ?? 1);
    const maxHp = levelChanged ? actor.maxHp : vitals.maxHp;
    const maxMp = levelChanged ? actor.maxMp : vitals.maxMp;
    session.actorVitals[actor.recordId] = {
      ...vitals,
      maxHp,
      maxMp,
      hp: Math.max(0, Math.min(maxHp, actor.hp)),
      mp: Math.max(0, Math.min(maxMp, actor.mp)),
    };
  }
}

// 액터 한 명의 레벨업을 세션에 반영: 레벨/능력치(현재치 보전 가산)/습득 스킬.
export function applyActorLevelUp(session: PlaySession, project: Project, actorId: string): BattleLevelUpResult | null {
  const currentLevel = session.actorLevels[actorId] ?? 1;
  const totalExp = session.actorExperience[actorId] ?? 0;
  const result = computeActorLevelUp(project, actorId, currentLevel, totalExp, { classOverrides: session.classOverrides });
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
