import { createDefeatRecovery } from "@/player/defeatRecovery";
import { mapTileSize } from "@/project/tileGeometry";
import { syncPlayerCharacterScale } from "@/player/playerCharacterScale";
import { ACTION_STAMINA_MAX } from "@/player/actionCombatTypes";
import type Phaser from "phaser";
import { clearAllSceneEmotes, syncSceneEmotes } from "@/player/playSceneEmotes";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import {
  loadBundledAssets,
  registerBundledFrames,
} from "@/assets/bundled";
import type { BattleResult } from "@/battle/runtime";
import { store } from "@/project/store";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { readLifePlacementLiveContext } from "@/player/lifePlacementScene";
import { resolvePlayResolution } from "@/project/playResolution";
import { startSession, type PlaySession } from "@/project/session";
import { Input } from "@/player/input";
import type { StepResult } from "@/player/interpreter";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { AUDIO_HANDOFF_REGISTRY_KEY, resumeAudioState, stopAllAudio } from "@/player/audio";
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
import { runtimeMapViewZoom, runtimePixelDensity } from "@/player/runtimeViewScale";
import { hasSessionCheckpoint, restoreSessionCheckpoint, setSessionCheckpoint, getSessionCheckpoint } from "@/player/checkpoints";
import { syncFollowerSprites } from "@/player/playSceneFollowers";
import { seedLocationOccupancyForScene } from "@/player/playSceneLocationTransitions";
import { installLightingLayer, syncLightingLayer, updateLighting } from "@/player/playSceneLighting";
import type { LightingAmbientTransition } from "@/project/lightingRules";
import { syncMapBackgroundLayers, updateMapBackground } from "@/player/playSceneMapBackground";
import { installWeatherLayer, syncWeatherLayer, updateWeather } from "@/player/playSceneWeather";
import { installCloudShadowLayer, syncCloudShadowLayer, updateCloudShadows } from "@/player/playSceneCloudShadows";
import type { WeatherParams, WeatherTransition } from "@/player/weather/weatherModel";
import type { FieldSpawnRuntimeState } from "@/player/fieldSpawns";
import { updateFieldSpawnsForScene } from "@/player/playSceneFieldSpawns";
import { initializeActionCombatForScene, updateActionCombatForScene } from "@/player/playSceneActionCombat";
import { applyAdvanceTimeStep, applySetTimeStep, installTimeTintLayer, isGameTimePausedForRuntime, sleepUntilMorningScene, updateGameTime, updateTimeTint } from "@/player/playSceneTime";
import { tickNpcSchedules, updateNpcSchedules } from "@/player/npcSchedules";
import { resetCullableTiles, syncTileCulling } from "@/player/playSceneTileCulling";
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
import { recordPlayBootDiagnostic } from "@/player/playBootDiagnostics";
import { diagnosticToken } from "@/util/diagnosticObserver";
import { createRuntimePerfCounters, type RuntimePerfCounters } from "@/player/runtimePerfCounters";
import { onRegistryValue } from "@/player/registryReady";

const PhaserRuntime = getLoadedPhaser();
const MAX_FAILED_ASSETS = 20;

export type FailedPlayAsset = {
  readonly key: string;
  readonly url: string;
};

export class PlayScene extends PhaserRuntime.Scene implements PlaySceneContext {
  declare tileLayer: Phaser.GameObjects.Container;
  declare upperTileLayer: Phaser.GameObjects.Container;
  declare player: Phaser.GameObjects.Sprite;
  declare playerSprite: PlayerSpriteResource;
  declare input_: Input;
  declare session: PlaySession;
  battleAbortController?: AbortController;
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
  moveElapsedFrames = 0;
  moveDurationMs = 160;
  logicTickAccumulatorMs = 0;
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
  cloudShadowSprites?: Phaser.GameObjects.TileSprite[];
  cloudShadowClockMs = 0;
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
  perfCounters: RuntimePerfCounters = createRuntimePerfCounters();
  private readonly failedAssetLoads: FailedPlayAsset[] = [];

  get failedAssets(): readonly FailedPlayAsset[] {
    return this.failedAssetLoads;
  }

  constructor() {
    super({ key: "PlayScene" });
  }

  preload(): void {
    const diagnosticOwner = diagnosticToken();
    const reportProgress = (ratio: number): void => {
      const handler: unknown = this.game.registry.get("onPlayLoadProgress");
      if (typeof handler === "function") {
        (handler as (ratio: number) => void)(ratio);
      }
    };
    this.load.on("progress", reportProgress);
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      const failure = { key: file.key, url: typeof file.url === "string" ? file.url : file.src };
      if (this.failedAssetLoads.length >= MAX_FAILED_ASSETS) this.failedAssetLoads.shift();
      this.failedAssetLoads.push(failure);
      this.installFailedAssetPlaceholder(failure.key);
      recordPlayBootDiagnostic({
        stage: "assets",
        ok: false,
        detail: `에셋 로드 실패: ${failure.key} (${failure.url})`,
      }, undefined, diagnosticOwner);
    });
    reportProgress(0);
    loadBundledAssets(this, store.getCurrent());
  }

  private installFailedAssetPlaceholder(key: string): void {
    if (this.textures.exists(key)) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ff00ff";
    context.fillRect(0, 0, 16, 16);
    context.fillStyle = "#111111";
    context.fillRect(0, 0, 8, 8);
    context.fillRect(8, 8, 8, 8);
    this.textures.addCanvas(key, canvas);
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
    for (const failure of this.failedAssetLoads) this.installFailedAssetPlaceholder(failure.key);
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
    // 구역 드나듦의 기준선을 심는다. 시작 지점이 어떤 구역 안이라도 «새 게입에 들어왔다»
    // 로 치지 않는다 — 부톨 직후에 트리거가 튰지면 그것은 auto 트리거의 일이지 드나듦이 아니다.
    // 세이브가 이미 기록을 갖고 있으면 같은 값을 다시 쓰는 생개 동작이다.
    seedLocationOccupancyForScene(this);
    this.player = this.add.sprite(
      // 주인공도 **몸 중앙**에 놓는다 — 1x1 이면 타일 중앙과 같은 값이다(항등).
      footprintSpriteX(this.tileX, resolvePlayerBody(project, this.session).footprint, mapTileSize(this.map)),
      characterSpriteY(this.tileY, mapTileSize(this.map)),
      this.playerSprite.texture,
      this.playerSprite.idleFrameFor("down")
    );
    placeCharacterSprite(this.player, "same");
    syncPlayerCharacterScale(this);
    installWeatherLayer(this);
    installCloudShadowLayer(this);
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
    this.events.once("shutdown", () => clearAllSceneEmotes(this));
    this.events.once("destroy", () => clearAllSceneEmotes(this));
    // 모드 전환이 이미 소유권을 가져갔으면(타이틀 복귀가 새 BGM 을 켠 뒤 이 씬의 실제
    // 파괴가 도착한 경우) 멈추지 않는다 — 공유 엔진이라 새 트랙까지 지운다.
    const stopAllAudioOnTeardown = (): void => {
      if (this.registry?.get(AUDIO_HANDOFF_REGISTRY_KEY) === true) return;
      stopAllAudio();
    };
    this.events.once("shutdown", stopAllAudioOnTeardown);
    this.events.once("destroy", stopAllAudioOnTeardown);
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
    // 컬링의 직전 짝 기억은 모듈 스코프의 **강한** 참조다(WeakMap 인 본체와 다르다).
    // 풀지 않으면 내려간 씬과 타일 GameObject 1만~2.1만개가 그대로 남는다.
    const releaseCulling = (): void => resetCullableTiles(this);
    this.events.once("shutdown", releaseCulling);
    this.events.once("destroy", releaseCulling);
    // player.ts 로딩 오버레이가 create 완료를 기다릴 수 있게 신호.
    reportStage("ready");
    const onReady: unknown = this.game.registry.get("onPlaySceneReady");
    if (typeof onReady === "function") {
      (onReady as () => void)();
    }
    this.game.events.emit("playscene-ready");
  }

  update(_time: number, deltaMs: number): void {
    this.perfCounters.frames += 1;
    updatePlayScene(this, deltaMs);
    updateGameTime(this, deltaMs);
    tickNpcSchedules(this, isGameTimePausedForRuntime(this), deltaMs);
    updateWeather(this, deltaMs);
    updateCloudShadows(this, deltaMs);
    updateTimeTint(this, deltaMs);
    updateLighting(this, deltaMs);
    updateMapBackground(this, deltaMs);
    syncTileCulling(this, this.cameras.main.worldView, mapTileSize(this.map));
    // 이벤트 마커는 화면 좌표로 놓여야 한다 — 카메라를 반영하지 않으면 무대의 스크롤 영역이
    // 맵 크기만큼 부풀고, 마커 클릭이 무대를 스크롤시켜 재생 화면이 검게 된다(runtimeDom 주석).
    this.runtimeDom.syncCameraOffset(this.cameras.main.scrollX, this.cameras.main.scrollY);
    syncSceneEmotes(this);
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
    this.handSlotChip?.update(store.getCurrent(), this.session, {
      stamina: this.actionCombatState?.config.staminaEnabled ? this.actionCombatState.stamina : undefined,
      staminaMax: ACTION_STAMINA_MAX,
      // 칩은 DOM(논리 px)에 놓인다. Phaser 는 화면 중심 기준으로 확대하므로 scroll 이 아니라
      // worldView 원점에서 재고, 캔버스 px 를 픽셀 밀도로 나눠 논리 px 로 되돌린다.
      playerX: this.player ? (this.player.x - this.cameras.main.worldView.x) * this.cameras.main.zoom / runtimePixelDensity(this) : undefined,
      playerY: this.player ? (this.player.y - this.cameras.main.worldView.y) * this.cameras.main.zoom / runtimePixelDensity(this) : undefined,
    });
  }

  getMapId(): MapId {
    return this.session.currentMapId;
  }

  loadMap(mapId: MapId, options?: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean; readonly applyMapBgm?: boolean }): void {
    clearAllSceneEmotes(this);
    loadSceneMap(this, mapId, options);
    syncMapBackgroundLayers(this);
    initializeActionCombatForScene(this);
    resetEncounterCounter();
    // 맵마다 설정이 다르다 — 새 맵의 구름을 즉시 다시 계산하지 않으면 이전 맵의 그림자가 남는다.
    syncCloudShadowLayer(this);
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
    syncPlayerCharacterScale(this);
    syncFollowerSprites(this);
    applyStoredCameraState(this);
    syncWeatherLayer(this);
    installTimeTintLayer(this);
    syncLightingLayer(this);
  }

  refreshRuntimeEntities(): void {
    // 이벤트 스프라이트를 다시 만드는 쪽(refreshSceneRuntimeEntities)이 카메라 재바인딩까지
    // 책임진다 — playSceneMapRuntime §rebindEventFollowCamera.
    refreshSceneRuntimeEntities(this);
    syncFollowerSprites(this);
  }

  centerCamera(): void {
    centerRuntimeCamera(this.cameras.main, this.map, this.player, runtimeMapViewZoom(this));
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

  playBattle(step: Extract<StepResult, { kind: "battleProcessing" }>, isCurrent?: () => boolean): Promise<BattleResult | null> {
    this.battleAbortController?.abort();
    const controller = new AbortController();
    this.battleAbortController = controller;
    const abort = (): void => controller.abort();
    this.events.once("shutdown", abort);
    this.events.once("destroy", abort);
    const session = this.session;
    const startedAt = performance.now();
    return import("@/player/playSceneBattle").then(({ playBattle }) => {
      if (controller.signal.aborted || this.session !== session || isCurrent?.() === false) return null;
      return playBattle(this, step, startedAt, isCurrent);
    }).finally(() => {
      this.events.off("shutdown", abort);
      this.events.off("destroy", abort);
      if (this.battleAbortController === controller) this.battleAbortController = undefined;
    });
  }

  async sleepUntilMorning(onFailurePresented?: () => void): Promise<boolean> {
    return sleepUntilMorningScene(this, async (commands) => {
      const { runCommands } = await import("@/player/playSceneInterpreter");
      await runCommands(this, commands, undefined, { allowNested: true });
    }, onFailurePresented);
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

  readLivePlacementContext() {
    return readLifePlacementLiveContext(store.getCurrent(), this);
  }

  applySession(session: PlaySession): void {
    this.battleAbortController?.abort();
    this.session = structuredClone(session);
    // Loading replaces the old event run; its pending menu must not own the new session.
    this.running = false;
    this.setInputEnabled(true);
    const project = store.getCurrent();
    this.playerSprite = resolvePlayerSpriteResource(project, this.session);
    this.loadMap(this.session.currentMapId, { preserveErasedEvents: true, applyDefaultLighting: false, applyMapBgm: false });
    void this.syncMinimap();
    this.tileX = this.session.x;
    this.tileY = this.session.y;
    // 불러오기는 «그 자리에 서 있는 상태» 를 부활하는 것이다 — 안에서 잡았으면
    // 새로 들어온 것이 아니므로 기준선만 심고 트리거를 돌리지 않는다.
    seedLocationOccupancyForScene(this);
    this.player.setTexture(this.playerSprite.texture);
    this.player.setFrame(this.playerSprite.idleFrameFor(this.facing));
    this.player.setPosition(
      footprintSpriteX(this.tileX, resolvePlayerBody(project, this.session).footprint, mapTileSize(this.map)),
      characterSpriteY(this.tileY, mapTileSize(this.map))
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

  recoverFromDefeat(settings?: import("@/project/cinematicSettings").GameOverSettings): boolean {
    const recovered = createDefeatRecovery(store.getCurrent(), this.session, settings);
    if (!recovered) return false;
    const checkpoint = getSessionCheckpoint(this.session);
    this.applySession(recovered);
    if (checkpoint) setSessionCheckpoint(this.session, checkpoint);
    return true;
  }

  showGameOverScreen(message?: string, gameOverId?: string): void {
    showSceneGameOverScreen(this, message, gameOverId);
  }

  showEndingScreen(title: string, message: string, presentation?: import("@/project/cinematicSettings").EndingPresentation): void {
    showSceneEndingScreen(this, title, message, presentation);
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
    this.whenDialogueReady(() => {
      const fire = (): void => { void this.fireAutoTriggers(); };
      // During create(), sys.isActive() is still false. A synchronous battle
      // rejection would otherwise be mistaken for a cancelled scene.
      if (this.sys.isActive()) fire();
      else this.events.once("create", fire);
    });
  }

  /**
   * dialogue 는 게임 생성 뒤 처음 넣는 registry 키다 — DataManager 는 그때 `changedata` 가 아니라
   * `setdata` 를 낸다. changedata 하나만 기다리던 옛 코드는 create() 가 registry 쓰기보다 앞서면
   * 자동 실행 이벤트가 영원히 발화하지 않았다. 씬이 내려가면 대기도 푼다.
   */
  private whenDialogueReady(callback: () => void): void {
    const detach = onRegistryValue(this.game.registry, "dialogue", () => callback());
    this.events.once("shutdown", detach);
    this.events.once("destroy", detach);
  }

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
    this.whenDialogueReady(() => void this.runEvent(eventId));
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
