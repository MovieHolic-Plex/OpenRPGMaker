import type Phaser from "phaser";
import type { Interpreter } from "@/player/interpreter";
import type { Input, Dir } from "@/player/input";
import type { RuntimeEventPositions } from "@/project/runtimeEventState"
import type { RuntimeEventView } from "@/project/runtimeEventState"
import type { RuntimeDomOverlay } from "@/player/runtimeDom";
import type { PlayerSpriteResource } from "@/player/playerSpriteResources";
import type { GameMap, MapId, MoveCommand, TransferDirection, TransferFade, TransferTransition, Trigger } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { LightingAmbientTransition } from "@/project/lightingRules";
import type { WeatherParams, WeatherTransition } from "@/player/weather/weatherModel";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";
import type { TimePhase } from "@/project/gameTime";
import type { RuntimePerfCounters } from "@/player/runtimePerfCounters";

export const DIRECTION_ROW: Record<Dir, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

export type ParallelProcess = {
  pageId: string;
  currentEventId?: string;
  interpreter: Interpreter;
  waitMs: number;
  started: boolean;
  pendingTimeTransition?: Promise<boolean>;
  stopped?: boolean;
};

export type AutonomousMover = {
  stopOnBlocked?: boolean;
  moves: MoveCommand[];
  step: number;
  timer: number;
  repeat: boolean;
  strategy: "sequence" | "random" | "approach" | "chase";
  facing: Dir;
  directionFix: boolean;
  through: boolean;
  animationEnabled: boolean;
  opacity: number;
  speedRank: number;
  frequencyRank: number;
  moveIntervalMs: number;
  moveDurationMs: number;
  activeMove: AutonomousMoveTween | null;
  sightRange?: number;
  giveUpRange?: number;
  pathfind?: boolean;
  /** 원거리 적의 거리 유지 밴드(액션 전투 상태기가 심는다). */
  kite?: import("@/battle/action/kiting").KiteBand;
  /**
   * 추겁 목표 좌표 오버라이드. 진영 전투에서 적이 플레이어 대심 NPC 를 노릴 때
   * 액션 전투 상태기가 매 프레임 심는다. 있으면 추겁 경로가 이 칸을 목표로 삼는다.
   */
  chaseTarget?: { readonly x: number; readonly y: number } | undefined;
  /** Cache identity only; persisted search targets live in session.horror. */
  pursuitTargetKey?: string;
  chasePathBlocked?: boolean;
  chaseRepathTimerMs?: number;
  chasePath?: { readonly x: number; readonly y: number }[];
  chaseActive?: boolean;
  chaseHome?: { readonly x: number; readonly y: number };
  /** 액션 전투 상태기계가 선딜/후딜/돌진 중 이동을 억제할 때 세운다. */
  actionFrozen?: boolean;
  /**
   * 같은 걸음이 연속으로 막힌 횟수. `retryBlockedSteps` 무버만 쓴다.
   * playSceneAutonomous §retryBlockedStep 참조.
   */
  blockedSteps?: number;
  /**
   * 막힌 걸음을 소비하지 않고 다시 시도할지. **계산된** 경로(시간표·생활 이동의 A* 결과)만
   * 세운다 — 절대 방향 배열이라 한 걸음을 잃으면 남은 계획 전부가 실제 위치와 어긋난다.
   *
   * 작가가 쓴 페이지 이동 경로는 세우지 않는다. 그쪽은 막히면 걸음을 소비하고 넘어가는 것이
   * 이 엔진의 기존 동작이고(test/runtimeMoveRouteCommands), 작가는 "이 칸이 막혀 있으면
   * 이번엔 건너뛴다" 를 전제로 경로를 짠다.
   */
  retryBlockedSteps?: boolean;
};

export type AutonomousMoveTween = {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly dir: Dir;
  readonly baseFrame: number;
  elapsedMs: number;
  /** 체공 곡선. 있으면 스프라이트가 원점 리프트로 떠오른다(걸음 애니메이션 대신 정지 프레임). */
  readonly hop?: import("@/player/characterHop").CharacterHop;
  /** 이 한 수의 지속 시간. 없으면 mover.moveDurationMs(이동 속도) 를 쓴다. */
  readonly durationMs?: number;
};

export type RuntimeTimer = {
  remaining: number;
  active: boolean;
};

export type TimeTintVisual = {
  readonly color: number;
  readonly alpha: number;
};

export type TimeTintTransition = {
  readonly from: TimeTintVisual;
  readonly to: TimeTintVisual;
  readonly durationMs: number;
  elapsedMs: number;
};

export type TransferRequest = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly direction?: TransferDirection;
  readonly fade?: TransferFade;
  readonly transition?: TransferTransition;
};

export interface PlayerRouteState {
  stopOnBlocked?: boolean;
  moveDurationMs?: number;
  /** Apply a retargeted route's speed only after the current step lands. */
  nextMoveDurationMs?: number;
  moves: MoveCommand[];
  index: number;
  repeat: boolean;
}

/**
 * 주인공 체공 상태. 걸음 이동(`moving`/`moveProgress`) 과 **별도 채널**이다 —
 * 낙하는 타일 이동 없이 제자리에서 떨어지므로 이동 상태기에 얹을 수 없다.
 */
export interface PlayerHopState {
  readonly hop: import("@/player/characterHop").CharacterHop;
  /** 지나간 논리 프레임. 체공도 걸음과 같은 60Hz 틱으로 간다(hopFrames = round(durationMs / 틱). */
  elapsedFrames: number;
  /** 이 체공이 끝나면 걸음 이동 부수효과(발소리·인카운터·독)를 한 걸음으로 셀지. */
  readonly countsAsStep: boolean;
}

export interface PlaySceneContext extends Phaser.Scene {
  tileLayer: Phaser.GameObjects.Container;
  /** ★ 상층 타일 전용 — depth 가 same 캐릭터보다 높아야 숲 수관이 캐릭터 위에 그린다. */
  upperTileLayer: Phaser.GameObjects.Container;
  player: Phaser.GameObjects.Sprite;
  playerSprite: PlayerSpriteResource;
  input_: Input;
  session: PlaySession;
  map: GameMap;
  inputEnabled: boolean;
  running: boolean;
  eventPositions: RuntimeEventPositions;
  eventSprites: Map<string, Phaser.GameObjects.Sprite>;
  /** Runtime-only charset frame overrides from setEventGraphicPattern (cleared on map reset). */
  eventGraphicPatternOverrides: Map<string, number>;
  followerSprites: Map<string, Phaser.GameObjects.Sprite>;
  runtimeDom: RuntimeDomOverlay;
  parallelProcesses: Map<string, ParallelProcess>;
  autoStartedKeys: Set<string>;
  pageMoveRouteKeys: Set<string>;
  pageMoveRouteEventIds: Set<string>;
  commandMoveRouteEventIds: Set<string>;
  missingResources: Set<string>;
  tileX: number;
  tileY: number;
  movingFrom: { x: number; y: number };
  movingTo: { x: number; y: number };
  moving: boolean;
  moveProgress: number;
  /** 이번 걸음에서 지나간 논리 프레임. 걸음은 round(moveDurationMs / 틱) 프레임에 정확히 끝난다(RPG Maker 식). */
  moveElapsedFrames: number;
  moveDurationMs: number;
  /** deltaMs → 60Hz 논리 틱 변환의 잔여(ms). 주사율과 무관하게 1초 = 60틱이 되게 한다. */
  logicTickAccumulatorMs: number;
  dashing: boolean;
  facing: Dir;
  walkFrame: number;
  walkTimer: number;
  lastActionTargetKey: string;
  // 주인공 강제 이동 루트(이동 루트 설정 → 주인공). null 이면 일반 입력 이동.
  playerRoute: PlayerRouteState | null;
  autonomousNPCs: Map<string, AutonomousMover>;
  runtimeTimers: Map<string, RuntimeTimer>;
  fieldSpawnState: FieldSpawnRuntimeState | null;
  lightingOverlayImage?: Phaser.GameObjects.Image;
  lightingMaskTexture?: Phaser.Textures.CanvasTexture;
  lightingMaskSignature: string;
  lightingClockMs: number;
  lightingFixedAccumulatorMs: number;
  lightingTransition: LightingAmbientTransition | null;
  lightingTransitionWaiters: Array<() => void>;
  weatherLayer?: Phaser.GameObjects.Container;
  weatherGraphics?: Phaser.GameObjects.Graphics;
  weatherClockMs: number;
  weatherFixedAccumulatorMs: number;
  weatherDisplayed: WeatherParams;
  weatherTargetSignature: string;
  weatherTransition: WeatherTransition | null;
  timeFixedAccumulatorMs: number;
  timeMinuteAccumulator: number;
  timeSleepInProgress: boolean;
  timeTintGraphics?: Phaser.GameObjects.Graphics;
  timeTintPhase?: TimePhase;
  timeTintDisplayed?: TimeTintVisual;
  timeTintTransition: TimeTintTransition | null;
  mapAnimationLayer?: Phaser.GameObjects.Container;
  activeMapAnimations: Set<Phaser.GameObjects.Container>;
  /** 체공 그림자 풀. 키는 `PLAYER_SHADOW_KEY` 또는 이벤트 id — 스프라이트 풀과 1:1. */
  characterShadows?: Map<string, import("@/player/characterShadow").ShadowImage>;
  /** 체공 스쿼시의 기준 배율 풀. 그림자 풀과 같은 키·같은 수명이다. */
  characterHopScales?: Map<string, import("@/player/characterHop").HopScale>;
  /** 주인공의 진행 중인 체공. null 이면 접지 상태다. */
  playerHop: PlayerHopState | null;
  /** 재생성·카메라 스냅 계수기. QA 훅 `__oprnPerf` 가 읽는다. */
  perfCounters?: RuntimePerfCounters;
  getMapId(): MapId;
  loadMap(mapId: MapId, options?: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean; readonly applyMapBgm?: boolean }): void;
  renderTiles(): void;
  syncRuntimeState(): void;
  refreshRuntimeSurfaces(): void;
  /** 이벤트 계층만 갱신한다(타일 재생성 없음). NPC·시간표 변경에 쓴다. */
  refreshRuntimeEntities(): void;
  centerCamera(): void;
  setInputEnabled(enabled: boolean): void;
  activeRuntimeEvents(triggerKind: Trigger["kind"]): RuntimeEventView[];
  runEvent(eventId: string): Promise<void>;
  applyChangeTileStep(step: {
    kind: "changeTile";
    mapId: MapId;
    layer: "lower" | "upper";
    x: number;
    y: number;
    tile: number;
  }): void;
  transferTo(request: TransferRequest): Promise<void>;
  flashScreen(step: { red: number; green: number; blue: number; durationMs: number }): Promise<void>;
  shakeScreen(step: { intensity: number; durationMs: number }): Promise<void>;
  panScreen(step: {
    direction: "down" | "left" | "right" | "up";
    distanceTiles: number;
    durationMs: number;
    wait: boolean;
    returnToPlayer: boolean;
    lock: boolean;
  }): Promise<void>;
  playBattle(step: {
    kind: "battleProcessing";
    troopId: string;
    canEscape: boolean;
    canLose: boolean;
    battleFlow?: "gauge" | "strict";
    // 전투를 기동한 맵 이벤트 id(트룹 배틀 이벤트 selfSwitch 소유 이벤트). 인카운터/스폰은 없음.
    ownerEventId?: string;
  }): Promise<"victory" | "defeat" | "escape">;
  showBattleScene(troopId: string): void;
  showRuntimeOverlay(testId: string, text: string): void;
  clearRuntimeOverlay(testId: string): void;
  registerAutonomousMover(eventId: string, moves: MoveCommand[], repeat: boolean): void;
  registerPageMoveRoutes(): void;
  updateParallelEvents(deltaMs: number): void;
  updateAutonomousNPCs(deltaMs: number): void;
  updateTimers(deltaMs: number): void;
  updateFieldSpawns(deltaMs: number): void;
  actionCombatState?: import("@/player/actionCombatTypes").ActionCombatSceneState | null;
  updateActionCombat?(deltaMs: number): void;
  sleepUntilMorning(): Promise<boolean>;
  hasCheckpoint(): boolean;
  restoreCheckpoint(): void;
  showGameOverScreen(message?: string): void;
  showEndingScreen(title: string, message: string): void;
  returnToTitle(): void;
}

export function assertNever(value: never): never {
  void value;
  throw new Error("Unhandled PlayScene variant");
}
