import type Phaser from "phaser";
import type { Interpreter } from "@/player/interpreter";
import type { Input, Dir } from "@/player/input";
import type { RuntimeEventPositions } from "@/player/runtimeEventState";
import type { RuntimeEventView } from "@/player/runtimeEventState";
import type { RuntimeDomOverlay } from "@/player/runtimeDom";
import type { PlayerSpriteResource } from "@/player/playerSpriteResources";
import type { GameMap, MapId, MoveCommand, TransferDirection, TransferFade, TransferTransition, Trigger } from "@/project/types";
import type { PlaySession } from "@/project/session";

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
  strategy: "sequence" | "random" | "approach";
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
  player: Phaser.GameObjects.Sprite;
  playerSprite: PlayerSpriteResource;
  input_: Input;
  session: PlaySession;
  map: GameMap;
  inputEnabled: boolean;
  running: boolean;
  eventPositions: RuntimeEventPositions;
  eventSprites: Map<string, Phaser.GameObjects.Sprite>;
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
  getMapId(): MapId;
  loadMap(mapId: MapId, options?: { readonly preserveErasedEvents?: boolean }): void;
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
  playBattle(step: {
    kind: "battleProcessing";
    troopId: string;
    canEscape: boolean;
    canLose: boolean;
  }): Promise<"victory" | "defeat" | "escape">;
  showBattleScene(troopId: string): void;
  showRuntimeOverlay(testId: string, text: string): void;
  clearRuntimeOverlay(testId: string): void;
  registerAutonomousMover(eventId: string, moves: MoveCommand[], repeat: boolean): void;
  registerPageMoveRoutes(): void;
  updateParallelEvents(deltaMs: number): void;
  updateAutonomousNPCs(deltaMs: number): void;
  updateTimers(deltaMs: number): void;
  showGameOverScreen(): void;
  showEndingScreen(title: string, message: string): void;
  returnToTitle(): void;
}

export function assertNever(value: never): never {
  void value;
  throw new Error("Unhandled PlayScene variant");
}
