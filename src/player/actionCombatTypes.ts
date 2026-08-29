import type Phaser from "phaser";
import type { AttackBufferState } from "@/battle/action/attackWindow";
import type { ResolvedActionCombatConfig } from "@/project/actionCombat";
import type { CharacterFootprint, EnemyActionAttack } from "@/project/types";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";

// "stagger" = 피겪 경직. 진행 중이던 선딜/돌진을 끊고 짧게 허점을 여는다(src/battle/action/stagger.ts).
export type ActionEnemyMode = "combat" | "windup" | "dash" | "recover" | "stagger";

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
  /**
   * 적의 몸 크기. 전투 판정 전부(접촉·스윙·투사체·대시·점유)가 이 발자국의 **몸 사각**을 쓴다.
   * 발자국 없는 적은 1x1 이라 모든 판정이 앵커 한 칸으로 환원된다(항등).
   *
   * 사각을 캐시하지 않는 이유: 적은 매 프레임 움직이므로 저장된 사각은 곧 낡는다.
   * 크기는 정적이고, 사각은 쓰는 자리에서 현재 좌표와 합쳐 만든다.
   */
  readonly footprint: CharacterFootprint;
  /** 통행 차단 행. 이동 판정에만 쓰고 전투 판정에는 쓰지 않는다(사용자 결정: 전투는 몸 전체). */
  readonly passRows: number;
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
  /** 사망 연출(페이드)이 이미 시작됐는가 — 보상 이중 지급 방지. */
  dying?: boolean;
  /** 넉백 스프라이트 트윈. 연속 타격 때 이전 트윈을 먼저 멈춘다. */
  knockbackTween?: Phaser.Tweens.Tween;
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
  /** 이번 프레임 홀드 가드가 서 있는가. */
  guarding: boolean;
  /** 가드 중 피해 배수(1 = 감소 없음). */
  guardMultiplier: number;
  /** 배운 액션 스킬을 숬서대로 추린 슬롯. */
  skillSlotIds: string[];
  /** 현재 출려로 캐스트하는 슬롯 인덱스. */
  activeSkillSlot: number;
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
  /** 슬롯에 올라은 액션 스킬 이름(표시용). */
  readonly skillSlotNames: readonly string[];
  readonly activeSkillSlot: number;
  readonly guarding: boolean;
}

export const ACTION_STAMINA_MAX = 100;
export const ACTION_SWING_STAMINA_COST = 10;
export const ACTION_STAMINA_REGEN_PER_SEC = 20;
