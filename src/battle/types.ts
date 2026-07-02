import type {
  ActorId,
  BattleAnimationId,
  BattleAnimationPosition,
  BattleAnimationScope,
  EnemyId,
  ItemId,
  Project,
  SkillId,
  TroopId,
} from "@/project/types";

export type BattlePhase = "charging" | "actorCommand" | "targetSelect" | "resolved";
export type BattleResult = "victory" | "defeat" | "escape";

export type TargetedActorCommand =
  | { readonly kind: "attack" }
  | { readonly kind: "skill"; readonly skillId: SkillId }
  | { readonly kind: "item"; readonly itemId: ItemId };

export type ActorCommandDraft =
  | TargetedActorCommand
  | { readonly kind: "defend" }
  | { readonly kind: "escape" };

export type ActorCommand =
  | { readonly kind: "attack"; readonly targetEnemyId: string }
  | { readonly kind: "skill"; readonly skillId: SkillId; readonly targetEnemyId: string }
  | { readonly kind: "item"; readonly itemId: ItemId; readonly targetEnemyId: string }
  | { readonly kind: "defend" }
  | { readonly kind: "escape" };

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
}

export interface BattleBattlerSnapshot {
  readonly id: string;
  readonly recordId: ActorId | EnemyId;
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

export interface BattleRewardsSnapshot {
  readonly exp: number;
  readonly gold: number;
  readonly items: readonly ItemId[];
}

export interface BattleEventStateSnapshot {
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number>>;
}

export interface BattleSnapshot {
  readonly phase: BattlePhase;
  readonly activeActorId?: ActorId;
  readonly actors: readonly BattleBattlerSnapshot[];
  readonly enemies: readonly BattleBattlerSnapshot[];
  readonly lastAnimation?: BattleAnimationSnapshot;
  readonly lastActionResult?: BattleActionResultSnapshot;
  readonly result?: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
  readonly canEscape: boolean;
  readonly canLose: boolean;
  readonly troopId: TroopId;
  readonly backdropResourceId?: string;
  readonly turn: number;
  readonly eventState: BattleEventStateSnapshot;
  readonly targetSelection?: BattleTargetSelectionSnapshot;
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
