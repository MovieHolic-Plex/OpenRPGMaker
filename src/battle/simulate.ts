// battle/simulate.ts
// 전투 런타임(createBattleRuntime — 순수 TS)을 DOM 없이 N회 구동하는 헤드리스 시뮬레이터.
// 간단 AI: 평타 + HP 30% 이하일 때 회복 아이템 사용. 시드 고정 시 재현 가능.
//
import { actorBattlers } from "@/battle/battleBattlers";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { computeGen1BaseDamage, usesGen1Damage } from "@/battle/battleDamage";
import { headlessBattleSnapshot, createBattleRuntime } from "@/battle/runtime";
import type { ActorCommand, BattleCapturedMonsterSnapshot, BattleEventLogSnapshot, BattleFlow, BattleRewardsSnapshot, BattleRoundLogSnapshot, BattleRuntimeOptions, BattleSnapshot, BattleTimelineEntrySnapshot } from "@/battle/types";
import type { Project, SkillId, ItemId } from "@/project/types";
import type { MonsterInstance } from "@/project/session";
import { mulberry32, type Rng } from "@/util/rng";

export interface StrictBattleScriptCommand {
  readonly actorId: string;
  readonly command: "attack" | "skill" | "item" | "capture" | "guard" | "defend" | "escape" | "switch";
  readonly skillId?: SkillId;
  readonly itemId?: ItemId;
  readonly captureItemId?: ItemId;
  readonly target?: string;
  readonly switchActorId?: string;
}

export interface SimulateBattleInput {
  readonly project: Project;
  readonly troopId: string;
  readonly heroLevel: number;
  readonly inventory?: Record<string, number>;
  readonly partyActorIds?: readonly string[];
  // 몬스터 전투 모드(옵션 A): 값이 있고 비어있지 않으면 영웅 대신 이 몬스터 파티로 전투한다.
  // strictScript 의 actorId 는 몬스터의 instanceId 를 쓴다(recordId=instanceId).
  readonly monsterParty?: readonly MonsterInstance[];
  // 저HP(≤30%) 시 AI가 사용할 회복 아이템 id. 없으면 아이템을 쓰지 않는다.
  readonly potionItemId?: string;
  readonly n?: number;
  readonly seed?: number;
  readonly battleFlow?: BattleFlow;
  readonly activeSlots?: number;
  readonly strictScript?: readonly (readonly StrictBattleScriptCommand[])[];
  /**
   * true 면 아군이 자동 전투 AI(기술·회복·연계기)로 행동한다. 기본(false)은 통상 공격 + 회복약만이라
   * 기술 밸런스·연계기를 시험할 수 없다. gen1 모델은 항상 이 AI 를 쓴다.
   */
  readonly useSkills?: boolean;
  readonly maxSteps?: number; // 무한 루프 방지 tick 상한(기본 4000)
  // 프로덕션(playSceneBattle)과 동일 계약: 전투를 기동한 맵 이벤트 id.
  // 트룹 배틀 이벤트의 selfSwitch 조건/setSelfSwitch 커맨드의 소유 이벤트.
  readonly ownerEventId?: string;
  // 세션 셀프 스위치 시드(eventId → key → on)와 직전 전투 결과 시드.
  readonly selfSwitches?: Readonly<Record<string, Readonly<Partial<Record<string, boolean>>>>>;
  readonly battleResult?: "victory" | "defeat" | "escape";
  /** 켜 둔 채 시작할 스위치 id(선택 결과에 걸린 페이지·손님 시험). 생략 = 모두 꺼짐. */
  readonly switchesOn?: readonly string[];
  /** 영웅 파티 모두가 걸린 채 시작할 상태 id(앞 전투에서 남은 독처럼 전투 뒤에도 유지되는 상태). 생략 = 없음. */
  readonly startStateIds?: readonly string[];
}

/**
 * 트룹 전투 이벤트 페이지(= 보스 페이즈)가 **실제로 발동했는지**의 n판 합산 집계.
 *
 * `eventLogs` 는 첫 판(i===0)만 보관하므로 "50판 중 한 번도 안 뜬 연출" 이 보이지 않았다.
 * 저작자가 페이즈를 넣는 이유는 그것이 전투 중에 뜨는 것이므로, 발동 여부는 승률과 같은 급의
 * 1차 지표다. 한 번도 발동하지 않은 페이지(firedRuns=0)는 조건이 도달 불가하다는 뜻이다.
 */
export interface BattlePhaseCoverage {
  readonly pageId: string;
  readonly name: string;
  /** 이 페이지가 최소 1회 발동한 판 수(0 = 한 번도 안 뜬 연출). */
  readonly firedRuns: number;
  /** 발동 라운드의 최솟값. 한 번도 발동하지 않았으면 없음. */
  readonly firstRound?: number;
  /** 이 페이지에서 런타임이 처리하지 못한(unsupported) 커맨드 로그 수. */
  readonly unsupported: number;
}

export interface SimulateBattleResult {
  readonly winRate: number;
  /** 결투 규칙(TroopRecord.duel) 부대만: 판별 결과 횟수 — 항복·판정패는 defeat, 기권·동점 판정은 escape 로 센다. */
  readonly outcomes?: { readonly victory: number; readonly defeat: number; readonly escape: number; readonly undecided: number };
  readonly avgTurns: number; // 아군 행동 결정 횟수 평균(≈ 처치까지 걸린 타)
  readonly avgPotionsUsed: number;
  readonly avgHpRemaining: number; // 종료 시 파티 총 HP 평균
  readonly samples: number;
  readonly battleFlow: BattleFlow;
  readonly participatingActorIds: readonly string[];
  readonly roundLogs: readonly BattleRoundLogSnapshot[];
  readonly eventLogs: readonly BattleEventLogSnapshot[];
  readonly capturedMonsters: readonly BattleCapturedMonsterSnapshot[];
  readonly capturedCount: number;
  /** 아군이 쓴 기술별 총 횟수(n판 합계, 통상 공격 제외). useSkills 일 때만 의미가 있다. */
  readonly skillUses: Readonly<Record<string, number>>;
  readonly firstRewards?: BattleRewardsSnapshot;
  /** 트룹의 전투 이벤트 페이지 전부(발동 0회 포함). 페이지가 없으면 빈 배열. */
  readonly phaseCoverage: readonly BattlePhaseCoverage[];
  /** 힘 모으기(chargeTurns) 시작·충전 끊기(chargeBreak) 횟수(n판 합계, 적·아군 모두). 모으는 기술이 없으면 0. */
  readonly chargeBreaks: ChargeBreakTally;
}

export interface ChargeBreakTally {
  readonly started: number;
  readonly broken: number;
  /** 기술 id 별 { started, broken }. */
  readonly bySkill: Readonly<Record<string, { readonly started: number; readonly broken: number }>>;
}

function tallyChargeBreaks(timeline: readonly BattleTimelineEntrySnapshot[], into: Record<string, { started: number; broken: number }>): void {
  for (const entry of timeline) {
    if (!entry.chargeSkillId || (!entry.chargeStart && !entry.chargeBroken)) continue;
    const row = (into[entry.chargeSkillId] ??= { started: 0, broken: 0 });
    if (entry.chargeStart) row.started += 1;
    if (entry.chargeBroken) row.broken += 1;
  }
}

interface SingleRunResult {
  readonly victory: boolean;
  readonly result: BattleSnapshot["result"];
  readonly turns: number;
  readonly potionsUsed: number;
  readonly hpRemaining: number;
  readonly participatingActorIds: readonly string[];
  readonly roundLogs: readonly BattleRoundLogSnapshot[];
  readonly eventLogs: readonly BattleEventLogSnapshot[];
  readonly capturedMonsters: readonly BattleCapturedMonsterSnapshot[];
  readonly rewards: BattleRewardsSnapshot;
  readonly skillUses: Readonly<Record<string, number>>;
  readonly timeline: readonly BattleTimelineEntrySnapshot[];
}

// 회복 아이템을 가진 저HP 액터가 아이템을 쓰도록 하는 간단 AI로 한 판을 구동한다.
function runSingleBattle(input: SimulateBattleInput, rng: Rng): SingleRunResult {
  const inventory: Record<string, number> = { ...(input.inventory ?? {}) };
  const partyActorIds = input.partyActorIds ?? input.project.session.partyActorIds;
  const levels: Record<string, number> = {};
  for (const actorId of partyActorIds) levels[actorId] = input.heroLevel;
  const capturedMonsters: BattleCapturedMonsterSnapshot[] = [];
  const monsterMode = (input.monsterParty?.length ?? 0) > 0;
  // SC9 (M3): do NOT mutate the caller's project. Save the original system flags
  // and restore them after the run so the caller's project stays intact.
  const savedSystem = monsterMode
    ? { battleParty: input.project.system.battleParty, monsterBattleParty: input.project.system.monsterBattleParty, monsterCollection: input.project.system.monsterCollection }
    : undefined;
  if (monsterMode) {
    input.project.system.battleParty = "monsters";
    input.project.system.monsterBattleParty = true;
    input.project.system.monsterCollection = true;
  }

  const options: BattleRuntimeOptions = {
    project: input.project,
    troopId: input.troopId,
    canEscape: false,
    canLose: true,
    battleFlow: input.battleFlow,
    activeSlots: input.activeSlots,
    party: monsterMode
      ? { levels: {}, experience: {}, monsterParty: input.monsterParty, partyActorIds: input.monsterParty!.map((m) => m.instanceId) }
      : { levels, experience: {}, partyActorIds: [...partyActorIds], ...(input.startStateIds?.length ? { stateIds: Object.fromEntries(partyActorIds.map((id) => [id, [...input.startStateIds!]])) } : {}) },
    partyMonsters: monsterMode ? input.monsterParty : undefined,
    ownerEventId: input.ownerEventId,
    sessionState: { switches: Object.fromEntries((input.switchesOn ?? []).map((id) => [id, true])), variables: {}, inventory, selfSwitches: input.selfSwitches, battleResult: input.battleResult },
    captureLocation: { mapId: input.project.startMapId, x: input.project.startPos.x, y: input.project.startPos.y },
    onMonsterCaptured: (capture) => {
      capturedMonsters.push(capture);
    },
    rng,
  };

  try {
    const rt = createBattleRuntime(options);
    const maxSteps = input.maxSteps ?? 4000;
    let turns = 0;
    let potionsUsed = 0;
    const skillUses: Record<string, number> = {};

    for (let step = 0; step < maxSteps; step += 1) {
      const snap = headlessBattleSnapshot(rt);
      if (snap.result) break;
      if (snap.phase === "actorCommand") {
        const actor = snap.actors.find((entry) => entry.recordId === snap.activeActorId);
        const enemy = snap.enemies.find((entry) => !entry.defeated && entry.hp > 0);
        const scripted = strictScriptCommand(input, snap);
        if (scripted) {
          turns += 1;
          rt.performActorCommand(scripted);
          if (scripted.kind === "item") potionsUsed += 1;
          continue;
        }
        if (snap.forcedSwitchActorId && snap.switchCandidateActorIds[0]) {
          rt.performActorCommand({ kind: "switch", targetActorId: snap.switchCandidateActorIds[0] });
          continue;
        }
        if (!enemy) {
          rt.tick(1000);
          continue;
        }
        turns += 1;
        const lowHp = actor !== undefined && actor.hp <= actor.maxHp * 0.3;
        const hasPotion = input.potionItemId !== undefined && (snap.eventState.inventory[input.potionItemId] ?? 0) > 0;
        if (lowHp && hasPotion && input.potionItemId) {
          rt.performActorCommand({ kind: "item", itemId: input.potionItemId, targetEnemyId: enemy.id });
          potionsUsed += 1;
        } else {
          const command = input.project.system.battleModel === "gen1" || input.useSkills
            ? chooseAutoBattleCommand(input.project, snap, rng)
            : undefined;
          if (command?.kind === "skill") skillUses[command.skillId] = (skillUses[command.skillId] ?? 0) + 1;
          rt.performActorCommand(command ?? { kind: "attack", targetEnemyId: enemy.id });
        }
      } else {
        rt.tick(1000);
      }
    }

    const final = headlessBattleSnapshot(rt);
    const hpRemaining = [...final.actors, ...final.reserveActors].reduce((sum, entry) => sum + Math.max(0, entry.hp), 0);
    return {
      victory: final.result === "victory",
      result: final.result,
      turns,
      potionsUsed,
      hpRemaining,
      participatingActorIds: final.participatingActorIds,
      roundLogs: final.roundLogs,
      eventLogs: final.eventLogs,
      capturedMonsters,
      rewards: final.rewards,
      skillUses,
      timeline: final.timeline,
    };
  } finally {
    if (savedSystem) {
      input.project.system.battleParty = savedSystem.battleParty;
      input.project.system.monsterBattleParty = savedSystem.monsterBattleParty;
      input.project.system.monsterCollection = savedSystem.monsterCollection;
    }
  }
}

function strictScriptCommand(input: SimulateBattleInput, snapshot: BattleSnapshot): ActorCommand | undefined {
  if (snapshot.battleFlow !== "strict" || !snapshot.activeActorId) return undefined;
  const round = input.strictScript?.[snapshot.turn] ?? [];
  const entry = round.find((command) => command.actorId === snapshot.activeActorId);
  if (!entry) return undefined;
  const targetEnemyId = resolveScriptTarget(snapshot, entry.target);
  switch (entry.command) {
    case "attack":
      return { kind: "attack", targetEnemyId };
    case "skill":
      return entry.skillId ? { kind: "skill", skillId: entry.skillId, targetEnemyId } : { kind: "attack", targetEnemyId };
    case "item":
      return entry.itemId ? { kind: "item", itemId: entry.itemId, targetEnemyId } : { kind: "attack", targetEnemyId };
    case "capture": {
      const captureItemId = entry.captureItemId ?? entry.itemId;
      return captureItemId ? { kind: "capture", captureItemId, targetEnemyId } : { kind: "attack", targetEnemyId };
    }
    case "guard":
    case "defend":
      return { kind: "defend" };
    case "escape":
      return { kind: "escape" };
    case "switch": {
      const targetActorId = entry.switchActorId ?? entry.target;
      return targetActorId ? { kind: "switch", targetActorId } : undefined;
    }
  }
}

function resolveScriptTarget(snapshot: BattleSnapshot, target: string | undefined): string {
  const enemies = snapshot.enemies.filter((enemy) => !enemy.defeated && enemy.hp > 0);
  return enemies.find((enemy) => enemy.id === target || enemy.recordId === target)?.id
    ?? enemies[0]?.id
    ?? target
    ?? "";
}

// N회 시뮬레이션 후 승률/평균 지표를 반환한다.
export function simulateBattle(input: SimulateBattleInput): SimulateBattleResult {
  const n = Math.max(1, input.n ?? 50);
  const rng = mulberry32(input.seed ?? 1);
  let wins = 0;
  const outcomes = { victory: 0, defeat: 0, escape: 0, undecided: 0 };
  let totalTurns = 0;
  let totalPotions = 0;
  let totalHp = 0;
  let roundLogs: readonly BattleRoundLogSnapshot[] = [];
  let eventLogs: readonly BattleEventLogSnapshot[] = [];
  let participatingActorIds: readonly string[] = [];
  let capturedMonsters: readonly BattleCapturedMonsterSnapshot[] = [];
  let capturedCount = 0;
  const skillUses: Record<string, number> = {};
  const chargeBySkill: Record<string, { started: number; broken: number }> = {};
  let firstRewards: BattleRewardsSnapshot | undefined;
  // 페이즈 발동은 판마다 다르다(HP 임계 조건은 그 판의 진행에 달렸다) — n판 전부를 합산한다.
  const firedRuns = new Map<string, number>();
  const firstFiredRound = new Map<string, number>();
  const unsupportedByPage = new Map<string, number>();
  for (let i = 0; i < n; i += 1) {
    const run = runSingleBattle(input, rng);
    if (run.victory) wins += 1;
    if (run.result === "victory") outcomes.victory += 1;
    else if (run.result === "defeat") outcomes.defeat += 1;
    else if (run.result === "escape") outcomes.escape += 1;
    else outcomes.undecided += 1;
    totalTurns += run.turns;
    totalPotions += run.potionsUsed;
    totalHp += run.hpRemaining;
    capturedCount += run.capturedMonsters.length;
    for (const [skillId, count] of Object.entries(run.skillUses)) skillUses[skillId] = (skillUses[skillId] ?? 0) + count;
    tallyChargeBreaks(run.timeline, chargeBySkill);
    const firedThisRun = new Set<string>();
    for (const log of run.eventLogs) {
      if (log.kind === "fired") {
        if (!firedThisRun.has(log.pageId)) {
          firedThisRun.add(log.pageId);
          firedRuns.set(log.pageId, (firedRuns.get(log.pageId) ?? 0) + 1);
        }
        const previous = firstFiredRound.get(log.pageId);
        if (previous === undefined || log.round < previous) firstFiredRound.set(log.pageId, log.round);
      } else if (log.kind === "unsupported") {
        unsupportedByPage.set(log.pageId, (unsupportedByPage.get(log.pageId) ?? 0) + 1);
      }
    }
    if (i === 0) {
      roundLogs = run.roundLogs;
      eventLogs = run.eventLogs;
      participatingActorIds = run.participatingActorIds;
      capturedMonsters = run.capturedMonsters;
      firstRewards = run.rewards;
    }
  }
  const troopRecord = input.project.database.troops.find((troop) => troop.id === input.troopId);
  // 저작된 페이지 전부를 나열한다 — 발동 0회를 결과에서 지우면 "안 뜬 연출" 을 볼 방법이 없다.
  // 트룹 손님(battleGuests)은 battleEvents 가 「battle-guest:<배우>」 가상 페이지로 돌린다 — 같은 표에 싣는다.
  const guestPages = (troopRecord?.battleGuests ?? []).map((guest) => ({
    id: `battle-guest:${guest.actorId}`,
    name: `손님 합류: ${input.project.database.actors.find((actor) => actor.id === guest.actorId)?.name ?? guest.actorId}`,
  }));
  const phaseCoverage: BattlePhaseCoverage[] = [...(troopRecord?.battleEventPages ?? []), ...guestPages].map((page) => {
    const round = firstFiredRound.get(page.id);
    return {
      pageId: page.id,
      name: page.name,
      firedRuns: firedRuns.get(page.id) ?? 0,
      ...(round === undefined ? {} : { firstRound: round }),
      unsupported: unsupportedByPage.get(page.id) ?? 0,
    };
  });
  return {
    winRate: wins / n,
    ...(troopRecord?.duel ? { outcomes } : {}),
    avgTurns: totalTurns / n,
    avgPotionsUsed: totalPotions / n,
    avgHpRemaining: totalHp / n,
    samples: n,
    battleFlow: input.battleFlow ?? troopRecord?.battleFlow ?? input.project.system.battleFlow ?? "strict",
    participatingActorIds,
    roundLogs,
    eventLogs,
    phaseCoverage,
    capturedMonsters,
    capturedCount,
    skillUses,
    firstRewards,
    chargeBreaks: {
      started: Object.values(chargeBySkill).reduce((sum, row) => sum + row.started, 0),
      broken: Object.values(chargeBySkill).reduce((sum, row) => sum + row.broken, 0),
      bySkill: chargeBySkill,
    },
  };
}

// tune_enemy 근거 계산: 데미지 공식 역산. rm2k3 는 `power + stat/2 - def/2`(최소 1),
// gen1 은 battleDamage.computeGen1BaseDamage 의 레벨 기반 코어 공식을 역산한다.
export interface EnemyTuningInput {
  readonly project: Project;
  readonly heroLevel: number;
  readonly partyActorIds?: readonly string[];
  readonly enemyDefense: number; // 목표 적 방어력(유지값)
  readonly targetHitsToKill: number; // 영웅 평타 몇 대에 죽나
  readonly targetDamageToHeroPerHit: number; // 적 평타가 영웅에게 주는 데미지
  /**
   * 기준 아군을 직접 준다(몬스터 파티 게임: 스타터 몬스터). 없으면 파티 첫 액터.
   * move 를 주면 «평타» 대신 그 기술(위력·쓰는 능력치·적이 막는 능력치)로 한 대를 잰다 — 몬스터 전투는 평타가 아니라 기술로 싸운다.
   */
  readonly hero?: { readonly attack: number; readonly defense: number; readonly move?: { readonly power: number; readonly stat: number; readonly targetDefense: number; readonly multiplier?: number } };
  /** 적이 아군을 칠 때 쓰는 공격(attack 능력치) 기술 위력. 없으면 평타(위력 = 공격력). */
  readonly enemyMovePower?: number;
  /** 그 적 기술의 타입 상성·자속 배율(기본 1). */
  readonly enemyMoveMultiplier?: number;
  /** 그 적 기술을 아군이 막는 능력치(특수 기술이면 아군 mind). 없으면 아군 방어. */
  readonly enemyMoveTargetDefense?: number;
}

export interface EnemyTuningResult {
  readonly maxHp: number;
  readonly attack: number;
  readonly rationale: {
    readonly heroAttack: number;
    readonly heroDefense: number;
    readonly heroHitDamage: number; // 영웅 평타 1대 데미지(적 방어 반영)
    readonly formula: string;
  };
}

// 영웅 능력치를 지정 레벨에서 도출하고, 데미지 공식을 역산해 maxHp/attack을 산출한다.
export function computeEnemyTuning(input: EnemyTuningInput): EnemyTuningResult {
  const hero = input.hero ? { attackPower: input.hero.attack, defense: input.hero.defense } : (() => {
    const partyActorIds = input.partyActorIds ?? input.project.session.partyActorIds;
    const levels: Record<string, number> = {};
    for (const actorId of partyActorIds) levels[actorId] = input.heroLevel;
    return actorBattlers(input.project, { levels, partyActorIds: [...partyActorIds] })[0];
  })();
  const heroAttack = hero?.attackPower ?? 45;
  const heroDefense = hero?.defense ?? 59;

  // 영웅 평타 1대: attackPower + floor(attackPower/2) - floor(enemyDefense/2), 최소 1.
  // gen1 프로젝트는 코어 공식(레벨 기반)으로 갈아탄다 — 두 산식이 갈리면 tune_enemy 근거가
  // 실제 전투와 어긋난 숫자를 뱉는다(런타임/예측과 같은 usesGen1Damage 게이트를 쓴다).
  const gen1 = usesGen1Damage(input.project);
  const move = input.hero?.move;
  const hitPower = move?.power ?? heroAttack, hitStat = move?.stat ?? heroAttack, hitDefense = move?.targetDefense ?? input.enemyDefense;
  const heroMultiplier = move?.multiplier ?? 1;
  const heroHitDamage = Math.max(1, Math.floor(heroMultiplier * (gen1
    ? computeGen1BaseDamage({ level: input.heroLevel, power: hitPower, attack: hitStat, defense: hitDefense })
    : move
      ? hitPower + Math.floor(hitStat / 2) - Math.floor(hitDefense / 2)
      : heroAttack + Math.floor(heroAttack / 2) - Math.floor(input.enemyDefense / 2))));
  const maxHp = Math.max(1, Math.round(input.targetHitsToKill * heroHitDamage));

  // 적 평타가 영웅에게 targetDamageToHeroPerHit를 주려면:
  // A + floor(A/2) - floor(heroDefense/2) = target  →  1.5A ≈ target + heroDefense/2.
  // gen1 은 power=A 이자 attack=A 라 A 에 대해 2차식이다. 닫힌 해로 시작해 정방향 공식
  // (computeGen1BaseDamage)으로 단조 보정한다 — 역산과 실제 산식이 절대 갈라지지 않는다.
  // 적 기술 위력(enemyMovePower)을 주면 위력은 고정하고 A 만 푼다.
  const enemyPower = input.enemyMovePower;
  // 상성 배율이 있으면 배율을 걷어낸 기본 피해를 목표로 푼다(배율 0 이면 그 기술로는 못 맞힌다 → 배율 1).
  const enemyMultiplier = enemyPower !== undefined && (input.enemyMoveMultiplier ?? 1) > 0 ? input.enemyMoveMultiplier ?? 1 : 1;
  const baseTarget = Math.max(1, Math.ceil(input.targetDamageToHeroPerHit / enemyMultiplier));
  const guardStat = enemyPower !== undefined ? input.enemyMoveTargetDefense ?? heroDefense : heroDefense;
  const attack = gen1
    ? solveGen1Attack(input.heroLevel, guardStat, baseTarget, enemyPower)
    : enemyPower !== undefined
      ? Math.max(1, 2 * (baseTarget + Math.floor(guardStat / 2) - enemyPower))
      : Math.max(1, Math.round((input.targetDamageToHeroPerHit + Math.floor(heroDefense / 2)) / 1.5));
  const powerText = enemyPower !== undefined ? String(enemyPower) : "A";

  return {
    maxHp,
    attack,
    rationale: {
      heroAttack,
      heroDefense,
      heroHitDamage,
      formula: gen1
        ? `gen1: maxHp = round(${input.targetHitsToKill} × ${heroHitDamage}${move ? ` [기술 위력 ${hitPower}·능력 ${hitStat}·적 방어 ${hitDefense}·상성 ×${heroMultiplier}]` : ""}); attack = solve(base(Lv${input.heroLevel}, ${powerText}, A, ${guardStat}) ≥ ${baseTarget}${enemyMultiplier !== 1 ? ` = ${input.targetDamageToHeroPerHit} ÷ 상성 ${enemyMultiplier}` : ""})`
        : `maxHp = round(${input.targetHitsToKill} × ${heroHitDamage}); attack = ${enemyPower !== undefined ? `2 × (${baseTarget} + floor(${guardStat}/2) - ${enemyPower})` : `round((${input.targetDamageToHeroPerHit} + floor(${heroDefense}/2)) / 1.5)`}`,
    },
  };
}

// gen1 코어 공식의 A 역산. 닫힌 해 → 단조 보정(최대 64스텝). power 를 주지 않으면 power=attack=A(평타).
function solveGen1Attack(level: number, defense: number, targetDamage: number, power?: number): number {
  const levelTerm = Math.floor((2 * Math.max(1, level)) / 5) + 2;
  const seed = power !== undefined
    ? (Math.max(1, targetDamage - 2) * 50 * Math.max(1, defense)) / (levelTerm * Math.max(1, power))
    : Math.sqrt((Math.max(1, targetDamage - 2) * 50 * Math.max(1, defense)) / levelTerm);
  let attack = Math.max(1, Math.round(seed));
  const damageAt = (value: number): number => computeGen1BaseDamage({ level, power: power ?? value, attack: value, defense });
  for (let step = 0; step < 64 && damageAt(attack) < targetDamage; step += 1) attack += 1;
  for (let step = 0; step < 64 && attack > 1 && damageAt(attack - 1) >= targetDamage; step += 1) attack -= 1;
  return attack;
}
