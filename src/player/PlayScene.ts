import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import {
  loadBundledAssets,
  registerBundledFrames,
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
  type AutonomousMover,
  type ParallelProcess,
  type PlaySceneContext,
  type TransferRequest,
  type RuntimeTimer,
} from "@/player/playSceneTypes";
import {
  resolvePlayerSpriteResource,
  type PlayerSpriteResource,
} from "@/player/playerSpriteResources";
import {
  loadMap as loadSceneMap,
  renderTiles as renderSceneTiles,
  activeRuntimeEvents as activeSceneEvents,
  syncRuntimeState as syncSceneRuntimeState,
  refreshRuntimeSurfaces as refreshSceneRuntimeSurfaces,
  fireAutoTriggers as fireSceneAutoTriggers,
} from "@/player/playSceneMapRuntime";
import {
  applyChangeTileStep as applySceneChangeTileStep,
  flashCamera,
  shakeCamera,
  transferTo as transferSceneTo,
} from "@/player/playSceneMapCommands";
import { resetEncounterCounter, updatePlayScene } from "@/player/playSceneMovement";
import { characterSpriteX, characterSpriteY, placeCharacterSprite } from "@/player/characterDepth";
import { runEvent as runSceneEvent } from "@/player/playSceneInterpreter";
import {
  registerAutonomousMover as registerSceneAutonomousMover,
  updateParallelEvents as updateSceneParallelEvents,
  updateTimers as updateSceneTimers,
} from "@/player/playSceneSchedulers";
import { registerPageMoveRoutes as registerScenePageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { updateAutonomousNPCs as updateSceneAutonomousNpcs } from "@/player/playSceneAutonomous";
import {
  showRuntimeOverlay as showSceneRuntimeOverlay,
  clearRuntimeOverlay as clearSceneRuntimeOverlay,
  showGameOverScreen as showSceneGameOverScreen,
  returnToTitle as returnSceneToTitle,
} from "@/player/playSceneOverlays";
import { installPlaySceneTestHooks } from "@/player/playSceneTestHooks";
import { centerRuntimeCamera } from "@/player/playSceneCamera";

const PhaserRuntime = getLoadedPhaser();

export class PlayScene extends PhaserRuntime.Scene implements PlaySceneContext {
  declare tileLayer: Phaser.GameObjects.Container;
  declare player: Phaser.GameObjects.Sprite;
  declare playerSprite: PlayerSpriteResource;
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
  pageMoveRouteEventIds: Set<string> = new Set();
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
    this.playerSprite = resolvePlayerSpriteResource(project, this.session);
    this.loadMap(this.session.currentMapId);
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player = this.add.sprite(
      characterSpriteX(this.tileX),
      characterSpriteY(this.tileY),
      this.playerSprite.texture,
      this.playerSprite.idleFrameFor("down")
    );
    placeCharacterSprite(this.player, "same");
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.centerCamera();
    // auto 트리거는 dialogue UI가 준비된 후에 실행해야 한다
    // (runEvent가 dialogue 없으면 즉시 return하므로). dialogue는 player.ts가
    // 게임 생성 후 registry에 설정한다 — 비동기이므로 준비될 때까지 기다린다.
    void this.fireAutoTriggersWhenReady();
    // 자동화(E2E)용 입력 주입 훅. headless Chromium에서는 window keydown이
    // Phaser keyboard 매니저에 도달하지 않아 실제 키보드 입력이 잡히지 않는다.
    // 테스트는 이 훅으로 Input에 action 엣지/방향을 직접 주입한다.
    // 실제 브라우저에서는 keydown 리스너가 정상 동작하므로 쓰이지 않는다.
    installPlaySceneTestHooks(this, this.input_, this.session, () => this.syncRuntimeState());
  }

  update(_time: number, deltaMs: number): void {
    updatePlayScene(this, deltaMs);
  }

  getMapId(): MapId {
    return this.session.currentMapId;
  }

  loadMap(mapId: MapId): void {
    loadSceneMap(this, mapId);
    resetEncounterCounter();
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
    centerRuntimeCamera(this.cameras.main, this.map, this.player);
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

  transferTo(request: TransferRequest): Promise<void> {
    return transferSceneTo(this, request);
  }

  flashScreen(step: Extract<StepResult, { kind: "flashScreen" }>): Promise<void> {
    return flashCamera(this, step);
  }

  shakeScreen(step: Extract<StepResult, { kind: "shakeScreen" }>): Promise<void> {
    return shakeCamera(this, step);
  }

  getSession(): PlaySession {
    return this.session;
  }

  applySession(session: PlaySession): void {
    this.session = structuredClone(session);
    const project = store.getCurrent();
    this.playerSprite = resolvePlayerSpriteResource(project, this.session);
    this.loadMap(this.session.currentMapId);
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player.setTexture(this.playerSprite.texture);
    this.player.setFrame(this.playerSprite.idleFrameFor(this.facing));
    this.player.setPosition(characterSpriteX(this.tileX), characterSpriteY(this.tileY));
    placeCharacterSprite(this.player, "same");
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

  // dialogue UI가 registry에 설정될 때까지 기다린 뒤 auto 트리거를 발화.
  // player.ts가 게임 생성 후 비동기로 dialogue를 registry에 넣기 때문에,
  // create 시점에는 아직 없을 수 있다. 준비되면 fireAutoTriggers를 호출한다.
  private async fireAutoTriggersWhenReady(): Promise<void> {
    if (this.game.registry.get("dialogue")) {
      await this.fireAutoTriggers();
      return;
    }
    this.game.registry.events.once("changedata", this.onRegistryDialogueReady);
  }

  private readonly onRegistryDialogueReady = (_parent: unknown, key: string): void => {
    if (key !== "dialogue") return;
    void this.fireAutoTriggers();
  };

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
