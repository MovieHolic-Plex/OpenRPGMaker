import type { BattleResult } from "@/battle/runtime";
import type { BattleBattlerSnapshot, BattleCapturedMonsterSnapshot, BattleEventStateSnapshot, BattleRewardsSnapshot } from "@/battle/types";
import { computeActorLevelUp, computeTechPointLearning, type BattleLevelUpResult } from "@/battle/battleLevelUp";
import { computeApLearning } from "@/battle/battleEsperAp";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { classLearnedSkillIdsUpToLevel, effectiveActorClassId } from "@/project/sessionClass";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { expForRewardActor, monsterExpPlan, rewardActorIds } from "@/battle/rewardPolicy";
import { changeGold, type PlaySession } from "@/project/session";
import { setRelationshipState } from "@/project/relationshipState";
import { refreshGrowthVitals } from '@/project/growth/vitals';
import { monsterCampaign, recordMonsterSeen, recordMonsterCaught, monsterDexSpeciesIds } from "@/project/monsterJournal";
import { applyMonsterExperienceAndEvolution, giveMonster, monsterCurrentHp } from "@/project/monsterCollection";
import { addMonsterEvs, monsterStatRulesOf } from "@/project/monsterStatRules";
import type { Project } from "@/project/types";
import { transitionItemStates } from "@/project/itemTransitions";
import { statesKeptAfterBattle } from "@/project/battleEndStates";

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
  /** Captures and consumed balls commit together after cancellable presentation. */
  readonly capturedMonsters?: readonly BattleCapturedMonsterSnapshot[];
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
  project: Project,
): readonly BattleLevelUpResult[] {
  // RM2K3 관례: 승리/도주와 패배 분기 복귀 모두 전투 중 변경된 상태를 유지한다.
  // canLose=false 패배는 게임 오버 경로이므로 라이브 세션에 되돌려 쓰지 않는다.
  if (outcome.result === "victory" || outcome.result === "escape" || (outcome.result === "defeat" && outcome.canLose === true)) {
    // Transfer class, lineage and permanent skills before vitals. Never replay
    // arbitrary reclass: it would erase the earned promotion chain.
    const journal = monsterDexSpeciesIds(project).map((speciesId) => ({
      speciesId, seen: session.switches[`mx_seen_${speciesId}`] === true, caught: session.switches[`mx_caught_${speciesId}`] === true,
    }));
    applyBattleClassOverridesToSession(session, outcome.eventState);
    applyBattleVitalsToSession(session, outcome.actors ?? []);
    // 파티 몬스터가 싸운 경우, 전투 종료 HP를 인스턴스에 되돌려쓴다(경험치 가산보다 먼저).
    applyBattleMonsterVitalsToSession(session, outcome.actors ?? []);
    applyBattleStatesToSession(session, outcome.actors ?? [], project);
    applyBattleEventStateToSession(session, outcome.eventState);
    // The battle seeded its switch copy before first sighting; receipts are monotonic.
    for (const receipt of journal) {
      if (receipt.seen) recordMonsterSeen(project, session, receipt.speciesId);
      if (receipt.caught) recordMonsterCaught(project, session, receipt.speciesId);
    }
    // Campaign captures require a committed victory or escape; legacy games retain their policy.
    for (const capture of outcome.result === "defeat" && monsterCampaign(project) ? [] : outcome.capturedMonsters ?? []) {
      giveMonster(project, session, {
        speciesId: capture.speciesId, level: capture.level, caughtAt: capture.caughtAt,
        ivs: capture.ivs, currentHp: capture.currentHp, stateIds: capture.stateIds,
        stateTurns: capture.stateTurns, skillIds: capture.skillIds, skillPp: capture.skillPp, caughtBallId: capture.captureItemId,
      });
    }
    // Derived maxima follow final levels/class/growth, never stale battler maxima.
    // Restore battle damage first, then clamp without healing (before reward level-ups).
    const growthActorIds = new Set([
      ...Object.keys(outcome.eventState?.actorLevels ?? {}),
      ...Object.keys(outcome.eventState?.classOverrides ?? {}),
      ...Object.keys(outcome.eventState?.growthProgress ?? {}),
    ]);
    for (const actorId of growthActorIds) refreshGrowthVitals(project, session, actorId);
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
      // 시작 레벨이 1보다 높거나 중간에 합류한 동료는 누적 경험치가 0(또는 없음)으로 남아 있었다 — 그대로 더하면
      // 레벨 문턱에 영영 못 닿아 Lv6 파티가 보스를 잡아도 오르지 않았다(폴른 스타 가혹 검수). 현재 레벨의 바닥으로 올린 뒤 더한다.
      const record = project.database.actors.find((entry) => entry.id === actorId);
      const floor = record ? totalExpForLevel(normalizeActorRecord(record).expCurve, actorLevel) : 0;
      session.actorExperience[actorId] = Math.max(session.actorExperience[actorId] ?? 0, floor) + actorExp;
      if (processed.has(actorId)) continue;
      processed.add(actorId);
      const levelUp = applyActorLevelUp(session, project, actorId);
      if (levelUp) levelUps.push(levelUp);
    }
    applyTechPointsToSession(session, project, outcome, rewardActorIdList);
    applyEsperApToSession(session, project, outcome, rewardActorIdList);
    applyRageEnemiesToSession(session, project, outcome, rewardActorIdList);
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
  // 노력치(옵트인 system.monsterStatRules.evs): 승리한 참전 몬스터가 쓰러뜨린 적 종의 evYield 를 받는다. 경험치보다 먼저 쌓아 레벨업 때 새 능력치에 반영된다.
  if (outcome.monsterPartyMode === true && outcome.result === "victory" && outcome.rewards.monsterEvGain && monsterStatRulesOf(project).evs) {
    const gainers = (participantInstanceIds ?? session.monsterParty).filter((id) => session.monsterInstances[id] !== undefined);
    for (const id of gainers) {
      const instance = session.monsterInstances[id]!;
      session.monsterInstances[id] = { ...instance, evs: addMonsterEvs(instance.evs, outcome.rewards.monsterEvGain) };
    }
  }
  // 경험치 분배(system.rewardPolicy.expSplitAlive): 쓰러지지 않은 참전자만 총량을 나눠 받는다. 꺼져 있으면 plan 이 입력 그대로다.
  const aliveBattlerIds = new Set((outcome.actors ?? []).filter((actor) => actor.hp > 0).flatMap((actor) => [actor.recordId, ...(actor.monsterInstanceId ? [actor.monsterInstanceId] : [])]));
  const expPlan = outcome.monsterPartyMode === true
    ? monsterExpPlan(project.system.rewardPolicy, earnedExp, participantInstanceIds, aliveBattlerIds)
    : { exp: earnedExp, participantIds: participantInstanceIds };
  applyMonsterExperienceAndEvolution(project, session, expPlan.exp, expPlan.participantIds);
  // 경험치 나누기(system.rewardPolicy.expShare): 이번 전투에 나서지 않은 살아 있는 파티 몬스터도 절반을 받는다.
  if (project.system.rewardPolicy?.expShare === true && participantInstanceIds !== undefined && outcome.monsterPartyMode === true) {
    const taken = new Set(participantInstanceIds);
    const bench = session.monsterParty.filter((id) => !taken.has(id) && session.monsterInstances[id] !== undefined && monsterCurrentHp(project, session.monsterInstances[id]!) > 0);
    if (bench.length > 0) applyMonsterExperienceAndEvolution(project, session, Math.floor(expPlan.exp / 2), bench);
  }
  return levelUps;
}

// 기술 포인트: 살아남은 보상 대상 전원이 트룹 TP 합계를 받고, 문턱을 넘은 기술을 배운다.
// 레벨업 뒤에 돈다 — tp 항목의 level 조건은 이번 승리로 오른 레벨까지 본다. 저작된 TP 가 없으면 아무것도 쓰지 않는다.
function applyTechPointsToSession(
  session: PlaySession,
  project: Project,
  outcome: BattleRewardsOutcome,
  actorIds: readonly string[],
): void {
  const earnedTp = Math.max(0, Math.trunc(outcome.rewards.tp ?? 0));
  if (earnedTp <= 0) return;
  for (const actorId of new Set(actorIds)) {
    const vitals = session.actorVitals[actorId];
    const snapshot = (outcome.actors ?? []).find((actor) => actor.recordId === actorId);
    if ((vitals ? vitals.hp : snapshot?.hp ?? 1) <= 0) continue;
    session.actorTechPoints ??= {};
    const totalTp = (session.actorTechPoints[actorId] ?? 0) + earnedTp;
    session.actorTechPoints[actorId] = totalTp;
    const level = session.actorLevels[actorId] ?? 1;
    const known = [...(session.actorSkillIds[actorId] ?? []), ...(snapshot?.skillIds ?? [])];
    const learned = computeTechPointLearning(project, actorId, level, totalTp, known);
    if (learned.length > 0) session.actorSkillIds[actorId] = [...(session.actorSkillIds[actorId] ?? []), ...learned];
  }
}

// 마석 AP: 살아남은 보상 대상 전원이 트룹 AP 합계를 받아 장착한 마석의 apGrants 에 쌓고, 필요 AP 를 채운 스킬은
// 영구 습득한다(actorSkillIds + learnedViaAp). 장비를 벗어도 남는다. 저작된 AP 가 없으면 아무것도 쓰지 않는다.
function applyEsperApToSession(
  session: PlaySession,
  project: Project,
  outcome: BattleRewardsOutcome,
  actorIds: readonly string[],
): void {
  const earnedAp = Math.max(0, Math.trunc(outcome.rewards.ap ?? 0));
  if (earnedAp <= 0) return;
  for (const actorId of new Set(actorIds)) {
    const record = project.database.actors.find((actor) => actor.id === actorId);
    if (!record) continue;
    const vitals = session.actorVitals[actorId];
    const snapshot = (outcome.actors ?? []).find((actor) => actor.recordId === actorId);
    if ((vitals ? vitals.hp : snapshot?.hp ?? 1) <= 0) continue;
    const equipment = effectiveActorEquipment(project, normalizeActorRecord(record), session.actorEquipment?.[actorId], effectiveActorClassId(project, session, actorId));
    const known = [...(session.actorSkillIds[actorId] ?? []), ...(snapshot?.skillIds ?? [])];
    const result = computeApLearning(project, equipment, earnedAp, session.actorApProgress?.[actorId], known);
    if (Object.keys(result.progress).length > 0) (session.actorApProgress ??= {})[actorId] = result.progress;
    if (result.learned.length === 0) continue;
    const skillIds = result.learned.map((entry) => entry.skillId);
    session.actorSkillIds[actorId] = [...new Set([...(session.actorSkillIds[actorId] ?? []), ...skillIds])];
    const via = (session.learnedViaAp ??= {});
    via[actorId] = [...new Set([...(via[actorId] ?? []), ...skillIds])];
  }
}

// 폭주(가우): 폭주 기술을 아는 살아남은 배우가 이번 전투에서 쓰러뜨린 몬스터를 폭주 목록에 더한다(배우당 최대 64종).
function applyRageEnemiesToSession(
  session: PlaySession,
  project: Project,
  outcome: BattleRewardsOutcome,
  actorIds: readonly string[],
): void {
  const enemyIds = outcome.rewards.rageEnemyIds ?? [];
  if (enemyIds.length === 0) return;
  const rageSkillIds = new Set(project.database.skills.filter((skill) => skill.effect.kind === "rage").map((skill) => skill.id));
  if (rageSkillIds.size === 0) return;
  for (const actorId of new Set(actorIds)) {
    const vitals = session.actorVitals[actorId];
    const snapshot = (outcome.actors ?? []).find((actor) => actor.recordId === actorId);
    if ((vitals ? vitals.hp : snapshot?.hp ?? 1) <= 0) continue;
    const known = [...(session.actorSkillIds[actorId] ?? []), ...(snapshot?.skillIds ?? [])];
    if (!known.some((skillId) => rageSkillIds.has(skillId))) continue;
    const pool = (session.actorRageEnemyIds ??= {});
    pool[actorId] = [...new Set([...(pool[actorId] ?? []), ...enemyIds])].slice(0, 64);
  }
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
    // 열매는 쓰면 사라진다 — 전투 끝에 배틀러가 도구를 잃었으면 개체에서도 지운다(그 밖의 경우는 건드리지 않는다).
    const { heldItemId: carried, ...bare } = instance;
    const heldItem = carried && !actor.heldItemId ? {} : carried ? { heldItemId: carried } : {};
    session.monsterInstances[instanceId] = {
      ...bare,
      ...heldItem,
      currentHp: Math.max(0, Math.min(actor.maxHp, actor.hp)),
      stateIds: [...actor.stateIds],
      stateTurns: actor.stateTurns
        ? { ...actor.stateTurns }
        : Object.fromEntries(Object.entries(instance.stateTurns ?? {}).filter(([stateId]) => actor.stateIds.includes(stateId))),
      skillPp: actor.skillPp ? { ...actor.skillPp } : instance.skillPp,
    };
  }
}

function applyBattleStatesToSession(session: PlaySession, actors: readonly BattleBattlerSnapshot[], project: Project): void {
  session.actorStateIds ??= {};
  session.actorSkillPp ??= {};
  for (const actor of actors) {
    if (actor.monsterInstanceId) continue;
    // 전투 종료로 풀리는 상태(system.clearStatesAfterBattle · StateRecord.clearOnBattleEnd · removalCondition 「전투 종료」)는 넘기지 않는다.
    session.actorStateIds[actor.recordId] = statesKeptAfterBattle(project, actor.stateIds);
    if (actor.skillPp) session.actorSkillPp[actor.recordId] = { ...actor.skillPp };
  }
}

// Transfer authoritative battle state, never replay reclass: a promotion cycle may
// end at the same class while earning lineage and permanent skills in between.
function applyBattleClassOverridesToSession(
  session: PlaySession,
  eventState: BattleEventStateSnapshot | undefined
): void {
  if (!eventState) return;
  if (eventState.classOverrides) session.classOverrides = { ...eventState.classOverrides };
  if (eventState.promotionLineage !== undefined) session.promotionLineage = structuredClone(eventState.promotionLineage);
  if (eventState.growthProgress !== undefined) session.growthProgress = structuredClone(eventState.growthProgress);
  if (eventState.actorSkillIds) session.actorSkillIds = Object.fromEntries(Object.entries(eventState.actorSkillIds).map(([id, skills]) => [id, [...skills]]));
}

// 전투 이벤트 상태(아이템 소모, 전투 이벤트가 바꾼 스위치/변수/골드/파티/스킬)를 세션에 되돌려 쓴다.
// 전투 개시 때 세션에서 시드된 사본이므로 그대로 덮어써도 안전하다.
function applyBattleEventStateToSession(session: PlaySession, eventState: BattleEventStateSnapshot | undefined): void {
  if (!eventState) return;
  if (eventState.messageWindowSettings) session.messageWindowSettings = { ...eventState.messageWindowSettings };
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
  if (eventState.timerWrites) {
    for (const [timerId, seconds] of Object.entries(eventState.timerWrites)) session.timers[timerId] = seconds;
  } else if (eventState.timers) {
    // 진입 시점 사본 전잴를 되돌려 쓰는 옛 계약(구 스냅샷 핸들러 호환).
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
  actors: readonly BattleBattlerSnapshot[]
): void {
  for (const actor of actors) {
    const vitals = session.actorVitals[actor.recordId];
    if (!vitals) continue;
    session.actorVitals[actor.recordId] = {
      maxHp: actor.maxHp,
      maxMp: actor.maxMp,
      hp: Math.max(0, Math.min(actor.maxHp, actor.hp)),
      mp: Math.max(0, Math.min(actor.maxMp, actor.mp)),
    };
  }
}

// 액터 한 명의 레벨업을 세션에 반영: 레벨/능력치(현재치 보전 가산)/습득 스킬.
export function applyActorLevelUp(session: PlaySession, project: Project, actorId: string): BattleLevelUpResult | null {
  const currentLevel = session.actorLevels[actorId] ?? 1;
  const totalExp = session.actorExperience[actorId] ?? 0;
  const actorRecord = project.database.actors.find((actor) => actor.id === actorId);
  const equipment = actorRecord
    ? effectiveActorEquipment(project, normalizeActorRecord(actorRecord), session.actorEquipment?.[actorId], effectiveActorClassId(project, session, actorId))
    : undefined;
  const result = computeActorLevelUp(project, actorId, currentLevel, totalExp, { classOverrides: session.classOverrides, equipment });
  if (!result) return null;

  session.actorLevels[actorId] = result.toLevel;

  // 마석 레벨업 보너스는 영구 보너스(Change Parameters 와 같은 actorParamBonuses)로 적립한다 — 장비를 벗어도 남는다.
  // 최대치는 아래 vitals 가산과 이후 refreshGrowthVitals 가 같은 값으로 맞춘다.
  if (result.equipmentBonus) {
    session.actorParamBonuses ??= {};
    const bonuses = { ...(session.actorParamBonuses[actorId] ?? {}) };
    for (const key of ["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const) {
      const gain = result.equipmentBonus[key];
      if (gain) bonuses[key] = (bonuses[key] ?? 0) + gain;
    }
    session.actorParamBonuses[actorId] = bonuses;
  }

  // maxHp/maxMp 증가분만큼 최대치와 현재치를 함께 올린다(RM2K3: 증가분 가산).
  const vitals = session.actorVitals[actorId];
  if (vitals) {
    // Growing maximum HP must not revive a fallen participant.
    if (vitals.hp > 0) vitals.hp += result.maxHpGain;
    vitals.mp += result.maxMpGain;
    session.actorVitals[actorId] = {
      maxHp: vitals.maxHp + result.maxHpGain,
      maxMp: vitals.maxMp + result.maxMpGain,
      hp: Math.min(vitals.hp, vitals.maxHp + result.maxHpGain),
      mp: Math.min(vitals.mp, vitals.maxMp + result.maxMpGain),
    };
  }

  // 새로 배우는 직업/레벨 스킬을 세션 스킬 목록에 추가(중복 없이).
  // 직업 습득표가 주는 기술은 빼다 — 배틀러가 직업에서 매번 다시 계산한다(세션에 넣으면 직업을 바꿔도 남는다).
  const classTaught = new Set(classLearnedSkillIdsUpToLevel(project, effectiveActorClassId(project, session, actorId) ?? "", result.toLevel));
  const sessionLearned = result.learnedSkillIds.filter((skillId) => !classTaught.has(skillId));
  if (sessionLearned.length > 0) {
    const known = session.actorSkillIds[actorId] ?? [];
    const merged = [...known];
    for (const skillId of sessionLearned) {
      if (!merged.includes(skillId)) merged.push(skillId);
    }
    session.actorSkillIds[actorId] = merged;
  }

  return result;
}
