import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import {
  loadBundledAssets,
  registerBundledFrames,
  TEX_HERO,
  TILE_SIZE,
} from "@/assets/bundled";
import type { BattleResult } from "@/battle/runtime";
import { store } from "@/project/store";
import { startSession, type PlaySession } from "@/project/session";
import { Input } from "@/player/input";
import type { StepResult } from "@/player/interpreter";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import type { GameMap, MapId, MoveCommand, Trigger } from "@/project/types";
import type { RuntimeEventPositions, RuntimeEventView } from "@/player/runtimeEventState";
import {
  DIRECTION_ROW,
  type AutonomousMover,
  type ParallelProcess,
  type PlaySceneContext,
  type RuntimeTimer,
} from "@/player/playSceneTypes";
import {
  loadMap as loadSceneMap,
  renderTiles as renderSceneTiles,
  activeRuntimeEvents as activeSceneEvents,
  syncRuntimeState as syncSceneRuntimeState,
  refreshRuntimeSurfaces as refreshSceneRuntimeSurfaces,
  fireAutoTriggers as fireSceneAutoTriggers,
  applyChangeTileStep as applySceneChangeTileStep,
  transferTo as transferSceneTo,
} from "@/player/playSceneMapRuntime";
import { updatePlayScene } from "@/player/playSceneMovement";
import { runEvent as runSceneEvent } from "@/player/playSceneInterpreter";
import {
  registerAutonomousMover as registerSceneAutonomousMover,
  registerPageMoveRoutes as registerScenePageMoveRoutes,
  updateParallelEvents as updateSceneParallelEvents,
  updateAutonomousNPCs as updateSceneAutonomousNpcs,
  updateTimers as updateSceneTimers,
} from "@/player/playSceneSchedulers";
import {
  showRuntimeOverlay as showSceneRuntimeOverlay,
  clearRuntimeOverlay as clearSceneRuntimeOverlay,
  showGameOverScreen as showSceneGameOverScreen,
  returnToTitle as returnSceneToTitle,
} from "@/player/playSceneOverlays";

const PhaserRuntime = getLoadedPhaser();

export class PlayScene extends PhaserRuntime.Scene implements PlaySceneContext {
  declare tileLayer: Phaser.GameObjects.Container;
  declare player: Phaser.GameObjects.Sprite;
  declare input_: Input;
  declare session: PlaySession;
  declare map: GameMap;
  inputEnabled = true;
  running = false;
  eventPositions: RuntimeEventPositions = {};
  eventSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  declare runtimeDom: RuntimeDomOverlay;
  parallelProcesses: Map<string, ParallelProcess> = new Map();
  autoStartedKeys: Set<string> = new Set();
  pageMoveRouteKeys: Set<string> = new Set();
  missingResources: Set<string> = new Set();
  tileX = 0;
  tileY = 0;
  movingFrom = { x: 0, y: 0 };
  movingTo = { x: 0, y: 0 };
  moving = false;
  moveProgress = 0;
  moveDurationMs = 160;
  facing: "down" | "left" | "right" | "up" = "down";
  walkFrame = 0;
  walkTimer = 0;
  lastActionTargetKey = "";
  autonomousNPCs: Map<string, AutonomousMover> = new Map();
  runtimeTimers: Map<string, RuntimeTimer> = new Map();

  constructor() {
    super({ key: "PlayScene" });
  }

  preload(): void {
    loadBundledAssets(this);
  }

  create(): void {
    registerBundledFrames(this);
    this.cameras.main.setBackgroundColor("#000");
    this.tileLayer = this.add.container(0, 0);
    this.input_ = new Input(this);
    this.runtimeDom = new RuntimeDomOverlay(() => {
      const host: unknown = this.game.registry.get("dialogueHost");
      return host instanceof HTMLElement ? host : undefined;
    });
    const project = store.getCurrent();
    this.session = this.initialSession(project);
    this.loadMap(this.session.currentMapId);
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player = this.add.sprite(
      this.tileX * TILE_SIZE + TILE_SIZE / 2,
      this.tileY * TILE_SIZE + TILE_SIZE / 2,
      TEX_HERO,
      DIRECTION_ROW.down
    );
    this.player.setOrigin(0.5, 0.5);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.centerCamera();
    void this.fireAutoTriggers();
  }

  update(_time: number, deltaMs: number): void {
    updatePlayScene(this, deltaMs);
  }

  getMapId(): MapId {
    return this.session.currentMapId;
  }

  loadMap(mapId: MapId): void {
    loadSceneMap(this, mapId);
  }

  renderTiles(): void {
    renderSceneTiles(this);
  }

  activeRuntimeEvents(triggerKind: Trigger["kind"]): RuntimeEventView[] {
    return activeSceneEvents(this, triggerKind);
  }

  syncRuntimeState(): void {
    syncSceneRuntimeState(this);
  }

  refreshRuntimeSurfaces(): void {
    refreshSceneRuntimeSurfaces(this);
  }

  centerCamera(): void {
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.input_.setEnabled(enabled);
    this.syncRuntimeState();
  }

  runEvent(eventId: string): Promise<void> {
    return runSceneEvent(this, eventId);
  }

  applyChangeTileStep(step: Extract<StepResult, { kind: "changeTile" }>): void {
    applySceneChangeTileStep(this, step);
  }

  showBattleScene(troopId: string): void {
    this.showRuntimeOverlay("battle-scene", troopId || "battle");
  }

  playBattle(step: Extract<StepResult, { kind: "battleProcessing" }>): Promise<BattleResult> {
    const startedAt = performance.now();
    return import("@/player/playSceneBattle").then(({ playBattle }) => {
      return playBattle(this, step, startedAt);
    });
  }

  showRuntimeOverlay(testId: string, text: string): void {
    showSceneRuntimeOverlay(this, testId, text);
  }

  clearRuntimeOverlay(testId: string): void {
    clearSceneRuntimeOverlay(this, testId);
  }

  registerAutonomousMover(eventId: string, moves: MoveCommand[], repeat: boolean): void {
    registerSceneAutonomousMover(this, eventId, moves, repeat);
  }

  registerPageMoveRoutes(): void {
    registerScenePageMoveRoutes(this);
  }

  updateParallelEvents(deltaMs: number): void {
    updateSceneParallelEvents(this, deltaMs);
  }

  updateAutonomousNPCs(deltaMs: number): void {
    updateSceneAutonomousNpcs(this, deltaMs);
  }

  updateTimers(deltaMs: number): void {
    updateSceneTimers(this, deltaMs);
  }

  transferTo(mapId: MapId, x: number, y: number): void {
    transferSceneTo(this, mapId, x, y);
  }

  getSession(): PlaySession {
    return this.session;
  }

  applySession(session: PlaySession): void {
    this.session = structuredClone(session);
    this.loadMap(this.session.currentMapId);
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player.setPosition(
      this.tileX * TILE_SIZE + TILE_SIZE / 2,
      this.tileY * TILE_SIZE + TILE_SIZE / 2
    );
    this.runtimeTimers.clear();
    this.moving = false;
    this.centerCamera();
    this.refreshRuntimeSurfaces();
  }

  showGameOverScreen(): void {
    showSceneGameOverScreen(this);
  }

  returnToTitle(): void {
    returnSceneToTitle(this);
  }

  private async fireAutoTriggers(): Promise<void> {
    await fireSceneAutoTriggers(this);
  }

  private initialSession(project: ReturnType<typeof store.getCurrent>): PlaySession {
    const value: unknown = this.game.registry.get("initialSession");
    return isPlaySession(value) ? structuredClone(value) : startSession(project);
  }
}

function isPlaySession(value: unknown): value is PlaySession {
  if (typeof value !== "object" || value === null) return false;
  return (
    "switches" in value &&
    "variables" in value &&
    "timers" in value &&
    "currentMapId" in value &&
    "x" in value &&
    "y" in value &&
    "mapOverrides" in value &&
    "flags" in value &&
    "audio" in value &&
    "pictures" in value
  );
}
