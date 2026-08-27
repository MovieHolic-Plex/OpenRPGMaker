import type Phaser from "phaser";
import type { AttackBufferState } from "@/battle/action/attackWindow";
import type { ResolvedActionCombatConfig } from "@/project/actionCombat";
import type { EnemyActionAttack } from "@/project/types";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";

export type ActionEnemyMode = "combat" | "windup" | "dash" | "recover";

export interface ActionEnemyDashState {
  readonly dirX: -1 | 0 | 1;
  readonly dirY: -1 | 0 | 1;
  tilesLeft: number;
  stepProgressMs: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface ActionProjectile {
  readonly id: number;
  readonly faction: "enemy" | "player";
  x: number;
  y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly speedTilesPerMs: number;
  readonly damage: number;
  readonly elementId: string | undefined;
  traveledTiles: number;
  readonly maxRangeTiles: number;
  readonly object: Phaser.GameObjects.Arc;
}

export interface ActionEnemyState {
  readonly eventId: string;
  readonly enemyId: string;
  hp: number;
  readonly maxHp: number;
  readonly defense: number;
  readonly contactDamage: number | undefined;
  readonly attack: number;
  readonly exp: number;
  readonly actionAttack: EnemyActionAttack | undefined;
  readonly gold: number;
  readonly dropItemId: string | undefined;
  readonly dropRatePercent: number;
  readonly knockbackResist: number;
  flashMs: number;
  mode: ActionEnemyMode;
  modeTimerMs: number;
  attackCooldownMs: number;
  dash?: ActionEnemyDashState;
  telegraph?: Phaser.GameObjects.Graphics;
  windupTween?: Phaser.Tweens.Tween;
}

export interface ActionCombatSceneState {
  readonly config: ResolvedActionCombatConfig;
  readonly enemies: Map<string, ActionEnemyState>;
  readonly projectiles: ActionProjectile[];
  projectileSerial: number;
  playerIframesMs: number;
  /** 회피 성공으로 열린 단하한 무적 창의 남은 시간. */
  dodgeIframesMs: number;
  playerFlashMs: number;
  swingCooldownMs: number;
  /** 쿨다운 중 눌린 공격을 기록하는 입력 버퍼 규칙 상태. */
  attackBuffer: AttackBufferState;
  stamina: number;
  hitstopMs: number;
  fieldSpawnRuntime?: FieldSpawnRuntimeState;
  barsGraphics?: Phaser.GameObjects.Graphics;
  hud?: { update(model: ActionHudModel): void; destroy(): void; setHpVisible(visible: boolean): void };
  lastHudSignature: string;
}

export interface ActionHudModel {
  readonly hp: number;
  readonly maxHp: number;
  readonly stamina: number;
  readonly staminaMax: number;
  readonly showStamina: boolean;
}

export const ACTION_STAMINA_MAX = 100;
export const ACTION_SWING_STAMINA_COST = 10;
export const ACTION_STAMINA_REGEN_PER_SEC = 20;
