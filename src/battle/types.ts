import type {
  ActorId,
  AudioCommandChannel,
  Command,
  ActorInitialEquipment,
  ActorParameterKey,
  BattleAnimationId,
  BattleAnimationPosition,
  BattleAnimationScope,
  BattleFlow,
  ChoiceCancelBehavior,
  EnemyId,
  FaceGraphic,
  MessageWindowSettings,
  ItemId,
  MonsterSpeciesId,
  Project,
  SkillId,
  TroopId,
} from "@/project/types";
import type { RelationshipState } from "@/project/relationshipState";
import type { BattleResult, GameTime } from "@/project/gameTime";
import type { MonsterCaughtAt, MonsterInstance, MonsterInstanceIvs } from "@/project/session";
import type { MonsterLevelUpPreview } from "@/project/monsterCollection";
import type { Rng } from "@/util/rng";
import type { EquipmentRuntimeEffects } from "@/battle/battleBattlers";
import type { RoguelikeRunState } from "@/project/roguelikeRun";

export type { BattleFlow } from "@/project/types";

export type BattlePhase = "charging" | "actorCommand" | "targetSelect" | "roundResolve" | "eventChoice" | "eventPause" | "resolved";

export interface BattleEventChoiceSnapshot {
  readonly id: number;
  readonly pageId: string;
  readonly round: number;
  readonly prompt?: string;
  readonly options: readonly { readonly text: string }[];
  readonly cancelBehavior?: ChoiceCancelBehavior;
  readonly settings?: MessageWindowSettings;
}

export type BattleEventPauseSnapshot =
  | { readonly id: number; readonly kind: "wait"; readonly ms: number }
  | { readonly id: number; readonly kind: "inputWait"; readonly variableId?: string }
  | {
      readonly id: number; readonly kind: "text"; readonly body: string;
      readonly speaker?: string; readonly face?: FaceGraphic;
      readonly settings?: MessageWindowSettings; readonly autoAdvance?: boolean;
      readonly emotion?: string;
      readonly voiceResourceId?: string;
    };

export type BattleEventPauseResponse =
  | { readonly kind: "wait" }
  | { readonly kind: "text" }
  | { readonly kind: "inputWait"; readonly keyCode: number };
export type { BattleResult } from "@/project/gameTime";

export type EquipmentUseTarget =
  | { readonly kind: "enemy"; readonly enemyId: string }
  | { readonly kind: "actor"; readonly actorId: ActorId }
  | { readonly kind: "none" };

export type EquipmentUseFailureReason =
  | "notActorTurn"
  | "missingActor"
  | "sourceNotEquipped"
  | "sourceHasNoSkill"
  | "missingSkill"
  | "insufficientMp"
  | "invalidTarget";

export type EquipmentUseResult =
  | { readonly kind: "used"; readonly skillId: SkillId }
  | { readonly kind: "rejected"; readonly reason: EquipmentUseFailureReason };

export type TargetedActorCommand =
  | { readonly kind: "attack" }
  | { readonly kind: "skill"; readonly skillId: SkillId }
  | { readonly kind: "item"; readonly itemId: ItemId }
  | { readonly kind: "capture"; readonly captureItemId: ItemId };

export type ActorCommandDraft =
  | TargetedActorCommand
  | { readonly kind: "defend" }
  | { readonly kind: "escape" }
  | { readonly kind: "switch"; readonly targetActorId: ActorId };

export type ActorCommand =
  | { readonly kind: "attack"; readonly targetEnemyId: string }
  | { readonly kind: "skill"; readonly skillId: SkillId; readonly targetEnemyId: string; readonly targetActorId?: ActorId }
  | { readonly kind: "item"; readonly itemId: ItemId; readonly targetEnemyId: string; readonly targetActorId?: ActorId }
  | { readonly kind: "capture"; readonly captureItemId: ItemId; readonly targetEnemyId: string }
  | { readonly kind: "defend" }
  | { readonly kind: "escape" }
  | { readonly kind: "switch"; readonly targetActorId: ActorId };

export interface BattleTargetSelectionSnapshot {
  readonly command: TargetedActorCommand;
  readonly side: "actor" | "enemy";
  readonly targetIds: readonly string[];
  readonly selectedTargetId?: string;
  /** Compatibility aliases for callers persisted before generic ally targeting. */
  readonly targetEnemyIds: readonly string[];
  readonly selectedEnemyId?: string;
  readonly targetActorIds: readonly ActorId[];
  readonly selectedActorId?: ActorId;
}

export interface BattleRuntimeOptions {
  readonly project: Project;
  readonly troopId: TroopId;
  readonly canEscape: boolean;
  readonly canLose: boolean;
  readonly battleFlow?: BattleFlow;
  readonly activeSlots?: number;
  /** 전투 개시 진형. 지정하면 그대로, 생략하면 system.battleFormationRoll 일 때만 민첩으로 굴린다(아니면 보통). */
  readonly formation?: import("@/battle/battleFormation").BattleStartFormation;
  // 현재 플레이 세션의 파티 레벨/경험치. 승리 시 레벨업 미리보기(rewards.levelUps) 산출에 사용.
  // 없으면 레벨업 미리보기를 계산하지 않는다(세션 적립은 별도 파이프라인이 담당).
  readonly party?: BattlePartyProgress;
  // 전투 배경 리소스 override(주로 지형 battleBackgroundResourceId). 지정 시 최우선.
  // 없으면 전투군 previewBackground → 지형 → 기본 전장. System2 게이지 시트는 배경이 아님.
  readonly backdropResourceId?: string;
  // 현재 플레이 세션의 스위치/변수/인벤토리. 전투 이벤트 조건과 아이템 목록/소모의 기준.
  // 없으면 project.session(에디터 시작 상태)을 사용한다 — 에디터 전투 테스트 경로용.
  readonly sessionState?: BattleSessionState;
  // 이 전투를 기동한 맵 이벤트 id(battleProcessing 소유 이벤트). 트룹 배틀 이벤트의
  // selfSwitch 조건/`setSelfSwitch` 커맨드가 이 이벤트의 셀프 스위치를 읽고 쓴다.
  // 랜덤 인카운터/필드 스폰 등 소유 이벤트가 없는 전투는 undefined 유지(조건은 false).
  readonly ownerEventId?: string;
  readonly captureLocation?: MonsterCaughtAt;
  readonly onMonsterCaptured?: (capture: BattleCapturedMonsterSnapshot) => void;
  // 아군측을 파티 몬스터로 구성할 때 필드 순서대로의 인스턴스 목록.
  // system.battleParty === "monsters" 이고 이 값이 비어있지 않을 때 액터 대신 사용된다.
  readonly partyMonsters?: readonly MonsterInstance[];
  readonly rng?: Rng;
  // 배틀 이벤트의 playAudio/stopAudio 명령을 호스트 오디오 엔진으로 라우팅.
  // 런타임(src/battle)은 자체 완결성을 위해 직접 오디오를 재생하지 않고 위임한다.
  readonly playAudio?: (resourceId: string, loop: boolean, command?: Extract<Command, { kind: "playAudio" }>) => void;
  readonly stopAudio?: (channel?: AudioCommandChannel) => void;
}

export interface BattleSessionState {
  readonly messageWindowSettings?: MessageWindowSettings;
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number>>;
  // 세션 셀프 스위치(eventId → key → on). ownerEventId 가 있는 전투에서
  // 트룹 배틀 이벤트의 selfSwitch 조건/setSelfSwitch 커맨드의 기준 상태.
  readonly selfSwitches?: Readonly<Record<string, Readonly<Partial<Record<string, boolean>>>>>;
  // 직전 전투 처리 결과(세션 SSOT — openwiki/runtime-battle.md §battleResult).
  // 트룹 배틀 이벤트의 battleResult 조건이 이 스냅샷 값으로 평가된다.
  readonly battleResult?: BattleResult;
  readonly roguelikeRun?: RoguelikeRunState;
  readonly itemUseCharges?: Readonly<Record<string, number>>;
  readonly gold?: number;
  readonly partyActorIds?: readonly string[];
  readonly monsterInstances?: import("@/project/monsterOwnership").MonsterOwnershipState["monsterInstances"];
  readonly monsterParty?: readonly string[];
  readonly monsterBox?: readonly string[];
  readonly actorSkillIds?: Readonly<Record<string, readonly SkillId[]>>;
  readonly actorExperience?: Readonly<Record<string, number>>;
  readonly actorLevels?: Readonly<Record<string, number>>;
  /** 배우별 누적 기술 포인트(TP). 승리 후 TP 습득 미리보기의 기준. */
  readonly actorTechPoints?: Readonly<Record<string, number>>;
  readonly actorBattleCommands?: Readonly<Record<string, readonly string[]>>;
  // 레거시 호환 플래그(setFlag 커맨드 기준 상태).
  readonly flags?: Readonly<Record<string, boolean>>;
  // 타이머 잔여 초(timer 커맨드/timer 조건 기준 상태).
  readonly timers?: Readonly<Record<string, number>>;
  // 세션 장비 상태(changeEquipment 커맨드 기준 상태). 없으면 party.equipment 폴백.
  readonly actorEquipment?: Readonly<Record<string, ActorInitialEquipment>>;
  // 런타임 직업 오버라이드(promoteActor 커맨드 기준 상태). 없으면 party.classOverrides 폴백.
  readonly classOverrides?: Readonly<Record<string, string>>;
  readonly growthProgress?: import("@/project/growth/types").GrowthProgress;
  readonly promotionLineage?: import("@/project/growth/types").PromotionLineage;
  readonly gameTime?: GameTime;
  readonly npcActivities?: Readonly<Record<string, string>>;
  readonly friendship?: Readonly<Record<string, number>>;
  readonly relationships?: Readonly<Record<string, RelationshipState>>;
  /** 전투 개시 시점의 필드 위치. 트룹 배틀 이벤트의 insideLocation 조건이 이것으로 판정한다. */
  readonly currentMapId?: string;
  readonly x?: number;
  readonly y?: number;
  // 명작 공백 G1 — 트룹 배틀 이벤트 페이지가 읽는 조건 스냅샷.
  readonly actorVitals?: Readonly<Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>>;
  readonly actorStateIds?: Readonly<Record<string, readonly string[]>>;
  readonly playerFacing?: import("@/project/types").Dir;
  readonly eventLocations?: Readonly<Record<string, { readonly mapId: string; readonly x: number; readonly y: number; readonly direction?: import("@/project/types").Dir }>>;
  readonly horror?: import("@/project/horrorState").HorrorState;
  readonly stringVariables?: Readonly<Record<string, string>>;
  readonly clearHistory?: { readonly count: number; readonly endingIds: readonly string[] };
}

export interface BattlePartyProgress {
  readonly rows?: Readonly<Record<string, import("@/battle/battleFormation").BattleRow>>;
  readonly levels: Readonly<Record<string, number>>;
  readonly experience: Readonly<Record<string, number>>;
  // 세션 액터 이름 오버라이드(enterHeroName 등). actorId → 이름. 없으면 DB 이름 사용.
  readonly names?: Readonly<Record<string, string>>;
  // Change Actor Faceset 런타임 오버라이드. 전투 HUD도 필드/메시지와 같은 현재 얼굴을 사용한다.
  readonly faceResourceIds?: Readonly<Record<string, string>>;
  // 세션 현재 바이탈(필드에서 이어지는 현재 HP/MP). 전투 진입 능력치에 반영.
  readonly vitals?: Readonly<Record<string, { readonly hp: number; readonly mp: number }>>;
  // 세션 영구 파라미터 보정(Change Parameters). 전투 진입 능력치에 반영.
  readonly paramBonuses?: Readonly<Record<string, Partial<Record<ActorParameterKey, number>>>>;
  // 세션 장비 상태. 없으면 DB initialEquipment 를 사용한다.
  readonly equipment?: Readonly<Record<string, ActorInitialEquipment>>;
  // 이벤트/레벨업으로 세션에 직접 습득된 스킬.
  readonly skillIds?: Readonly<Record<string, readonly SkillId[]>>;
  /** Persisted Gen1 PP for non-monster actor fallback battles. */
  readonly skillPp?: Readonly<Record<string, Readonly<Record<SkillId, number>>>>;
  // 런타임 직업 오버라이드(Change Actor Class/승급).
  readonly classOverrides?: Readonly<Record<string, string>>;
  readonly growthProgress?: import("@/project/growth/types").GrowthProgress;
  readonly promotionLineage?: import("@/project/growth/types").PromotionLineage;
  // 세션 상태 이상(Change State). 전투 진입 시 초기 stateIds 로 반영.
  readonly stateIds?: Readonly<Record<string, readonly string[]>>;
  // 현재 파티 편성(changeParty/순서변경 반영). 없으면 project.session(에디터 시작 상태).
  readonly partyActorIds?: readonly string[];
  // Change Battle Commands 세션 오버라이드. actorId → battleCommand ids.
  readonly battleCommands?: Readonly<Record<string, readonly string[]>>;
  // 몬스터 전투 모드(옵션 A): 값이 있고 비어있지 않으면 영웅 대신 이 몬스터 파티로 전투한다.
  // 없거나 빈 배열이면 기존 액터 경로가 100% 유지된다(회귀 0).
  readonly monsterParty?: readonly MonsterInstance[];
}

export type { BattleBattlerPose } from "@/battle/battlePose";

export interface BattleBattlerSnapshot {
  readonly row?: import("@/battle/battleFormation").BattleRow;
  readonly id: string;
  readonly recordId: ActorId | EnemyId;
  /** Runtime-equivalent stats including equipment/param bonuses (predict parity). */
  readonly effectiveStats?: { readonly attack: number; readonly defense: number; readonly mind: number; readonly agility: number };
  // 플레이어 몬스터 배틀러의 종족 id(스프라이트/타입 해석용). 액터·적 스냅샷은 미설정.
  readonly speciesId?: MonsterSpeciesId;
  readonly classId?: string;
  readonly level?: number;
  /** 현재 배우 식별 그래픽. 런타임 faceset 변경을 포함하며 DOM은 DB를 다시 추측하지 않는다. */
  readonly faceResourceId?: string;
  readonly battleCharacterResourceId?: string;
  /** 아군측 배틀러가 파티 몬스터에서 온 경우의 원 식별자(스프라이트·되돌려쓰기 키). */
  readonly monsterInstanceId?: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly gauge: number;
  readonly battleX?: number;
  readonly battleY?: number;
  readonly authoredX?: number;
  readonly authoredY?: number;
  /** 전투 중 옮겨진 적(moveEnemy/moveTo). 있으면 표시는 자동 진형 대신 authoredX/Y 로 미끄러진다. */
  readonly moved?: { readonly durationMs: number; readonly sequence: number };
  readonly defeated: boolean;
  readonly defending: boolean;
  /** Side-view pose for the current resolve beat (idle/attack/hit/defend/dead). */
  readonly pose: import("@/battle/battlePose").BattleBattlerPose;
  readonly stateIds: readonly string[];
  /** Per-state turn counters, carried by persistent monster instances. */
  readonly stateTurns?: Readonly<Record<string, number>>;
  readonly skillIds: readonly SkillId[];
  /** Remaining PP by skill for immutable battle consumers. */
  readonly skillPp?: Readonly<Record<SkillId, number>>;
  readonly skillCooldowns?: Readonly<Record<SkillId, number>>;
  readonly equipmentEffects?: EquipmentRuntimeEffects;
  readonly captured?: boolean;
}

export interface BattleHitFeelSnapshot {
  readonly targetId: string;
  readonly amount: number;
  readonly critical: boolean;
  readonly healing: boolean;
}

export interface BattleAnimationSnapshot {
  readonly animationId: BattleAnimationId;
  readonly targetId: string;
  readonly name?: string;
  readonly resourceId?: string;
  readonly scope?: BattleAnimationScope;
  readonly position?: BattleAnimationPosition;
  readonly soundResourceIds: readonly string[];
  readonly flashTargets: readonly ("target" | "screen")[];
  readonly screenShake: boolean;
  readonly frameCount: number;
  /** 후속(followUps)까지 포함한 전체 재생 길이(ms). 시퀀서가 recover 비트를 이만큼 보장한다. */
  readonly durationMs?: number;
}

// 직전 행동의 적용 결과. applySkillLike 가 돌려주는 {hit, amount, critical} 을
// 화면(빗맞음/크리티컬 표시)으로 전달하기 위해 snapshot 에 담는다.
export interface BattleActionResultSnapshot {
  readonly userRecordId: string;
  readonly targetId: string;
  readonly hit: boolean;
  readonly amount: number;
  readonly critical: boolean;
  readonly skillName?: string;
}

export type BattleTimelineEntryKind =
  | "action"
  | "damage"
  | "healing"
  | "miss"
  | "capture"
  | "switch"
  | "stateUpkeep"
  | "stateRecovery"
  | "stateAdded"
  | "stateRemoved"
  | "incapacitated"
  | "stalemate"
  /** 적 반격 선언(이어서 피해 엔트리가 온다). 쓰러지는 적의 최후의 일격(trigger onDeath)도 이 엔트리로 선언한다. */
  | "counter"
  /** 장비 자동 부활. amount = 되살아난 HP. */
  | "revive"
  /** 적 위치 이동(moveEnemy/moveTo). */
  | "move"
  /** 배틀 이벤트 `wait` 가 요청한 연출 일시정지(strict 흐름). `waitMs` 를 들고 있다. */
  | "wait";

/** Ordered, append-only battle facts consumed by presentation exactly once. */
export interface BattleTimelineEntrySnapshot {
  readonly sequence: number;
  readonly kind: BattleTimelineEntryKind;
  readonly side?: "actor" | "enemy";
  readonly userId?: string;
  readonly userRecordId?: string;
  readonly targetId?: string;
  readonly commandKind?: ActorCommand["kind"] | "enemyAttack" | "enemySkill";
  readonly hit?: boolean;
  readonly amount?: number;
  readonly critical?: boolean;
  readonly skillName?: string;
  readonly stateId?: string;
  readonly reason?: "natural" | "hit" | "battleEnd" | "effect" | "strictCap";
  readonly success?: boolean;
  /** 회복 엔트리가 어느 자원에 작용했는가. 표시 계층이 이 값을 HP 원장에 그대로 쓰면
   *  MP 회복이 HP 로 새어 들어간다(실측: 마력약 MP+30 → 표시 HP 250→280). */
  readonly resource?: "hp" | "mp";
  /** kind === "wait" 인 엔트리의 일시정지 시간(ms). 시퀀서가 이 값만큼 다음 비트를 늦춘다. */
  readonly waitMs?: number;
  /** 이 액션이 재생할 전투 애니메이션. 시퀀서가 비트 재생 시점에 이 스냅샷으로
   *  애니메이션을 띄운다 — lastAnimation(전역 잔류값) 기반 재생은 잔여물 결함의 원인이었다. */
  readonly animation?: BattleAnimationSnapshot;
}

export interface BattleCapturedMonsterSnapshot {
  readonly targetId: string;
  readonly enemyId: EnemyId;
  readonly speciesId: MonsterSpeciesId;
  readonly level: number;
  readonly caughtAt: MonsterCaughtAt;
  readonly ivs: MonsterInstanceIvs;
  readonly captureItemId: ItemId;
  readonly currentHp?: number;
  readonly stateIds?: readonly string[];
  readonly stateTurns?: Readonly<Record<string, number>>;
  readonly skillIds?: readonly SkillId[];
  readonly skillPp?: Readonly<Record<SkillId, number>>;
}

export type BattleCaptureBlockedReason = "uncapturable" | "trainerBattle" | "missingTarget" | "missingItem" | "missingSpecies";

export interface BattleCaptureResultSnapshot {
  readonly targetId: string;
  readonly captureItemId: ItemId;
  readonly success: boolean;
  readonly rate: number;
  readonly roll?: number;
  readonly speciesId?: MonsterSpeciesId;
  readonly blockedReason?: BattleCaptureBlockedReason;
  readonly shakes?: 0 | 1 | 2 | 3;
}

export interface BattleRoundActionLogSnapshot {
  readonly round: number;
  readonly order: number;
  readonly side: "actor" | "enemy";
  readonly userId: string;
  readonly userRecordId: string;
  readonly commandKind: ActorCommand["kind"] | "enemyAttack" | "enemySkill";
  readonly targetId?: string;
  readonly hit?: boolean;
  readonly amount?: number;
  readonly critical?: boolean;
  readonly skillName?: string;
}

export interface BattleRoundLogSnapshot {
  readonly round: number;
  readonly actions: readonly BattleRoundActionLogSnapshot[];
  readonly timeline: readonly BattleTimelineEntrySnapshot[];
  readonly participatingActorIds: readonly ActorId[];
  readonly actors: readonly { readonly id: string; readonly hp: number; readonly mp: number; readonly stateIds: readonly string[] }[];
  readonly enemies: readonly { readonly id: string; readonly hp: number; readonly mp: number; readonly stateIds: readonly string[] }[];
  readonly result?: BattleResult;
}

export interface BattleEventLogSnapshot {
  readonly pageId: string;
  readonly round: number;
  readonly triggerId: string;
  readonly kind: "fired" | "message" | "choices" | "unsupported";
  readonly detail?: string;
}

export interface BattleLevelUpPreview {
  readonly actorId: string;
  readonly actorName: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly maxHpGain: number;
  readonly maxMpGain: number;
  readonly attackGain: number;
  readonly defenseGain: number;
  readonly mindGain: number;
  readonly agilityGain: number;
  readonly learnedSkillIds: readonly SkillId[];
}

export interface BattleRewardsSnapshot {
  readonly exp: number;
  readonly gold: number;
  readonly items: readonly ItemId[];
  readonly enemyLevel?: number;
  // 승리 시 파티 정보가 주어졌다면 산출되는 레벨업 미리보기(결과 화면 연출용).
  readonly levelUps?: readonly BattleLevelUpPreview[];
  // 파티 몬스터(battleParty: "monsters") 경로의 레벨업 미리보기. levelUps 는 액터 전용이라
  // 몬스터가 싸운 전투는 성장 피드백이 화면에 전혀 나오지 않았다.
  readonly monsterLevelUps?: readonly MonsterLevelUpPreview[];
  /** 기술 포인트(트룹 합계). 살아남은 파티원 전원이 받는다. 저작된 TP 가 없으면 생략. */
  readonly tp?: number;
  /** TP 로 새로 배우는 기술 미리보기(결과 화면용). 세션 적립은 battleRewardsToSession 이 같은 규칙으로 한다. */
  readonly techLearned?: readonly { readonly actorId: string; readonly actorName: string; readonly skillIds: readonly SkillId[] }[];
}

export interface BattleEventStateSnapshot {
  readonly gameOverRequest?: { readonly gameOverId: string; readonly message?: string };
  /** Present only when this battle authored a settings change. */
  readonly messageWindowSettings?: MessageWindowSettings;
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number>>;
  // 전투 중 setSelfSwitch 가 변경한 셀프 스위치 포함 스냅샷.
  // applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
  readonly selfSwitches?: Readonly<Record<string, Readonly<Partial<Record<string, boolean>>>>>;
  readonly itemUseCharges?: Readonly<Record<string, number>>;
  readonly gold?: number;
  readonly partyActorIds?: readonly string[];
  readonly actorSkillIds?: Readonly<Record<string, readonly SkillId[]>>;
  readonly actorExperience?: Readonly<Record<string, number>>;
  readonly actorLevels?: Readonly<Record<string, number>>;
  readonly actorBattleCommands?: Readonly<Record<string, readonly string[]>>;
  /** Only friendship keys written by this battle, not its entire input snapshot. */
  readonly friendship?: Readonly<Record<string, number>>;
  // 이산 관계 상태(setRelationship) — applyBattleRewardsToSession 이 세션 relationships 로 되돌려 쓴다.
  readonly relationships?: Readonly<Record<string, RelationshipState>>;
  // 레거시 호환 플래그(setFlag) — applyBattleRewardsToSession 이 세션 flags 로 되돌려 쓴다.
  readonly flags?: Readonly<Record<string, boolean>>;
  // 타이머 여 초(timer 커맨드) — applyBattleRewardsToSession 이 세션 timers 로 되돌려 쓴다.
  // timer 조건 평가가 진입 시점 사본을 읽어야 하므로 전체 사본이다.
  readonly timers?: Readonly<Record<string, number>>;
  /** 이 전투가 timer 커맨드로 실제 쓴 키만. 이게 없으면 write-back 이 전투 중 맵 이
   *  줄여 둔 타이머를 진입 시점 값으로 되돌려 만료를 취소한다(실측: 세션 1초 / 런타임 0초). */
  readonly timerWrites?: Readonly<Record<string, number>>;
  /** Final set/start/stop activity for explicitly written timers only. */
  readonly timerActivityWrites?: Readonly<Record<string, boolean>>;
  // 전투 중 changeEquipment 가 갱신한 장비 스냅샷 — 세션 actorEquipment 로 되돌려 쓴다.
  readonly actorEquipment?: Readonly<Record<string, ActorInitialEquipment>>;
  // 전투 중 promoteActor 가 갱신한 직업 오버라이드 — 세션 classOverrides 로 되돌려 쓴다
  // 최종 직업이 같아도 경로·영구 스킬을 권위 상태로 복사하며 임의 전직을 재실행하지 않는다.
  readonly classOverrides?: Readonly<Record<string, string>>;
  readonly growthProgress?: import("@/project/growth/types").GrowthProgress;
  readonly promotionLineage?: import("@/project/growth/types").PromotionLineage;
}

export interface BattleSnapshot {
  /** Gauge prediction from the same scheduler/rates as tick, using battler instance id. */
  readonly nextReadyBattlerId?: string;
  readonly eventPause?: BattleEventPauseSnapshot;
  readonly eventChoice?: BattleEventChoiceSnapshot;
  readonly phase: BattlePhase;
  readonly battleFlow: BattleFlow;
  readonly activeActorId?: ActorId;
  readonly activeSlots: number;
  readonly forcedSwitchActorId?: ActorId;
  readonly switchCandidateActorIds: readonly ActorId[];
  readonly participatingActorIds: readonly ActorId[];
  readonly actors: readonly BattleBattlerSnapshot[];
  readonly reserveActors: readonly BattleBattlerSnapshot[];
  readonly enemies: readonly BattleBattlerSnapshot[];
  readonly lastAnimation?: BattleAnimationSnapshot;
  readonly lastActionResult?: BattleActionResultSnapshot;
  /** Compatibility result log retained for older callers. */
  readonly actionLog: readonly BattleActionResultSnapshot[];
  /** Ordered append-only facts for complete round/action presentation. */
  readonly timeline: readonly BattleTimelineEntrySnapshot[];
  /** Present when the last resolved action should show hit-feel juice. */
  readonly hitFeel?: BattleHitFeelSnapshot;
  readonly lastCaptureResult?: BattleCaptureResultSnapshot;
  readonly capturedMonsters: readonly BattleCapturedMonsterSnapshot[];
  readonly result?: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
  readonly canEscape: boolean;
  /** 이 전투의 개시 진형. 보통 개시는 "normal". */
  readonly formation?: import("@/battle/battleFormation").BattleStartFormation;
  /** 지금까지 실패한 도주 횟수(다음 도주 확률 가산의 근거). */
  readonly failedEscapeAttempts?: number;
  readonly canLose: boolean;
  readonly troopId: TroopId;
  readonly backdropResourceId?: string;
  readonly turn: number;
  readonly strictRound: number;
  readonly strictPendingActorIds: readonly ActorId[];
  readonly strictQueuedActorIds: readonly ActorId[];
  readonly eventState: BattleEventStateSnapshot;
  readonly targetSelection?: BattleTargetSelectionSnapshot;
  readonly roundLogs: readonly BattleRoundLogSnapshot[];
  readonly eventLogs: readonly BattleEventLogSnapshot[];
}

export interface BattleRuntime {
  resumeEventPause(requestId: number, response: BattleEventPauseResponse): boolean;
  resumeEventChoice(requestId: number, index: number): boolean;
  /** Dispose suspended execution without creating a battle outcome. */
  cancel(): void;
  tick(deltaMs: number): void;
  beginActorCommand(command: ActorCommandDraft): void;
  selectTarget(targetId: string): void;
  setSelectedTarget(targetId: string): void;
  /** Compatibility aliases for enemy-only callers. */
  selectTargetEnemy(enemyId: string): void;
  setSelectedTargetEnemy(enemyId: string): void;
  cancelTargetSelection(): void;
  performActorCommand(command: ActorCommand): void;
  chooseAutoCommand(): ActorCommand | undefined;
  executeEquipmentUse(actorId: ActorId, equipmentId: string, target: EquipmentUseTarget): EquipmentUseResult;
  snapshot(): BattleSnapshot;
}
