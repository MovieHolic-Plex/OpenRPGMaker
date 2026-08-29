import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import {
  loadBundledAssets,
  registerBundledFrames,
} from "@/assets/bundled";
import type { BattleResult } from "@/battle/runtime";
import { store } from "@/project/store";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { resolvePlayResolution } from "@/project/playResolution";
import { startSession, type PlaySession } from "@/project/session";
import { Input } from "@/player/input";
import type { StepResult } from "@/player/interpreter";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { resumeAudioState, stopAllAudio } from "@/player/audio";
import { startMapBgm } from "@/player/mapBgm";
import { ensureTilesetTexture } from "@/editor/tilesetImage";
import type { GameMap, MapId, MoveCommand, TilesetDef, Trigger } from "@/project/types";
import type { RuntimeEventPositions, RuntimeEventView } from "@/project/runtimeEventState"
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
  refreshRuntimeEntities as refreshSceneRuntimeEntities,
  fireAutoTriggers as fireSceneAutoTriggers,
} from "@/player/playSceneMapRuntime";
import {
  applyChangeTileStep as applySceneChangeTileStep,
  flashCamera,
  shakeCamera,
  transferTo as transferSceneTo,
} from "@/player/playSceneMapCommands";
import { resetEncounterCounter, updatePlayScene } from "@/player/playSceneMovement";
import { characterSpriteY, footprintSpriteX, MAP_LOWER_LAYER_DEPTH, MAP_UPPER_LAYER_DEPTH, placeCharacterSprite } from "@/player/characterDepth";
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
import type { LightingAmbientTransition } from "@/project/lightingRules";
import { installWeatherLayer, syncWeatherLayer, updateWeather } from "@/player/playSceneWeather";
import type { WeatherParams, WeatherTransition } from "@/player/weather/weatherModel";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";
import { updateFieldSpawnsForScene } from "@/player/playSceneFieldSpawns";
import { initializeActionCombatForScene, updateActionCombatForScene } from "@/player/playSceneActionCombat";
import { applyAdvanceTimeStep, applySetTimeStep, installTimeTintLayer, isGameTimePausedForRuntime, sleepUntilMorningScene, updateGameTime, updateTimeTint } from "@/player/playSceneTime";
import { tickNpcSchedules, updateNpcSchedules } from "@/player/npcSchedules";
import { syncTileCulling } from "@/player/playSceneTileCulling";
import {
  createPlaySceneZoneFeedback,
  destroyPlaySceneZoneFeedback,
  syncPlaySceneZoneFeedback,
  type PlaySceneZoneFeedback,
} from "@/player/playSceneZoneFeedback";
import { mountHandSlotChip, type HandSlotChip } from "@/player/handSlotChip";
import { dialogueHost } from "@/player/playSceneDom";
import {
  createMinimap,
  destroyMinimap,
  syncMinimapPosition,
  syncMinimapVisibility,
  type MinimapRuntimeState,
} from "@/player/minimap";

const PhaserRuntime = getLoadedPhaser();

export class PlayScene extends PhaserRuntime.Scene implements PlaySceneContext {
  declare tileLayer: Phaser.GameObjects.Container;
  declare upperTileLayer: Phaser.GameObjects.Container;
  declare player: Phaser.GameObjects.Sprite;
  declare playerSprite: PlayerSpriteResource;
  declare input_: Input;
  declare session: PlaySession;
  declare map: GameMap;
  inputEnabled = true;
  running = false;
  eventPositions: RuntimeEventPositions = {};
  eventSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  eventGraphicPatternOverrides: Map<string, number> = new Map();
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
  playerHop: import("@/player/playSceneTypes").PlayerHopState | null = null;
  characterShadows: Map<string, import("@/player/characterShadow").ShadowImage> = new Map();
  autonomousNPCs: Map<string, AutonomousMover> = new Map();
  runtimeTimers: Map<string, RuntimeTimer> = new Map();
  fieldSpawnState: FieldSpawnRuntimeState | null = null;
  actionCombatState: import("@/player/actionCombatTypes").ActionCombatSceneState | null = null;
  private zoneFeedback: PlaySceneZoneFeedback | null = null;
  private minimap: MinimapRuntimeState | null = null;
  private handSlotChip: HandSlotChip | null = null;
  private handSlotHost: HTMLElement | null = null;
  private minimapUserHidden = false;
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
    const reportProgress = (ratio: number): void => {
      const handler: unknown = this.game.registry.get("onPlayLoadProgress");
      if (typeof handler === "function") {
        (handler as (ratio: number) => void)(ratio);
      }
    };
    this.load.on("progress", reportProgress);
    reportProgress(0);
    loadBundledAssets(this, store.getCurrent());
  }

  create(): void {
    const reportStage = (stage: "map" | "ready"): void => {
      const handler: unknown = this.game.registry.get("onPlayLoadStage");
      if (typeof handler === "function") {
        (handler as (stage: "map" | "ready") => void)(stage);
      }
    };
    reportStage("map");
    const project = store.getCurrent();
    const qaInstrumentation = this.game.registry.get("qaInstrumentation") === true;
    const playResolution = resolvePlayResolution(project.system);
    registerBundledFrames(this, project);
    this.cameras.main.setBackgroundColor("#000");
    this.tileLayer = this.add.container(0, 0);
    this.tileLayer.setDepth(MAP_LOWER_LAYER_DEPTH);
    this.upperTileLayer = this.add.container(0, 0);
    this.upperTileLayer.setDepth(MAP_UPPER_LAYER_DEPTH);
    this.input_ = new Input(this);
    this.runtimeDom = new RuntimeDomOverlay(() => {
      const host: unknown = this.game.registry.get("dialogueHost");
      return host instanceof HTMLElement ? host : undefined;
    }, { qaInstrumentation, playResolution });
    this.session = this.initialSession(project);
    this.zoneFeedback = createPlaySceneZoneFeedback(this.session);
    // dialogueHost 는 player.ts 가 게임 생성 후 registry 에 넣으므로 여기선 아직 없을 수 있다.
    // zoneFeedback 과 동일하게 update 에서 host 를 다시 해석해 붙인다.
    this.syncHandSlotChip();
    this.playerSprite = resolvePlayerSpriteResource(project, this.session);
    this.loadMap(this.session.currentMapId, { preserveErasedEvents: true, applyDefaultLighting: false, applyMapBgm: false });
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player = this.add.sprite(
      // 주인공도 **몸 중앙**에 놓는다 — 1x1 이면 타일 중앙과 같은 값이다(항등).
      footprintSpriteX(this.tileX, resolvePlayerBody(project, this.session).footprint),
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
    void this.syncMinimap();
    // M = minimap toggle. Input abstraction doesn't expose Phaser keyboard; use document.
    const toggleMinimap = (): void => {
      if (!this.minimap) return;
      this.minimapUserHidden = !this.minimapUserHidden;
      const host = this.game.registry.get("dialogueHost") as HTMLElement | undefined;
      syncMinimapVisibility(this.minimap, host ?? null, this.minimapUserHidden);
    };
    const onDocKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === "m" && !e.repeat) toggleMinimap();
    };
    document.addEventListener("keydown", onDocKey);
    const detachMinimapKey = (): void => {
      document.removeEventListener("keydown", onDocKey);
    };
    this.events.once("shutdown", detachMinimapKey);
    this.events.once("destroy", detachMinimapKey);
    updateNpcSchedules(this, false);
    // auto 트리거는 dialogue UI가 준비된 후에 실행해야 한다
    // (runEvent가 dialogue 없으면 즉시 return하므로). dialogue는 player.ts가
    // 게임 생성 후 registry에 설정한다 — 비동기이므로 준비될 때까지 기다린다.
    const initialEventTestId = this.initialEventTestId();
    if (initialEventTestId) {
      void this.runInitialEventTestWhenReady(initialEventTestId);
    } else {
      void this.fireAutoTriggersWhenReady();
    }
    // 자동화(E2E)용 입력 주입 훅. headless Chromium에서는 window keydown이
    // Phaser keyboard 매니저에 도달하지 않아 실제 키보드 입력이 잡히지 않는다.
    // 테스트는 이 훅으로 Input에 action 엣지/방향을 직접 주입한다.
    // 실제 브라우저에서는 keydown 리스너가 정상 동작하므로 쓰이지 않는다.
    // Debug/mutation globals are QA instrumentation. A normal export boot installs none of
    // them; the runtime QA harness opts in through the boot config capability.
    if (qaInstrumentation) {
      installPlaySceneTestHooks(this, this.input_, () => this.session, () => this.syncRuntimeState());
    }
    // 세이브 로드로 진입한 세션이면 저장된 BGM/BGS 를 재개(원샷은 복원 안 함).
    resumeAudioState(this.session.audio, project);
    // 새 게임(저장된 BGM 없음)이면 시작 맵의 BGM 으로 시작한다 — 이게 없으면 게임이 무음으로 켜진다.
    if (!this.session.audio.bgm) startMapBgm(project, this.session, this.session.currentMapId);
    // 씬 종료(모드 전환/타이틀 복귀/게임 파괴) 시 모든 오디오 정지.
    this.events.once("shutdown", stopAllAudio);
    this.events.once("destroy", stopAllAudio);
    const destroyZoneFeedback = (): void => {
      if (!this.zoneFeedback) return;
      destroyPlaySceneZoneFeedback(this.zoneFeedback);
      this.zoneFeedback = null;
    };
    const destroyHandSlotChip = (): void => {
      this.handSlotChip?.destroy();
      this.handSlotChip = null;
      this.handSlotHost = null;
    };
    this.events.once("shutdown", destroyHandSlotChip);
    this.events.once("destroy", destroyHandSlotChip);
    const destroyMinimapLocal = (): void => {
      if (!this.minimap) return;
      destroyMinimap(this.minimap);
      this.minimap = null;
    };
    this.events.once("shutdown", destroyMinimapLocal);
    this.events.once("destroy", destroyMinimapLocal);
    this.events.once("shutdown", destroyZoneFeedback);
    this.events.once("destroy", destroyZoneFeedback);
    // player.ts 로딩 오버레이가 create 완료를 기다릴 수 있게 신호.
    reportStage("ready");
    const onReady: unknown = this.game.registry.get("onPlaySceneReady");
    if (typeof onReady === "function") {
      (onReady as () => void)();
    }
    this.game.events.emit("playscene-ready");
  }

  update(_time: number, deltaMs: number): void {
    updatePlayScene(this, deltaMs);
    updateGameTime(this, deltaMs);
    tickNpcSchedules(this, isGameTimePausedForRuntime(this), deltaMs);
    updateWeather(this, deltaMs);
    updateTimeTint(this, deltaMs);
    updateLighting(this, deltaMs);
    syncTileCulling(this, this.cameras.main.worldView);
    // 이벤트 마커는 화면 좌표로 놓여야 한다 — 카메라를 반영하지 않으면 무대의 스크롤 영역이
    // 맵 크기만큼 부풀고, 마커 클릭이 무대를 스크롤시켜 재생 화면이 검게 된다(runtimeDom 주석).
    this.runtimeDom.syncCameraOffset(this.cameras.main.scrollX, this.cameras.main.scrollY);
    if (this.zoneFeedback) syncPlaySceneZoneFeedback(this, this.zoneFeedback, deltaMs);
    this.syncHandSlotChip();
    if (this.minimap) {
      syncMinimapPosition(this.minimap, this.tileX, this.tileY, this.map);
      const host = this.game.registry.get("dialogueHost") as HTMLElement | undefined;
      syncMinimapVisibility(this.minimap, host ?? null, this.minimapUserHidden);
    }
  }

  private syncHandSlotChip(): void {
    const host = dialogueHost(this) ?? null;
    if (host !== this.handSlotHost) {
      this.handSlotChip?.destroy();
      this.handSlotHost = host;
      this.handSlotChip = mountHandSlotChip(host);
    }
    this.handSlotChip?.update(store.getCurrent(), this.session);
  }

  getMapId(): MapId {
    return this.session.currentMapId;
  }

  loadMap(mapId: MapId, options?: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean; readonly applyMapBgm?: boolean }): void {
    loadSceneMap(this, mapId, options);
    initializeActionCombatForScene(this);
    resetEncounterCounter();
    void this.syncMinimap();
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

  refreshRuntimeEntities(): void {
    refreshSceneRuntimeEntities(this);
    syncFollowerSprites(this);
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

  async sleepUntilMorning(): Promise<boolean> {
    return sleepUntilMorningScene(this, async (commands) => {
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

  updateActionCombat(deltaMs: number): void {
    updateActionCombatForScene(this, deltaMs);
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
    this.loadMap(this.session.currentMapId, { preserveErasedEvents: true, applyDefaultLighting: false, applyMapBgm: false });
    void this.syncMinimap();
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    this.player.setTexture(this.playerSprite.texture);
    this.player.setFrame(this.playerSprite.idleFrameFor(this.facing));
    this.player.setPosition(
      footprintSpriteX(this.tileX, resolvePlayerBody(project, this.session).footprint),
      characterSpriteY(this.tileY)
    );
    placeCharacterSprite(this.player, "same");
    for (const animation of this.activeMapAnimations) animation.destroy(true);
    this.activeMapAnimations.clear();
    this.runtimeTimers.clear();
    this.moving = false;
    this.centerCamera();
    // 인게임 로드: 이전 오디오 정지 후 저장된 BGM/BGS 재개.
    stopAllAudio();
    resumeAudioState(this.session.audio, project);
    if (!this.session.audio.bgm) startMapBgm(project, this.session, this.session.currentMapId);
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

  private async syncMinimap(): Promise<void> {
    const host = this.game.registry.get("dialogueHost") as HTMLElement | undefined;
    if (!host) {
      // dialogueHost may not exist yet at create() — retry on next frame once.
      setTimeout(() => void this.syncMinimap(), 300);
      return;
    }
    if (this.minimap) {
      destroyMinimap(this.minimap);
      this.minimap = null;
    }
    const map = this.map;
    if (!map?.minimap?.enabled) return;
    try {
      this.minimap = await createMinimap(host, map, this.session);
      if (this.minimap) syncMinimapVisibility(this.minimap, host, this.minimapUserHidden);
    } catch {
      // minimap is best-effort — never break play scene
    }
  }

  private async runInitialEventTestWhenReady(eventId: string): Promise<void> {
    if (this.game.registry.get("dialogue")) {
      await this.runEvent(eventId);
      return;
    }
    this.game.registry.events.once("changedata", (_parent: unknown, key: string) => {
      if (key === "dialogue") void this.runEvent(eventId);
    });
  }

  private initialSession(project: ReturnType<typeof store.getCurrent>): PlaySession {
    const value: unknown = this.game.registry.get("initialSession");
    return isPlaySession(value) ? structuredClone(value) : startSession(project);
  }

  private initialEventTestId(): string {
    const value: unknown = this.game.registry.get("initialEventTestId");
    return typeof value === "string" ? value : "";
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
