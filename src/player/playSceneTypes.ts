import type Phaser from "phaser";
import type { Interpreter } from "@/player/interpreter";
import type { Input, Dir } from "@/player/input";
import type { RuntimeEventPositions } from "@/player/runtimeEventState";
import type { RuntimeEventView } from "@/player/runtimeEventState";
import type { RuntimeDomOverlay } from "@/player/runtimeDom";
import type { PlayerSpriteResource } from "@/player/playerSpriteResources";
import type { GameMap, MapId, MoveCommand, TransferDirection, TransferFade, TransferTransition, Trigger } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { LightingAmbientTransition } from "@/player/lighting";
import type { WeatherParams, WeatherTransition } from "@/player/weather/weatherModel";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";
import type { TimePhase } from "@/project/gameTime";

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
};

export type AutonomousMover = {
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
  chaseRepathTimerMs?: number;
  chasePath?: { readonly x: number; readonly y: number }[];
  chaseActive?: boolean;
  chaseHome?: { readonly x: number; readonly y: number };
  /** 액션 전투 상태기계가 선딜/후딜/돌진 중 이동을 억제할 때 세운다. */
  actionFrozen?: boolean;
};

export type AutonomousMoveTween = {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly dir: Dir;
  readonly baseFrame: number;
  elapsedMs: number;
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
  moves: MoveCommand[];
  index: number;
  repeat: boolean;
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
  moveDurationMs: number;
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
  getMapId(): MapId;
  loadMap(mapId: MapId, options?: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean; readonly applyMapBgm?: boolean }): void;
  renderTiles(): void;
  syncRuntimeState(): void;
  refreshRuntimeSurfaces(): void;
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
  sleepUntilMorning(): Promise<void>;
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
