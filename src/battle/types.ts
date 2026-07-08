import type {
  ActorId,
  ActorInitialEquipment,
  ActorParameterKey,
  BattleAnimationId,
  BattleAnimationPosition,
  BattleAnimationScope,
  BattleFlow,
  EnemyId,
  ItemId,
  MonsterSpeciesId,
  Project,
  SkillId,
  TroopId,
} from "@/project/types";
import type { GameTime } from "@/project/gameTime";
import type { MonsterCaughtAt, MonsterInstanceIvs } from "@/project/session";
import type { Rng } from "@/util/rng";

export type { BattleFlow } from "@/project/types";

export type BattlePhase = "charging" | "actorCommand" | "targetSelect" | "roundResolve" | "resolved";
export type BattleResult = "victory" | "defeat" | "escape";

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
  | { readonly kind: "skill"; readonly skillId: SkillId; readonly targetEnemyId: string }
  | { readonly kind: "item"; readonly itemId: ItemId; readonly targetEnemyId: string }
  | { readonly kind: "capture"; readonly captureItemId: ItemId; readonly targetEnemyId: string }
  | { readonly kind: "defend" }
  | { readonly kind: "escape" }
  | { readonly kind: "switch"; readonly targetActorId: ActorId };

export interface BattleTargetSelectionSnapshot {
  readonly command: TargetedActorCommand;
  readonly targetEnemyIds: readonly string[];
  readonly selectedEnemyId?: string;
}

export interface BattleRuntimeOptions {
  readonly project: Project;
  readonly troopId: TroopId;
  readonly canEscape: boolean;
  readonly canLose: boolean;
  readonly battleFlow?: BattleFlow;
  readonly activeSlots?: number;
  // 현재 플레이 세션의 파티 레벨/경험치. 승리 시 레벨업 미리보기(rewards.levelUps) 산출에 사용.
  // 없으면 레벨업 미리보기를 계산하지 않는다(세션 적립은 별도 파이프라인이 담당).
  readonly party?: BattlePartyProgress;
  // 전투 배경 리소스 override(주로 지형 battleBackgroundResourceId). 지정 시 최우선.
  // 없으면 전투군 previewBackground → 시스템 battleSystem 순으로 사용.
  readonly backdropResourceId?: string;
  // 현재 플레이 세션의 스위치/변수/인벤토리. 전투 이벤트 조건과 아이템 목록/소모의 기준.
  // 없으면 project.session(에디터 시작 상태)을 사용한다 — 에디터 전투 테스트 경로용.
  readonly sessionState?: BattleSessionState;
  readonly captureLocation?: MonsterCaughtAt;
  readonly onMonsterCaptured?: (capture: BattleCapturedMonsterSnapshot) => void;
  readonly rng?: Rng;
}

export interface BattleSessionState {
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number>>;
  readonly gameTime?: GameTime;
  readonly friendship?: Readonly<Record<string, number>>;
}

export interface BattlePartyProgress {
  readonly levels: Readonly<Record<string, number>>;
  readonly experience: Readonly<Record<string, number>>;
  // 세션 액터 이름 오버라이드(enterHeroName 등). actorId → 이름. 없으면 DB 이름 사용.
  readonly names?: Readonly<Record<string, string>>;
  // 세션 현재 바이탈(필드에서 이어지는 현재 HP/MP). 전투 진입 능력치에 반영.
  readonly vitals?: Readonly<Record<string, { readonly hp: number; readonly mp: number }>>;
  // 세션 영구 파라미터 보정(Change Parameters). 전투 진입 능력치에 반영.
  readonly paramBonuses?: Readonly<Record<string, Partial<Record<ActorParameterKey, number>>>>;
  // 세션 장비 상태. 없으면 DB initialEquipment 를 사용한다.
  readonly equipment?: Readonly<Record<string, ActorInitialEquipment>>;
  // 이벤트/레벨업으로 세션에 직접 습득된 스킬.
  readonly skillIds?: Readonly<Record<string, readonly SkillId[]>>;
  // 런타임 직업 오버라이드(Change Actor Class/승급).
  readonly classOverrides?: Readonly<Record<string, string>>;
  // 세션 상태 이상(Change State). 전투 진입 시 초기 stateIds 로 반영.
  readonly stateIds?: Readonly<Record<string, readonly string[]>>;
  // 현재 파티 편성(changeParty/순서변경 반영). 없으면 project.session(에디터 시작 상태).
  readonly partyActorIds?: readonly string[];
}

export interface BattleBattlerSnapshot {
  readonly id: string;
  readonly recordId: ActorId | EnemyId;
  readonly classId?: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly gauge: number;
  readonly battleX?: number;
  readonly battleY?: number;
  readonly defeated: boolean;
  readonly defending: boolean;
  readonly stateIds: readonly string[];
  readonly skillIds: readonly SkillId[];
  readonly captured?: boolean;
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

export interface BattleCapturedMonsterSnapshot {
  readonly targetId: string;
  readonly enemyId: EnemyId;
  readonly speciesId: MonsterSpeciesId;
  readonly level: number;
  readonly caughtAt: MonsterCaughtAt;
  readonly ivs: MonsterInstanceIvs;
  readonly captureItemId: ItemId;
}

export type BattleCaptureBlockedReason = "uncapturable" | "missingTarget" | "missingItem" | "missingSpecies";

export interface BattleCaptureResultSnapshot {
  readonly targetId: string;
  readonly captureItemId: ItemId;
  readonly success: boolean;
  readonly rate: number;
  readonly roll?: number;
  readonly speciesId?: MonsterSpeciesId;
  readonly blockedReason?: BattleCaptureBlockedReason;
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
}

export interface BattleEventStateSnapshot {
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number>>;
}

export interface BattleSnapshot {
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
  readonly lastCaptureResult?: BattleCaptureResultSnapshot;
  readonly capturedMonsters: readonly BattleCapturedMonsterSnapshot[];
  readonly result?: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
  readonly canEscape: boolean;
  readonly canLose: boolean;
  readonly troopId: TroopId;
  readonly backdropResourceId?: string;
  readonly turn: number;
  readonly eventState: BattleEventStateSnapshot;
  readonly targetSelection?: BattleTargetSelectionSnapshot;
  readonly roundLogs: readonly BattleRoundLogSnapshot[];
  readonly eventLogs: readonly BattleEventLogSnapshot[];
}

export interface BattleRuntime {
  tick(deltaMs: number): void;
  beginActorCommand(command: ActorCommandDraft): void;
  selectTargetEnemy(enemyId: string): void;
  setSelectedTargetEnemy(enemyId: string): void;
  cancelTargetSelection(): void;
  performActorCommand(command: ActorCommand): void;
  snapshot(): BattleSnapshot;
}
