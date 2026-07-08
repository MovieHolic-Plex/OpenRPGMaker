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
import { resumeAudioState, stopAllAudio } from "@/player/audio";
import { ensureTilesetTexture } from "@/editor/tilesetImage";
import type { GameMap, MapId, MoveCommand, TilesetDef, Trigger } from "@/project/types";
import type { RuntimeEventPositions, RuntimeEventView } from "@/player/runtimeEventState";
import {
  type AutonomousMover,
  type ParallelProcess,
  type PlaySceneContext,
  type PlayerRouteState,
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
  showEndingScreen as showSceneEndingScreen,
  returnToTitle as returnSceneToTitle,
} from "@/player/playSceneOverlays";
import { installPlaySceneTestHooks } from "@/player/playSceneTestHooks";
import { applyStoredCameraState, centerRuntimeCamera, panRuntimeCamera } from "@/player/playSceneCamera";
import { hasSessionCheckpoint, restoreSessionCheckpoint, setSessionCheckpoint, getSessionCheckpoint } from "@/player/checkpoints";
import { syncFollowerSprites } from "@/player/playSceneFollowers";
import { installLightingLayer, syncLightingLayer, updateLighting } from "@/player/playSceneLighting";
import type { LightingAmbientTransition } from "@/player/lighting";
import { installWeatherLayer, syncWeatherLayer, updateWeather } from "@/player/playSceneWeather";
import type { WeatherParams, WeatherTransition } from "@/player/weather/weatherModel";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";
import { updateFieldSpawnsForScene } from "@/player/playSceneFieldSpawns";
import { applyAdvanceTimeStep, applySetTimeStep, installTimeTintLayer, sleepUntilMorningScene, updateGameTime, updateTimeTint } from "@/player/playSceneTime";

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
  followerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  declare runtimeDom: RuntimeDomOverlay;
  parallelProcesses: Map<string, ParallelProcess> = new Map();
  autoStartedKeys: Set<string> = new Set();
  pageMoveRouteKeys: Set<string> = new Set();
  pageMoveRouteEventIds: Set<string> = new Set();
  commandMoveRouteEventIds: Set<string> = new Set();
  missingResources: Set<string> = new Set();
  tileX = 0;
  tileY = 0;
  movingFrom = { x: 0, y: 0 };
  movingTo = { x: 0, y: 0 };
  moving = false;
  moveProgress = 0;
  moveDurationMs = 160;
  dashing = false;
  facing: "down" | "left" | "right" | "up" = "down";
  walkFrame = 0;
  walkTimer = 0;
  lastActionTargetKey = "";
  playerRoute: PlayerRouteState | null = null;
  autonomousNPCs: Map<string, AutonomousMover> = new Map();
  runtimeTimers: Map<string, RuntimeTimer> = new Map();
  fieldSpawnState: FieldSpawnRuntimeState | null = null;
  lightingOverlayImage?: Phaser.GameObjects.Image;
  lightingMaskTexture?: Phaser.Textures.CanvasTexture;
  lightingMaskSignature = "";
  lightingClockMs = 0;
  lightingFixedAccumulatorMs = 0;
  lightingTransition: LightingAmbientTransition | null = null;
  lightingTransitionWaiters: Array<() => void> = [];
  weatherClockMs = 0;
  weatherFixedAccumulatorMs = 0;
  weatherDisplayed: WeatherParams = { kind: "none", intensity: 0 };
  weatherTargetSignature = "none:0";
  weatherTransition: WeatherTransition | null = null;
  timeFixedAccumulatorMs = 0;
  timeMinuteAccumulator = 0;
  timeSleepInProgress = false;
  timeTintGraphics?: Phaser.GameObjects.Graphics;
  timeTintPhase?: import("@/project/gameTime").TimePhase;
  timeTintDisplayed?: import("@/player/playSceneTypes").TimeTintVisual;
  timeTintTransition: import("@/player/playSceneTypes").TimeTintTransition | null = null;
  mapAnimationLayer?: Phaser.GameObjects.Container;
  activeMapAnimations: Set<Phaser.GameObjects.Container> = new Set();

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
    this.loadMap(this.session.currentMapId, { preserveErasedEvents: true, applyDefaultLighting: false });
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player = this.add.sprite(
      characterSpriteX(this.tileX),
      characterSpriteY(this.tileY),
      this.playerSprite.texture,
      this.playerSprite.idleFrameFor("down")
    );
    placeCharacterSprite(this.player, "same");
    installWeatherLayer(this);
    installTimeTintLayer(this);
    installLightingLayer(this);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    syncFollowerSprites(this);
    this.centerCamera();
    // auto 트리거는 dialogue UI가 준비된 후에 실행해야 한다
    // (runEvent가 dialogue 없으면 즉시 return하므로). dialogue는 player.ts가
    // 게임 생성 후 registry에 설정한다 — 비동기이므로 준비될 때까지 기다린다.
    void this.fireAutoTriggersWhenReady();
    // 자동화(E2E)용 입력 주입 훅. headless Chromium에서는 window keydown이
    // Phaser keyboard 매니저에 도달하지 않아 실제 키보드 입력이 잡히지 않는다.
    // 테스트는 이 훅으로 Input에 action 엣지/방향을 직접 주입한다.
    // 실제 브라우저에서는 keydown 리스너가 정상 동작하므로 쓰이지 않는다.
    installPlaySceneTestHooks(this, this.input_, () => this.session, () => this.syncRuntimeState());
    // 세이브 로드로 진입한 세션이면 저장된 BGM/BGS 를 재개(원샷은 복원 안 함).
    resumeAudioState(this.session.audio, project);
    // 씬 종료(모드 전환/타이틀 복귀/게임 파괴) 시 모든 오디오 정지.
    this.events.once("shutdown", stopAllAudio);
    this.events.once("destroy", stopAllAudio);
  }

  update(_time: number, deltaMs: number): void {
    updatePlayScene(this, deltaMs);
    updateGameTime(this, deltaMs);
    updateWeather(this, deltaMs);
    updateTimeTint(this, deltaMs);
    updateLighting(this, deltaMs);
  }

  getMapId(): MapId {
    return this.session.currentMapId;
  }

  loadMap(mapId: MapId, options?: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean }): void {
    loadSceneMap(this, mapId, options);
    resetEncounterCounter();
  }

  renderTiles(): void {
    renderSceneTiles(this);
  }

  resolveTilesetTexture(tileset: TilesetDef): string {
    return ensureTilesetTexture(this, tileset);
  }

  activeRuntimeEvents(triggerKind: Trigger["kind"]): RuntimeEventView[] {
    return activeSceneEvents(this, triggerKind);
  }

  syncRuntimeState(): void {
    syncSceneRuntimeState(this);
  }

  refreshRuntimeSurfaces(): void {
    const project = store.getCurrent();
    const nextPlayerSprite = resolvePlayerSpriteResource(project, this.session);
    if (!this.playerSprite || this.playerSprite.resourceId !== nextPlayerSprite.resourceId) {
      this.playerSprite = nextPlayerSprite;
      this.player.setTexture(this.playerSprite.texture);
      this.player.setFrame(this.playerSprite.idleFrameFor(this.facing));
    }
    refreshSceneRuntimeSurfaces(this);
    syncFollowerSprites(this);
    applyStoredCameraState(this);
    syncWeatherLayer(this);
    installTimeTintLayer(this);
    syncLightingLayer(this);
  }

  centerCamera(): void {
    centerRuntimeCamera(this.cameras.main, this.map, this.player);
    applyStoredCameraState(this);
    syncWeatherLayer(this);
    installTimeTintLayer(this);
    syncLightingLayer(this);
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

  async sleepUntilMorning(): Promise<void> {
    await sleepUntilMorningScene(this, async (commands) => {
      const { runCommands } = await import("@/player/playSceneInterpreter");
      await runCommands(this, commands, undefined, { allowNested: true });
    });
  }

  applyAdvanceTimeStep(step: Extract<StepResult, { kind: "advanceTime" }>): Promise<void> {
    return applyAdvanceTimeStep(this, step);
  }

  applySetTimeStep(step: Extract<StepResult, { kind: "setTime" }>): void {
    applySetTimeStep(this, step);
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

  updateFieldSpawns(deltaMs: number): void {
    updateFieldSpawnsForScene(this, deltaMs);
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

  panScreen(step: Extract<StepResult, { kind: "scrollMap" }>): Promise<void> {
    return panRuntimeCamera(this, step);
  }

  getSession(): PlaySession {
    return this.session;
  }

  applySession(session: PlaySession): void {
    this.session = structuredClone(session);
    const project = store.getCurrent();
    this.playerSprite = resolvePlayerSpriteResource(project, this.session);
    this.loadMap(this.session.currentMapId, { preserveErasedEvents: true, applyDefaultLighting: false });
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player.setTexture(this.playerSprite.texture);
    this.player.setFrame(this.playerSprite.idleFrameFor(this.facing));
    this.player.setPosition(characterSpriteX(this.tileX), characterSpriteY(this.tileY));
    placeCharacterSprite(this.player, "same");
    for (const animation of this.activeMapAnimations) animation.destroy(true);
    this.activeMapAnimations.clear();
    this.runtimeTimers.clear();
    this.moving = false;
    this.centerCamera();
    // 인게임 로드: 이전 오디오 정지 후 저장된 BGM/BGS 재개.
    stopAllAudio();
    resumeAudioState(this.session.audio, project);
    this.refreshRuntimeSurfaces();
    syncFollowerSprites(this);
  }

  hasCheckpoint(): boolean {
    return hasSessionCheckpoint(this.session);
  }

  restoreCheckpoint(): void {
    const snapshot = getSessionCheckpoint(this.session);
    const restored = restoreSessionCheckpoint(store.getCurrent(), this.session);
    if (!restored || !snapshot) return;
    this.applySession(restored);
    setSessionCheckpoint(this.session, snapshot);
  }

  showGameOverScreen(message?: string): void {
    showSceneGameOverScreen(this, message);
  }

  showEndingScreen(title: string, message: string): void {
    showSceneEndingScreen(this, title, message);
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
