import type { ActorId, BattleAnimationId, EnemyId, ItemId, Project, SkillId, TroopId } from "@/project/types";

export type BattlePhase = "charging" | "actorCommand" | "resolved";
export type BattleResult = "victory" | "defeat" | "escape";

export type ActorCommand =
  | { readonly kind: "attack"; readonly targetEnemyId: string }
  | { readonly kind: "skill"; readonly skillId: SkillId; readonly targetEnemyId: string }
  | { readonly kind: "item"; readonly itemId: ItemId; readonly targetEnemyId: string }
  | { readonly kind: "defend" }
  | { readonly kind: "escape" };

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
  readonly gauge: number;
  readonly defeated: boolean;
  readonly stateIds: readonly string[];
  readonly skillIds: readonly SkillId[];
}

export interface BattleAnimationSnapshot {
  readonly animationId: BattleAnimationId;
  readonly targetId: string;
}

export interface BattleRewardsSnapshot {
  readonly exp: number;
  readonly gold: number;
  readonly items: readonly ItemId[];
}

export interface BattleSnapshot {
  readonly phase: BattlePhase;
  readonly activeActorId?: ActorId;
  readonly actors: readonly BattleBattlerSnapshot[];
  readonly enemies: readonly BattleBattlerSnapshot[];
  readonly lastAnimation?: BattleAnimationSnapshot;
  readonly result?: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
  readonly canEscape: boolean;
  readonly canLose: boolean;
  readonly troopId: TroopId;
}

export interface BattleRuntime {
  tick(deltaMs: number): void;
  performActorCommand(command: ActorCommand): void;
  snapshot(): BattleSnapshot;
}
