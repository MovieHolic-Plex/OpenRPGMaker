import { phaserBlendMode } from "@/project/blendMode";
import { invalidateSunlight } from "./sunlightLayer";
import { mapTileSize } from "@/project/tileGeometry";
import { mapCharacterSizeFactor } from "@/project/characterScale";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { syncPlayerCharacterScale } from "@/player/playerCharacterScale";
import { resetDetectionForMap } from "./npcDetectionEncounter";
import { dialogueUi } from "./playSceneDom";
import { evalCondition } from "@/project/session";
import { clearFurniturePush, furniturePushPosition } from './furniturePushAnimation';
import { chipsetAnimationKey } from "@/assets/bundled";
import {
  supportsChipsetQuarterComposition,
  tilesetAnimationKeyForTile,
  tilesetTextureKey,
} from "@/editor/tilesetImage";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import { passageMarkForTile } from "@/project/tilesetPassage";
import {
  MAP_BACKGROUND_LAYER_DEPTH,
  OVERLAY_LAYER_DEPTH_OFFSET,
  SHADOW_LAYER_DEPTH_OFFSET,
} from "@/player/characterDepth";
import { isPanoramaWindowTile } from "@/project/defaults/chipsetMapping";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import {
  isLakeAutotileTile,
  lakeAutotileQuarterSources,
  type LakeAutotileQuarter,
} from "@/project/defaults/lakeAutotile";
import {
  chipsetQuarterComposition,
  type ChipsetQuarterComposition,
} from "@/project/defaults/terrainQuarterAutotile";
import { withWorldCoastRenderPass } from "@/project/defaults/worldCoastMapping";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { applyRuntimeMapOverrides } from "@/project/runtimeMap";
import { tileStackAt, topTileInStack } from "@/project/mapOverlayTiles";
import { layerTileAt, shadowAt } from "@/project/mapLayers";
import { invalidateTilePassabilityComponents } from "@/project/tilePassabilityComponents";
import { store } from "@/project/store";
import type { Command, MapId, TilesetDef, Trigger } from "@/project/types";
import { drainPendingLocationTransitions } from "@/player/playSceneLocationTransitions";
import { applyStoredCameraState } from "@/player/playSceneCamera";
import {
  CUTSCENE_HUD_HIDDEN_CLASS,
  isCutsceneHudHidden,
} from "@/player/cutsceneControl";
import { runCommands } from "@/player/playSceneInterpreter";
import { abortHop, clearAllHopScales, PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { destroyCharacterShadow, destroyAllCharacterShadows } from "@/player/characterShadow";
import { startMapBgm } from "@/player/mapBgm";
import { eventSpriteFrameForDirection, eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import {
  characterSpriteY,
  footprintSpriteX,
  isAlwaysAboveCharacterUpperTile,
  mapUpperTileDepth,
  placeCharacterSprite,
} from "@/player/characterDepth";
// ★ 수관은 upperTileLayer(고정 250k). 솔리드 가구(×)는 root display list + y-sort.
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import { runtimeMoverSnapshots } from "@/player/runtimeMoverSnapshots";
import { lifeCalendarHudLines } from "@/player/lifeCalendarHud";
import { resolveTimeSystem, timePhaseFor } from "@/project/gameTime";
import { runtimeTimerActivity } from "@/player/playSceneTimers";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { applyMapDefaultLighting } from "@/project/lightingRules";
import { initializeFieldSpawnsForScene } from "@/player/playSceneFieldSpawns";
import { renderFarmOverlays } from "@/player/playSceneFarming";
import { renderPlaceableOverlays, syncForageWarnings } from "@/player/playScenePlaceables";
import { initialRuntimeEventPositions,
runtimeEventViewsForMap,
type RuntimeEventView, } from "@/project/runtimeEventState"
import { buildLifeRuntimeSnapshot, type RuntimeEventSnapshot, type RuntimeStateSnapshot } from "@/player/runtimeDom";
import { resetCullableTiles, trackCullableTile } from "@/player/playSceneTileCulling";
import { bumpPerfCounter, type RuntimePerfCounters } from "@/player/runtimePerfCounters";
import { RuntimeTileWindow, runtimeCameraTileView } from './runtimeTileWindow';
import type { CullViewport } from './playSceneTileCulling';
import {
  RELIEF_LIFTED_LOWER_DEPTH,
  RELIEF_LIFTED_SHADOW_DEPTH,
  RELIEF_LIFTED_UPPER_DEPTH,
  reliefLiftPx,
  reliefRowDepth,
  renderReliefLayer,
} from "@/player/playSceneRelief";
import { reliefFieldOf, type ReliefTextureManager } from "@/player/reliefStrips";
import { reliefPaintsCell, reliefSignature } from "@/project/relief/screen";
import { reliefGroundFromImage, reliefTilesetImage } from "@/editor/reliefGroundSurface";

interface RenderedTileImage {
  /** 높이 지형 들림을 얹을 때 쓴다. 테스트 스텁은 생략한다. */
  y?: number;
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
  destroy?(removeFromDisplayList?: boolean): void;
  addToDisplayList?(): unknown;
  /** 화면 밖 컬링용. Phaser GameObject 는 모두 갖지만 테스트 스텁은 생략한다. */
  visible?: boolean;
  setVisible?(value: boolean): unknown;
}

/** root display list 에 올린 솔리드 upper 가구 — container removeAll 대상이 아니라 직접 destroy. */
const rootYSortTiles = new WeakMap<object, Set<RenderedTileImage>>();
const tileWindows = new WeakMap<object, { sync(view: CullViewport): void }>();
const tileCaptures = new WeakMap<object, RenderedTileImage[]>();
interface TileAnimationState {
  readonly currentAnim?: { readonly key: string };
  getProgress?(): number;
  setProgress?(value: number): unknown;
  accumulator?: number;
  nextTick?: number;
  forward?: boolean;
}
const tileAnimationLeaders = new WeakMap<object, Map<string, TileAnimationState>>();

/**
 * 마지막으로 타일 계층을 그린 입력의 서명. 같으면 renderTiles 는 타일을 다시 만들지 않고
 * 이벤트 계층만 다시 그린다.
 *
 * 왜: refreshRuntimeSurfaces 가 인터프리터 스텝마다 renderTiles 를 부른다. 30×30 맵도 한 번에
 * 타일 GameObject 1,824 개, 100×100 이면 1~2만 개를 파괴·재생성했다(실측 15.9~26ms/호출).
 * 대화 한 번에 6번, 100ms 병렬 이벤트가 있으면 초당 8번이었다 — 프레임이 통째로 빠지고
 * 화면이 멈칫한다. 타일이 실제로 바뀐 스텝(changeTile·맵 이동·밭 갈이)만 다시 그리면 된다.
 *
 * 서명은 renderTiles 가 읽는 **모든** 입력을 담는다: 맵 객체·타일셋·텍스처 키(정체성),
 * 하/상층 타일 배열(내용 해시 — applyMapOverrides 가 제자리에서 바꾼다), 밭·설치물·공간
 * 배치(JSON), 작물 자료(정체성). tileStackAt 은 현재 빈 스택만 돌려주므로 입력이 아니다.
 */
interface TileLayerSignature {
  readonly map: object;
  readonly tileset: object | undefined;
  readonly textureKey: string;
  readonly tilesHash: number;
  readonly relief: number;
  readonly overlays: string;
  readonly crops: unknown;
}

const tileLayerSignatures = new WeakMap<object, TileLayerSignature>();

interface RenderedEventSprite extends RenderedTileImage {
  readonly y: number;
  readonly active?: boolean;
  readonly alpha?: number;
  readonly blendMode?: number | string;
  readonly isTinted?: boolean;
  readonly flipX?: boolean;
  readonly flipY?: boolean;
  readonly rotation?: number;
  readonly texture?: { readonly key: string };
  readonly anims?: { readonly isPlaying: boolean };
  readonly width?: number;
  readonly height?: number;
  play(key: string): this;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
  /** 저작 섞기 방식. 테스트 스텁에는 없을 수 있다. */
  setBlendMode?(value: number): unknown;
  destroy(): void;
}

interface RenderTilesSceneContext<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
> {
  readonly map: PlaySceneContext["map"];
  readonly session: PlaySceneContext["session"];
  readonly eventPositions: PlaySceneContext["eventPositions"];
  readonly tileLayer: {
    readonly list?: unknown[];
    removeAll(removeChildren?: boolean): void;
    add(image: TImage | TSprite | unknown): unknown;
  };
  /**
   * ★ 수관 등 always-above upper 전용. 솔리드 가구(×)는 root에 y-sort 로 올린다.
   * 없으면 tileLayer 로 폴백(레거시 테스트).
   */
  readonly upperTileLayer?: {
    readonly list?: unknown[];
    removeAll(removeChildren?: boolean): void;
    add(image: TImage | TSprite | unknown): unknown;
  };
  /** optional host identity for WeakMap tracking of root y-sort tiles */
  readonly sceneHost?: object;
  readonly cameras?: { readonly main: { readonly worldView: CullViewport } };
  readonly make?: {
    image(config: { x: number; y: number; key: string; frame?: string | number; add: boolean }): TImage;
    sprite(config: { x: number; y: number; key: string; frame?: string | number; add: boolean }): TSprite;
  };
  /** 재생성 계수기(선택). 최소 컨텍스트 테스트 스텁은 생략한다. */
  readonly perfCounters?: RuntimePerfCounters;
  /** 체공 그림자 풀. 이벤트 스프라이트를 파괴할 때 같이 비워야 고아 그림자가 남지 않는다. */
  characterShadows?: Map<string, import("@/player/characterShadow").ShadowImage>;
  readonly eventSprites: {
    values(): IterableIterator<TSprite>;
    entries(): IterableIterator<[string, TSprite]>;
    get(eventId: string): TSprite | undefined;
    delete(eventId: string): boolean;
    clear(): void;
    set(eventId: string, marker: TSprite): unknown;
  };
  /**
   * 텍스처 관리자(선택). `get` 은 이벤트 스프라이트 서명이 읽고, 나머지(`exists`·`remove`·`addCanvas`)는 높이 지형
   * 절벽 띠가 쓴다 — 다 갖춘 관리자가 아니면 절벽 그림 없이 타일만 들린다.
   */
  readonly textures?: Partial<ReliefTextureManager>;
  readonly children?: { list: unknown[]; queueDepthSort(): void };
  readonly tweens?: { getTweens?(): readonly TweenTargetSource[] };
  readonly eventGraphicPatternOverrides?: Map<string, number>;
  /** 걷는 중인 NPC 의 보간 위치를 알기 위한 무버 풀(선택). */
  readonly autonomousNPCs?: { get(eventId: string): AutonomousMover | undefined };
  readonly runtimeDom: Pick<
    PlaySceneContext["runtimeDom"],
    "clearEventMarkers" | "upsertEventMarker" | "syncMissingResourceError"
  >;
  readonly missingResources: Set<string>;
  readonly add: {
    image(x: number, y: number, texture: string, frame?: string | number): TImage;
    sprite(x: number, y: number, texture: string, frame?: string | number): TSprite;
    rectangle?(x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number): RenderedTileImage;
    text?(x: number, y: number, text: string, style?: Record<string, string>): RenderedTileImage;
  };
  readonly resolveTilesetTexture?: (tileset: TilesetDef) => string;
  runEvent(eventId: string): Promise<void>;
  syncRuntimeState(): void;
}

export function loadMap(scene: PlaySceneContext, mapId: MapId, options: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean; readonly applyMapBgm?: boolean } = {}): void {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) {
    console.warn(`[player] map not found: ${mapId}`);
    return;
  }
  scene.map = mapWithCommittedEvents(map);
  scene.session.currentMapId = mapId;
  if (options.applyDefaultLighting !== false) applyMapDefaultLighting(scene.session, scene.map);
  // 세이브 복원 경로는 저장된 BGM 을 resumeAudioState 가 되살리므로 맵 기본값으로 덮지 않는다.
  if (options.applyMapBgm !== false) startMapBgm(project, scene.session, mapId);
  if (!options.preserveErasedEvents) scene.session.erasedEventIds = [];
  resetMapRuntime(scene);
  syncPlayerCharacterScale(scene);
  applyMapOverrides(scene);
  initializeFieldSpawnsForScene(scene);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  scene.syncRuntimeState();
}

/** Owned by one synchronous render only: authored metadata may mutate between passes. */
interface TileRenderPass {
  readonly textureKey: string;
  readonly size: number;
  readonly quarters: boolean;
  readonly backing: Map<number, number | null>;
  readonly animations: Map<number, string | null>;
  readonly lakes: Map<number, boolean>;
  readonly above: Map<number, boolean>;
}

function cachedTileValue<T>(cache: Map<number, T>, tile: number, resolve: () => T): T {
  const found = cache.get(tile);
  if (found !== undefined) return found;
  const value = resolve();
  cache.set(tile, value);
  return value;
}

export function renderTiles<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
>(scene: RenderTilesSceneContext<TImage, TSprite>): void {
  const host = rootYSortHost(scene);
  const signature = tileLayerSignature(scene);
  const previous = tileLayerSignatures.get(host);
  if (previous && sameTileLayerSignature(previous, signature)) {
    // 타일 입력이 그대로다 — 이벤트 계층만 다시 그린다(페이지 조건·위치·그래픽 변화는 여기 있다).
    bumpPerfCounter(scene, "tileRebuildsSkipped");
    renderEventLayer(scene);
    return;
  }
  tileLayerSignatures.set(host, signature);
  invalidateSunlight(scene);
  bumpPerfCounter(scene, "tileRebuilds");
  scene.tileLayer.removeAll(true);
  scene.upperTileLayer?.removeAll(true);
  clearRootYSortTiles(scene);
  tileWindows.delete(host);
  resetCullableTiles(host);
  const map = scene.map;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) {
    clearEventSprites(scene);
    return;
  }
  const pass: TileRenderPass = {
    textureKey: signature.textureKey,
    size: mapTileSize(map),
    quarters: supportsChipsetQuarterComposition(tileset),
    backing: new Map(), animations: new Map(), lakes: new Map(), above: new Map(),
  };
  // 높이 지형: 절벽 띠와 벽면 장식을 먼저 올린다(만든 GameObject 는 타일과 같이 파괴된다).
  const ground = reliefGroundFromImage(map, tileset, reliefTilesetImage(scene.textures, pass.textureKey));
  renderReliefLayer(scene, host, { tileSize: pass.size, ground, wallDecor: { textureKey: pass.textureKey, frame: (tile) => `tile_${tile}` } }, (image) => {
    bumpPerfCounter(scene, "tileObjectsCreated");
    trackRootYSortTile(scene, image);
  });
  const drawCell = (drawingScene: RenderTilesSceneContext<TImage, TSprite>, x: number, y: number): void => {
    const index = y * map.width + x;
    renderEmptyCellCover(drawingScene, x, y, index);
    // 경사로 도트가 있는 바이옴의 경사로 칸은 relief 경사로 도트가 바닥을 칠한다 — 타일은 그리지 않는다.
    if (!ground) {
      if (!reliefPaintsCell(map.relief, x, y)) renderTile(drawingScene, tileset, x, y, map.lowerTiles[index], "lower", pass);
      for (const tile of tileStackAt(map, "lower", index)) renderTile(drawingScene, tileset, x, y, tile, "lower", pass);
      renderRawTile(drawingScene, tileset, x, y, layerTileAt(map, 2, index), "lower", OVERLAY_LAYER_DEPTH_OFFSET, pass);
      renderShadow(drawingScene, x, y, shadowAt(map, index));
    }
    renderTile(drawingScene, tileset, x, y, map.upperTiles[index], "upper", pass);
    for (const tile of tileStackAt(map, "upper", index)) renderTile(drawingScene, tileset, x, y, tile, "upper", pass);
    renderRawTile(drawingScene, tileset, x, y, layerTileAt(map, 4, index), "upper", OVERLAY_LAYER_DEPTH_OFFSET, pass);
  };
  // The real runtime has a camera and flat Phaser lists. Minimal render oracles
  // without a camera keep the complete-map path.
  // 높이 지형 맵도 전체 경로를 쓴다: 들린 칸은 화면에서 칸 위치보다 위에 그려지므로 창(보이는 칸만 그림)이
  // 칸 좌표 기준이면 화면 아래쪽 들린 칸이 빠지거나 잘못 숨겨진다.
  if (scene.cameras && scene.tileLayer.list && !reliefFieldOf(map.relief)) {
    const resident = new RuntimeTileWindow<RenderedTileImage>(map.width, map.height, pass.size);
    const beforeRootTiles = new WeakSet(scene.children?.list as object[] | undefined);
    const lowerBatch: RenderedTileImage[] = [], upperBatch: RenderedTileImage[] = [];
    const drawingScene: RenderTilesSceneContext<TImage, TSprite> = Object.create(scene);
    Object.defineProperties(drawingScene, {
      sceneHost: { value: host },
      tileLayer: { value: { add: (image: RenderedTileImage) => lowerBatch.push(image) } },
      upperTileLayer: { value: scene.upperTileLayer ? { add: (image: RenderedTileImage) => upperBatch.push(image) } : undefined },
      add: { value: {
        image: (x: number, y: number, key: string, frame?: string | number) => scene.make
          ? scene.make.image({ x, y, key, frame, add: false }) : scene.add.image(x, y, key, frame),
        sprite: (x: number, y: number, key: string, frame?: string | number) => scene.make
          ? scene.make.sprite({ x, y, key, frame, add: false }) : scene.add.sprite(x, y, key, frame),
        rectangle: scene.add.rectangle?.bind(scene.add),
      } },
    });
    const sync = (view: CullViewport): void => {
      let leaders: Map<string, TileAnimationState> | undefined;
      const changed = withWorldCoastRenderPass(() => resident.sync(view, (x, y) => {
        if (!leaders) {
          leaders = new Map();
          for (const images of resident.cells.values()) for (const image of images) {
            const animation = (image as RenderedEventSprite).anims as TileAnimationState | undefined;
            if (image.visible !== false && animation?.currentAnim) leaders.set(animation.currentAnim.key, animation);
          }
          tileAnimationLeaders.set(host, leaders);
        }
        const images: RenderedTileImage[] = [];
        tileCaptures.set(host, images);
        try { drawCell(drawingScene, x, y); } finally { tileCaptures.delete(host); }
        return images;
      }, image => {
        rootYSortTiles.get(host)?.delete(image);
        image.destroy?.(true);
      }));
      tileAnimationLeaders.delete(host);
      if (!changed) return;
      // Official batch add preserves parent links, destroy listeners and sprite
      // UpdateList hooks without an indexOf for every growing-list insertion.
      if (lowerBatch.length) scene.tileLayer.add(lowerBatch);
      if (upperBatch.length) scene.upperTileLayer?.add(upperBatch);
      lowerBatch.length = 0; upperBatch.length = 0;
      resident.sort(scene.tileLayer.list!);
      if (scene.upperTileLayer?.list) resident.sort(scene.upperTileLayer.list);
      if (scene.children) {
        resident.sortRoots(scene.children.list, beforeRootTiles);
        scene.children.queueDepthSort();
      }
      resetCullableTiles(host);
      for (const [index, images] of resident.cells) {
        for (const image of images) trackCullableTile(host, image, index % map.width, Math.floor(index / map.width));
      }
    };
    tileWindows.set(host, { sync });
    sync(runtimeCameraTileView(scene.cameras.main));
  } else {
    withWorldCoastRenderPass(() => {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) drawCell(scene, x, y);
      }
    });
  }
  renderFarmOverlays(scene, store.getCurrent().database.crops ?? []);
  renderPlaceableOverlays(scene);
  renderEvents(scene);
}

/** Called before culling, including after camera jumps, zoom and resize. */
export function syncRuntimeTileWindow(host: object, view: CullViewport): void {
  tileWindows.get(host)?.sync(view);
}

export function releaseRuntimeTileWindow(host: object): void {
  tileWindows.delete(host);
  tileCaptures.delete(host);
  tileAnimationLeaders.delete(host);
  rootYSortTiles.delete(host);
  tileLayerSignatures.delete(host);
  resetCullableTiles(host);
}

function trackMapTile(host: object, image: RenderedTileImage, x: number, y: number): void {
  const capture = tileCaptures.get(host);
  if (capture) capture.push(image);
  else trackCullableTile(host, image, x, y);
}

function playTileAnimation<T extends RenderedEventSprite>(host: object, sprite: T, key: string): T {
  sprite.play(key);
  const leaders = tileAnimationLeaders.get(host);
  const animation = sprite.anims as TileAnimationState | undefined;
  const leader = leaders?.get(key);
  if (animation && leader?.getProgress && animation.setProgress) {
    animation.forward = leader.forward;
    animation.setProgress(leader.getProgress());
    animation.accumulator = leader.accumulator;
    animation.nextTick = leader.nextTick;
  } else if (animation) leaders?.set(key, animation);
  return sprite;
}

function tileLayerSignature<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
): TileLayerSignature {
  const project = store.getCurrent();
  const map = scene.map;
  const tileset = project.tilesets[map.tilesetId];
  const session = scene.session;
  return {
    map,
    tileset,
    textureKey: tileset ? scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset) : "",
    tilesHash: hashTiles(
      map.width,
      map.height,
      map.lowerTiles,
      map.upperTiles,
      map.lowerOverlayTiles ?? [],
      map.upperOverlayTiles ?? [],
      map.shadowBits ?? [],
    ),
    relief: reliefSignature(map.relief),
    overlays: JSON.stringify([
      session.farmPlots?.[map.id] ?? null,
      session.placeables ?? null,
      session.farmBuildingPlacements ?? null,
      session.homeDecorationPlacements ?? null,
    ]),
    crops: project.database.crops,
  };
}

function sameTileLayerSignature(left: TileLayerSignature, right: TileLayerSignature): boolean {
  return (
    left.map === right.map
    && left.tileset === right.tileset
    && left.textureKey === right.textureKey
    && left.tilesHash === right.tilesHash
    && left.relief === right.relief
    && left.overlays === right.overlays
    && left.crops === right.crops
  );
}

/** FNV-1a 32비트. 타일 1~2만 개를 훑는 데 0.1ms 안쪽 — 재생성(15~26ms)의 1% 미만이다. */
function hashTiles(width: number, height: number, ...layers: readonly (readonly number[])[]): number {
  let hash = 0x811c9dc5;
  const mix = (value: number): void => {
    hash ^= value & 0xffff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= value >>> 16;
    hash = Math.imul(hash, 0x01000193);
  };
  mix(width);
  mix(height);
  for (const layer of layers) {
    mix(layer.length);
    for (let index = 0; index < layer.length; index += 1) mix(layer[index] ?? -1);
  }
  return hash >>> 0;
}

/** 테스트·맵 리셋용: 다음 renderTiles 가 반드시 타일을 다시 만들게 한다. */
export function invalidateTileLayer(host: object): void {
  tileLayerSignatures.delete(host);
}

function clearEventSprites<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
>(scene: RenderTilesSceneContext<TImage, TSprite>): void {
  for (const sprite of scene.eventSprites.values()) sprite.destroy();
  scene.eventSprites.clear();
  // 체공 그림자는 이벤트 스프라이트에 딸린다 — 스프라이트를 버리면 같이 버려야 고아가 없다.
  destroyAllCharacterShadows(scene);
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
}

/**
 * 이벤트 스프라이트를 조정하고 마커를 갱신한다 — 타일·농지·설치물은 건드리지 않는다.
 *
 * 왜: NPC 가 움직이거나 시간표가 바뀔 때마다 renderTiles 를 부르면 맵 전체 GameObject
 * (100×100 = 1만~2.1만개) 를 파괴하고 다시 만든다(실측 15.9~26ms/호출). 그 갱신이
 * 필요한 것은 이벤트 계층뿐이다.
 */
export function renderEventLayer<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
>(scene: RenderTilesSceneContext<TImage, TSprite>): void {
  bumpPerfCounter(scene, "eventLayerRebuilds");
  renderEvents(scene);
}

function tileTargetLayer<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  layer: "lower" | "upper",
  alwaysAboveCharacter = false,
): { add(image: TImage | TSprite | unknown): unknown } {
  // ★ 수관만 고정 upper 컨테이너. 솔리드 upper 가구는 root(y-sort) — container 자식 depth 가 무시된다.
  if (layer === "upper" && alwaysAboveCharacter && scene.upperTileLayer) return scene.upperTileLayer;
  return scene.tileLayer;
}

function applyTileDepth(
  tileSize: number,
  image: RenderedTileImage,
  tileset: TilesetDef,
  tile: number,
  y: number,
  layer: "lower" | "upper",
  depthOffset = 0,
): void {
  if (layer !== "upper") {
    // lower 컨테이너 안 정렬: 같은 셀 스택 순서를 안정화.
    image.setDepth(y * 2 + depthOffset);
    return;
  }
  image.setDepth(mapUpperTileDepth(tileset, tile, y, tileSize) + depthOffset);
}

function rootYSortHost<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
): object {
  return scene.sceneHost ?? scene;
}

function clearRootYSortTiles<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
): void {
  const host = rootYSortHost(scene);
  const tiles = rootYSortTiles.get(host);
  if (!tiles) return;
  for (const tile of tiles) tile.destroy?.(true);
  rootYSortTiles.delete(host);
}

function trackRootYSortTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  image: RenderedTileImage,
): void {
  const host = rootYSortHost(scene);
  const tiles = rootYSortTiles.get(host) ?? new Set();
  image.addToDisplayList?.();
  tiles.add(image);
  rootYSortTiles.set(host, tiles);
}

function placeMapTileImage<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  image: TImage,
  tileset: TilesetDef,
  tile: number,
  x: number,
  y: number,
  layer: "lower" | "upper",
  depthOffset: number,
  pass: TileRenderPass,
): void {
  const alwaysAbove = layer === "upper" && cachedTileValue(pass.above, tile, () => isAlwaysAboveCharacterUpperTile(tileset, tile));
  bumpPerfCounter(scene, "tileObjectsCreated");
  image.setOrigin(0, 0);
  applyTileDepth(pass.size, image, tileset, tile, y, layer, depthOffset);
  // 높이 지형: 들린 칸의 타일은 그 칸 윗면으로 올리고, 하층·○ 상층은 줄 depth 로 root 에서 캐릭터와 섞는다
  // (playSceneRelief 머리말의 depth 규칙). ★ 수관은 컨테이너에 그대로, 솔리드 × 는 이미 줄 depth 다.
  const liftPx = reliefLiftPx(scene.map, x, y, pass.size);
  const liftRows = Math.floor(liftPx / pass.size);
  // 화면 밖 타일은 카메라가 타일 경계를 넘을 때 숨긴다(playSceneTileCulling 주석 참고). 들린 타일은 보이는 줄로 추적한다.
  trackMapTile(rootYSortHost(scene), image, x, y - liftRows);
  if (liftPx > 0) {
    if (typeof image.y === "number") image.y -= liftPx;
    const solidUpper = layer === "upper" && !alwaysAbove && passageMarkForTile(tileset, tile) !== "o" && passageMarkForTile(tileset, tile) !== "star";
    if (!alwaysAbove && !solidUpper) {
      image.setDepth(reliefRowDepth(y, pass.size, (layer === "lower" ? RELIEF_LIFTED_LOWER_DEPTH : RELIEF_LIFTED_UPPER_DEPTH) + depthOffset));
      trackRootYSortTile(scene, image);
      return;
    }
  }
  if (layer === "upper" && !alwaysAbove) {
    // root display list — same-priority 캐릭터와 y-sort.
    trackRootYSortTile(scene, image);
    return;
  }
  tileTargetLayer(scene, layer, alwaysAbove).add(image);
}

/**
 * 빈 칸을 가리는 어둘운 판을 깔는다 — RM2K 방식에서 파노라마는
 * **특수 타일(파노라마 창)을 깔 칸에서만** 비친다.
 *
 * 왜 필요한가(2026-09-22): 이전에는 하층 타일이 없는 칸이 그대로 뚜려 진 창이 되어
 * 배경이 다 보였다. RM2K 파노라마는 그렇지 않다 — 배경은 레이어 뒤에 깔리고,
 * 칸을 채우면 가려지며, 투명 칸을 내어둘 그 칸에서만 보인다.
 *
 * 가리는 방법은 **카메라 배경색 사각형**이다. 별도 스프라이트를 만들지 않는 이유:
 * 100x100 맵은 1만 칸이고 그 대부분이 하층 타일로 채워진다. 반대로 하층 타일이 없는 칸은
 * 소수이므로, **빈 칸이 있는 맵에서만** 컨테이너를 만들고 칸 수만큼 사각형을 넣는다.
 */
function renderEmptyCellCover<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  x: number,
  y: number,
  index: number,
): void {
  const map = scene.map;
  // 하층이 비어 있는가? 배열 뚜기(stack)에 타일이 있으면 채워진 것이다.
  const lower = topTileInStack(map, "lower", index) ?? map.lowerTiles[index];
  if (lower >= 0) return;
  // 창 타일이 있으면 가리지 않는다 — 그가 파노라마를 보이는 법이다.
  // 상위 레이어에 놓여도(정책상 홈이 upper), 하층이 비어 있다면 같은 결과가 나야 한다.
  const upper = topTileInStack(map, "upper", index) ?? map.upperTiles[index];
  if (isPanoramaWindowTile(lower) || isPanoramaWindowTile(upper)) return;
  // 저작자가 「빈 칸에도 배경」 을 켰다 — 창 타일이 없는 칩셋(숲마을·기후 시트)은 이 길뿐이다.
  if (map.background?.showInEmptyCells === true && (map.background.imageId || map.background.layers?.length)) return;
  const size = mapTileSize(map);
  if (typeof scene.add.rectangle !== "function") return;
  const cover = scene.add.rectangle(x * size, y * size, size, size, 0x000000);
  cover.setOrigin(0, 0);
  // 배경(-100k) 위, 하층 타일(0) 아래. 이 범위 안에서만 가린다.
  cover.setDepth(MAP_BACKGROUND_LAYER_DEPTH + 1);
  scene.tileLayer.add(cover);
  trackMapTile(rootYSortHost(scene), cover, x, y);
}

function renderTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  layer: "lower" | "upper",
  pass: TileRenderPass,
): void {
  if (tile < 0) return;
  const textureKey = pass.textureKey;
  // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함.
  if (pass.quarters && cachedTileValue(pass.lakes, tile, () => isLakeAutotileTile(tile, tileset))) {
    renderLakeAutotile(scene, tileset, textureKey, x, y, layer, pass);
    return;
  }
  if (layer === "lower" && pass.quarters) {
    const composition = chipsetQuarterComposition(scene.map, tileset, x, y);
    if (composition) {
      renderTerrainQuarter(scene, tileset, textureKey, x, y, composition, layer, pass);
      return;
    }
  }
  // lower 투명 칩: 정책이 정한 받침을 먼저 깔아 투명 픽셀이 검게 보이지 않게 한다.
  // 받침은 정책(tileLayerPolicy)이 정한다 — 합본 마을 밑동뿐 아니라 혼합 칩셋(위 반쪽 밑동·숲 나무 띠)과
  // 사용자가 받침을 확정한 커스텀 칩셋도 같은 답을 받는다. 규칙이 없으면 null 이라 그 밖은 전과 같다.
  const backingTile = layer === "lower" ? cachedTileValue(pass.backing, tile, () => tileBackingTile(tileset, tile)) : null;
  if (backingTile !== null) {
    const backing = scene.add.image(x * pass.size, y * pass.size, textureKey, `tile_${backingTile}`);
    placeMapTileImage(scene, backing, tileset, backingTile, x, y, layer, 0, pass);
  }
  renderRawTile(scene, tileset, x, y, tile, layer, 0, pass);
}

/**
 * 타일 한 칸을 원래 모양 그대로 그린다 — 지형 쿼터 합성·호수 자동타일·받침 없이.
 * 2층·4층이 이 경로를 쓴다(설계: 위 층은 저자가 고른 칩 그대로). 애니메이션 칩은 그대로 움직인다.
 */
function renderRawTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  layer: "lower" | "upper",
  depthOffset: number,
  pass: TileRenderPass,
): void {
  if (tile < 0) return;
  const textureKey = pass.textureKey;
  const animationKey = cachedTileValue(pass.animations, tile, () => {
    const base = tilesetAnimationKeyForTile(tileset, tile);
    return base ? chipsetAnimationKey(textureKey, base) : null;
  });
  const size = pass.size;
  const image = animationKey
    ? playTileAnimation(rootYSortHost(scene), scene.add.sprite(x * size, y * size, textureKey, `tile_${tile}`), animationKey)
    : scene.add.image(x * size, y * size, textureKey, `tile_${tile}`);
  placeMapTileImage(scene, image, tileset, tile, x, y, layer, depthOffset, pass);
}

/**
 * 그림자 — 칸을 네 쿼터로 나눠 켜진 쿼터마다 반투명 검은 사각형을 깐다
 * (bit0 좌상, bit1 우상, bit2 좌하, bit3 우하). lower 컨테이너 안, 2층 위·3층 밑.
 */
function renderShadow<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  x: number,
  y: number,
  bits: number,
): void {
  if (bits === 0 || typeof scene.add.rectangle !== "function") return;
  const size = mapTileSize(scene.map);
  const half = size / 2;
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (!(bits & (1 << quarter))) continue;
    const liftPx = reliefLiftPx(scene.map, x, y, size);
    const rect = scene.add.rectangle(x * size + (quarter % 2) * half, y * size + Math.floor(quarter / 2) * half - liftPx, half, half, 0x000000, 0.5);
    rect.setOrigin(0, 0);
    trackMapTile(rootYSortHost(scene), rect, x, y - Math.floor(liftPx / size));
    if (liftPx > 0) {
      rect.setDepth(reliefRowDepth(y, size, RELIEF_LIFTED_SHADOW_DEPTH));
      trackRootYSortTile(scene, rect);
      continue;
    }
    rect.setDepth(y * 2 + SHADOW_LAYER_DEPTH_OFFSET);
    scene.tileLayer.add(rect);
  }
}

function renderLakeAutotile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  textureKey: string,
  x: number,
  y: number,
  layer: "lower" | "upper",
  pass: TileRenderPass,
): void {
  for (const part of lakeAutotileQuarterSources(scene.map, x, y, tileset)) {
    const animationKey = quarterAnimationKey(textureKey, part.tile, part.quarter);
    const frameName = quarterFrameName(part.tile, part.quarter);
    const image = animationKey
      ? playTileAnimation(rootYSortHost(scene), scene.add.sprite(x * pass.size + part.offsetX, y * pass.size + part.offsetY, textureKey, frameName), animationKey)
      : scene.add.image(x * pass.size + part.offsetX, y * pass.size + part.offsetY, textureKey, frameName);
    // 쿼터 소스는 맵 셀 좌표 기준 depth 를 공유한다.
    placeMapTileImage(scene, image, tileset, part.tile, x, y, layer, 0, pass);
  }
}

// 모래/흙길 지형 쿼터 합성: 각 쿼터는 계산된 소스 타일의 같은 위치를 사용한다.
function renderTerrainQuarter<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  textureKey: string,
  x: number,
  y: number,
  composition: ChipsetQuarterComposition,
  layer: "lower" | "upper",
  pass: TileRenderPass,
): void {
  if (composition.underlayTile !== undefined) {
    const underlay = scene.add.image(x * pass.size, y * pass.size, textureKey, `tile_${composition.underlayTile}`);
    placeMapTileImage(scene, underlay, tileset, composition.underlayTile, x, y, layer, 0, pass);
  }
  for (const part of composition.sources) {
    const image = scene.add.image(
      x * pass.size + part.offsetX,
      y * pass.size + part.offsetY,
      textureKey,
      `tile_${part.tile}_${part.quarter}`
    );
    placeMapTileImage(scene, image, tileset, part.tile, x, y, layer, 0, pass);
  }
}

function quarterFrameName(tile: number, quarter: LakeAutotileQuarter): string {
  return `tile_${tile}_${quarter}`;
}

function quarterAnimationKey(textureKey: string, tile: number, quarter: LakeAutotileQuarter): string | null {
  const animationKey = animationKeyForTile(tile);
  return animationKey ? chipsetAnimationKey(textureKey, `${animationKey}_${quarter}`) : null;
}

interface TweenTargetSource {
  readonly targets?: readonly object[] | null;
  readonly data?: readonly unknown[] | null;
}

function collectTweenTargets(tween: TweenTargetSource, targets: Set<object>): void {
  if (tween.targets) {
    for (const target of tween.targets) targets.add(target);
  } else {
    // TweenManager also contains TweenChains, and destroyed Tweens have null targets.
    for (const child of tween.data ?? []) {
      if (child && typeof child === "object" && ("targets" in child || "data" in child)) {
        collectTweenTargets(child as TweenTargetSource, targets);
      }
    }
  }
}

// Resolved creation inputs: primitive values plus texture identity for hot replacement.
// Position/direction-derived frame are updated every pass, not cached. Alpha, visibility
// and tint have no authored creation inputs here: new Sprite defaults win. Blend is authored
// (page graphic blendMode) and part of the signature.
const eventGraphicSignatures = new WeakMap<RenderedEventSprite, readonly unknown[]>();

function reusableEventSprite(sprite: RenderedEventSprite, texture: string, tweenTargets: Set<object>, blendMode = 0): boolean {
  // Some consumers capture the object (battle hiding, knockback/windup/landing tweens).
  // Replacing only these exceptional sprites preserves the old callback lifetime.
  // The authored blend (page graphic blendMode) is the expected value; anything else was set by someone else.
  return sprite.active !== false && sprite.visible !== false
    && (sprite.alpha === undefined || sprite.alpha === 1)
    && ((sprite.blendMode ?? 0) === blendMode)
    && !sprite.isTinted && !sprite.flipX && !sprite.flipY && !sprite.rotation
    && !sprite.anims?.isPlaying && !tweenTargets.has(sprite)
    && (!sprite.texture || sprite.texture.key === texture);
}

function renderEvents<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>
): void {
  // Old refresh destroyed all shadows. Preserve that immediate visibility boundary,
  // then let the next hop frame reuse the pooled object with updated lift/scale/alpha.
  for (const shadow of scene.characterShadows?.values() ?? []) shadow.setVisible(false);
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
  const retained = new Set<string>();
  const orderedSprites: [string, TSprite][] = [];
  const tweenTargets = new Set<object>();
  for (const tween of scene.tweens?.getTweens?.() ?? []) collectTweenTargets(tween, tweenTargets);
  const project = store.getCurrent();
  const size = mapTileSize(scene.map);
  const referenceSize = projectReferenceTileSize(project);
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    const event = view.event;
    scene.runtimeDom.upsertEventMarker(view, (eventId) => {
      void scene.runEvent(eventId);
    }, mapTileSize(scene.map));
    const sprite = view.sprite;
    if (!sprite) continue;
    // Command-driven frame changes must survive refreshRuntimeSurfaces (wait/transfer mid-sequence).
    const overrideFrame = scene.eventGraphicPatternOverrides?.get(event.id);
    const authoredPattern = view.page?.graphic.pattern;
    const pattern = overrideFrame ?? authoredPattern;
    const spriteTexture = resolveEventSpriteTexture(store.getCurrent(), sprite.id, pattern);
    if (!spriteTexture) scene.missingResources.add(sprite.id);
    // Static art has one frame. Charset overrides already encode direction/walk.
    const frame =
      spriteTexture?.fitSize
        ? spriteTexture.frame
        : overrideFrame !== undefined
          ? overrideFrame
          : eventSpriteFrameForDirection(spriteTexture, view.runtimeDirection) ?? spriteTexture?.frame ?? 0;
    // 걷는 중인 NPC 는 논리 위치가 이미 목적지다(playSceneAutonomous §moveAutonomousRuntimePosition).
    // 목적지에 새 스프라이트를 놓으면 이벤트가 열려 이동이 멎은 순간 NPC 가 한 칸 앞으로 튄다 —
    // 진행 중인 걸음의 보간 위치에 놓는다.
    const position = furniturePushPosition(scene, event.id) ?? renderedEventPosition(view, scene.autonomousNPCs?.get(event.id));
    const texture = spriteTexture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID;
    const signature = [texture, scene.textures?.get?.(texture), spriteTexture?.frame, spriteTexture?.fitSize, spriteTexture?.charset,
      authoredPattern, overrideFrame, view.page?.graphic.scale, view.page?.graphic.scaleMode,
      size, referenceSize, view.priority, view.page?.graphic.blendMode];
    const blendMode = phaserBlendMode(view.page?.graphic.blendMode);
    let marker = scene.eventSprites.get(event.id);
    const previous = marker && eventGraphicSignatures.get(marker);
    if (marker && (!previous || !signature.every((value, index) => Object.is(value, previous[index]))
      || !reusableEventSprite(marker, texture, tweenTargets, blendMode))) {
      marker.destroy();
      destroyCharacterShadow(scene, event.id);
      marker = undefined;
    }
    const x = footprintSpriteX(position.x, view.footprint, size);
    const y = characterSpriteY(position.y, size);
    if (marker) {
      marker.setPosition(x, y);
      marker.setFrame(frame);
    } else {
      marker = scene.add.sprite(x, y, texture, frame);
      if (blendMode !== 0) marker.setBlendMode?.(blendMode);
    }
    eventGraphicSignatures.set(marker, signature);
    retained.add(event.id);
    placeCharacterSprite(marker, view.priority);
    marker.setScale(eventSpriteScale(spriteTexture, marker, view.page?.graphic.scale, mapTileSize(scene.map), view.page?.graphic.scaleMode, projectReferenceTileSize(store.getCurrent()), mapCharacterSizeFactor(scene.map)));
    scene.eventSprites.set(event.id, marker);
    orderedSprites.push([event.id, marker]);
  }
  for (const [id, marker] of scene.eventSprites.entries()) {
    if (retained.has(id)) continue;
    marker.destroy();
    scene.eventSprites.delete(id);
    destroyCharacterShadow(scene, id);
  }
  // Preserve creation order at equal depth, including interleaved non-event effects.
  // Phaser's depth sort is stable. A single compaction avoids N moveAbove/indexOf calls.
  const displayList = scene.children?.list;
  if (displayList) {
    const sprites = new Set(orderedSprites.map(([, sprite]) => sprite));
    let write = 0;
    for (const object of displayList) {
      if (!sprites.has(object as TSprite)) displayList[write++] = object;
    }
    displayList.length = write;
    for (const [, sprite] of orderedSprites) displayList.push(sprite);
    scene.children!.queueDepthSort();
  }
  scene.eventSprites.clear();
  for (const [id, marker] of orderedSprites) scene.eventSprites.set(id, marker);
  // Erase commands can remove the sprite themselves before this refresh.
  for (const id of scene.characterShadows?.keys() ?? []) {
    if (id !== PLAYER_SHADOW_KEY && !retained.has(id)) destroyCharacterShadow(scene, id);
  }
  syncForageWarnings(scene);
  scene.runtimeDom.syncMissingResourceError(scene.missingResources);
  scene.syncRuntimeState();
}

function renderedEventPosition(
  view: RuntimeEventView,
  mover: AutonomousMover | undefined,
): { readonly x: number; readonly y: number } {
  const move = mover?.activeMove;
  if (!move) return { x: view.x, y: view.y };
  const durationMs = Math.max(1, move.durationMs ?? mover.moveDurationMs);
  const progress = Math.min(1, Math.max(0, move.elapsedMs / durationMs));
  return {
    x: move.fromX + (move.toX - move.fromX) * progress,
    y: move.fromY + (move.toY - move.fromY) * progress,
  };
}

export function resetMapRuntime(scene: PlaySceneContext): void {
  resetDetectionForMap(scene);
  clearFurniturePush(scene);
  // 맵이 바뀌면 타일 서명도 버린다 — 같은 맵 객체를 다시 로드하는 경로에서도 반드시 다시 그린다.
  invalidateTileLayer(scene);
  scene.eventPositions = initialRuntimeEventPositions(scene.map.events);
  // destroy 없이 clear만 하면 이전 맵의 NPC 스프라이트가 표시 목록에 고아로 남아
  // 맵 전이 때마다 "NPC 복사" 현상이 생긴다 — 팔로워와 동일하게 파괴 후 비운다.
  for (const sprite of scene.eventSprites.values()) sprite.destroy();
  scene.eventSprites.clear();
  for (const sprite of scene.followerSprites.values()) sprite.destroy();
  scene.followerSprites.clear();
  scene.parallelProcesses.clear();
  scene.autoStartedKeys.clear();
  scene.pageMoveRouteKeys.clear();
  scene.pageMoveRouteEventIds.clear();
  scene.commandMoveRouteEventIds.clear();
  scene.eventGraphicPatternOverrides.clear();
  scene.autonomousNPCs.clear();
  scene.fieldSpawnState = null;
  for (const animation of scene.activeMapAnimations) animation.destroy(true);
  scene.activeMapAnimations.clear();
  // 체공 상태와 그림자는 스프라이트 풀과 수명이 같다 — 남기면 새 맵에서 주인공이 떠 있다.
  scene.playerHop = null;
  scene.playerSlide = null;
  scene.playerSlideKind = null;
  abortHop(scene, PLAYER_SHADOW_KEY, scene.player);
  destroyAllCharacterShadows(scene);
  clearAllHopScales(scene);
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
}

export function activeRuntimeEvents(
  scene: PlaySceneContext,
  triggerKind: Trigger["kind"]
): RuntimeEventView[] {
  return runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
    .filter((event) => event.trigger.kind === triggerKind
      && (event.event.pages?.length
        ? event.page !== undefined
        : evalCondition(scene.session, event.event.condition, event.event, { map: scene.map })));
}

export function syncRuntimeState(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  // 계측 분기보다 앞에 둔다 — 배포 플레이어(비계측)에서도 컷신 중 HUD 가 숨어야 한다.
  syncCutsceneHudVisibility(scene);
  // Production boundary: the broad debug snapshot (all runtime event views, session records,
  // mover snapshots) exists only for QA instrumentation. A shipped player syncs the visible
  // HUD and picture layer directly and never builds or serializes that payload.
  if (!scene.runtimeDom.instrumented) {
    syncVisibleRuntimeHud(scene, project);
    scene.runtimeDom.syncPictureLayer(scene.session.pictures);
    return;
  }
  // 계측 부팅(편집기 테스트 플레이·QA)의 상태 미러는 **읽을 때만** 만든다. 매 프레임 이벤트 뷰 전체를
  // 페이지 조건까지 평가하고 생활 상태를 structuredClone 하고 세션 전체를 JSON.stringify 하던 것이
  // 편집기에서만 렉이 심한 주원인이었다. 보이는 HUD 는 출하 경로와 똑같이 매 프레임 맞춘다.
  if (typeof scene.runtimeDom.syncRuntimeStateSource === "function") {
    scene.runtimeDom.syncRuntimeStateSource(() => runtimeStateSnapshot(scene), {
      mapId: scene.getMapId(), x: scene.tileX, y: scene.tileY, inputEnabled: scene.inputEnabled, running: scene.running,
    });
    syncVisibleRuntimeHud(scene, project);
  } else {
    scene.runtimeDom.syncRuntimeState(runtimeStateSnapshot(scene));
  }
  scene.runtimeDom.syncAudioState(scene.session.audio);
  scene.runtimeDom.syncPictureLayer(scene.session.pictures);
}

function syncVisibleRuntimeHud(scene: PlaySceneContext, project: ReturnType<typeof store.getCurrent>): void {
  const timed = resolveTimeSystem(project);
  scene.runtimeDom.syncVisibleHud({
    timers: scene.session.timers,
    timerActive: runtimeTimerActivity(scene.runtimeTimers),
    gameTime: timed ? scene.session.gameTime : undefined,
    timePhase: timed ? timePhaseFor(scene.session.gameTime) : undefined,
    lifeCalendarHudLines: timed ? lifeCalendarHudLines(project, scene.session) : undefined,
  });
}

/** QA 상태 미러 한 장. 지연 미러가 읽을 때, 또는 지연 출처가 없는 스텁에서 즉시 부른다. */
function runtimeStateSnapshot(scene: PlaySceneContext): RuntimeStateSnapshot {
  const project = store.getCurrent();
  const events: Record<string, RuntimeEventSnapshot> = {};
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    events[view.event.id] = {
      x: view.x,
      y: view.y,
      pageId: view.pageId,
      priority: view.priority,
      trigger: view.trigger.kind,
      direction: view.direction,
      // 사각은 view 가 이미 계산해 둔 것을 그대로 싣는다 — 여기서 다시 파생하면 런타임 판정과
      // 디버그 표면이 갈라진다(그러면 QA 가 통과해도 게임은 틀린 사각으로 돌 수 있다).
      footprint: view.footprint,
      passRows: view.passRows,
      bodyRect: view.bodyRect,
      passRect: view.passRect,
    };
  }
  return {
    ...buildLifeRuntimeSnapshot(scene.session),
    ...(scene.runtimeDom.actionReceipt ? { actionReceipt: scene.runtimeDom.actionReceipt } : {}),
    mapId: scene.getMapId(),
    inputEnabled: scene.inputEnabled,
    running: scene.running,
    player: { x: scene.tileX, y: scene.tileY },
    switches: scene.session.switches,
    variables: scene.session.variables,
    timers: scene.session.timers,
    timerActive: runtimeTimerActivity(scene.runtimeTimers),
    flags: scene.session.flags,
    mapOverrides: scene.session.mapOverrides,
    gold: scene.session.gold,
    inventory: scene.session.inventory,
    partyActorIds: scene.session.partyActorIds,
    actorSkillIds: scene.session.actorSkillIds,
    actorExperience: scene.session.actorExperience,
    actorLevels: scene.session.actorLevels,
    actorVitals: scene.session.actorVitals,
    eventLocations: scene.session.eventLocations,
    followers: scene.session.followers,
    followerTrail: scene.session.followerTrail,
    removedEventIds: scene.session.removedEventIds,
    spawnedEvents: scene.session.spawnedEvents,
    camera: scene.session.camera,
    lighting: scene.session.lighting,
    actorEquipment: scene.session.actorEquipment,
    actorRows: scene.session.actorRows,
    classOverrides: scene.session.classOverrides,
    audio: scene.session.audio,
    pictures: scene.session.pictures,
    // 상점 경제 상태. 세이브에는 진작 들어 있었지만(saveSlots.ts) 런타임 상태 덤프에는
    // 없어서 마일리지·누적 지출이 실제로 쌓이는지 밖에서 확인할 방법이 없었다.
    shopLoyaltySpend: scene.session.shopLoyaltySpend,
    shopTradeCounts: scene.session.shopTradeCounts,
    shopMileagePoints: scene.session.shopMileagePoints,
    m2Runtime: scene.session.m2Runtime,
    events,
    movers: runtimeMoverSnapshots(scene.autonomousNPCs),
    battleResult: scene.session.battleResult,
    gameTime: resolveTimeSystem(project) ? scene.session.gameTime : undefined,
    timePhase: resolveTimeSystem(project) ? timePhaseFor(scene.session.gameTime) : undefined,
    lifeCalendarHudLines: resolveTimeSystem(project) ? lifeCalendarHudLines(project, scene.session) : undefined,
  };
}

type CutsceneHudHost = {
  readonly classList: { toggle(token: string, force?: boolean): unknown };
};

function isCutsceneHudHost(value: unknown): value is CutsceneHudHost {
  return !!value && typeof value === "object" && "classList" in value;
}

export function syncCutsceneHudVisibility(scene: {
  readonly game: { readonly registry: { get(key: string): unknown } };
  readonly session: PlaySceneContext["session"];
}): void {
  const host = scene.game.registry.get("dialogueHost");
  if (!isCutsceneHudHost(host)) return;
  host.classList.toggle(CUTSCENE_HUD_HIDDEN_CLASS, isCutsceneHudHidden(scene.session));
}

export function refreshRuntimeSurfaces(scene: PlaySceneContext): void {
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  syncScreenEffects(scene);
  // 이벤트가 끔나는 자리다 — 그 이벤트 안에서 난 구역 드나듦(문을 밟은 장소 이동이
  // 대표적이다)은 running 이라 밀려 있다. 자동 트리거보다 **먼지** 돌린다:
  // «어떤 구역에 들어왔는가» 가 도착 맵 전역 연출보다 국지적이고, 자동 이벤트가 먼지 돌아
  // running 을 썼으면 드나듦이 또 밀린다.
  drainPendingLocationTransitions(scene);
  void fireAutoTriggers(scene);
}

/**
 * refreshRuntimeSurfaces 의 이벤트 전용 판. 타일 재생성을 뺀 것 말고는 같다.
 * NPC 위치·페이지·시간표처럼 이벤트 계층만 달라진 갱신에 쓴다.
 */
export function refreshRuntimeEntities(scene: PlaySceneContext): void {
  renderEventLayer(scene);
  scene.registerPageMoveRoutes();
  syncScreenEffects(scene);
  rebindEventFollowCamera(scene);
  drainPendingLocationTransitions(scene);
  void fireAutoTriggers(scene);
}

/**
 * 이벤트 스프라이트를 파괴·재생성한 뒤 카메라를 새 객체에 다시 건다.
 *
 * 왜 필요한가: renderEventLayer 는 그래픽이 달라진 이벤트의 스프라이트를 교체한다.
 * Phaser 의 Camera.preRender 는 follow 대상의 destroy 여부를 보지
 * 않고 매 프레임 `follow.x` 를 읽고, destroy 는 x/y 를 지우지 않는다 — 그래서 이벤트를
 * 따라가던 카메라는 마지막 좌표에 **영구히 얼어붙는다**. refreshRuntimeSurfaces 는
 * applyStoredCameraState 로 다시 걸지만 이 이벤트 전용 경로에는 그게 없었다.
 *
 * 플레이어 추적은 건드리지 않는다: 플레이어 스프라이트는 그대로라 다시 걸 이유가 없고,
 * startFollow 는 midPoint/scrollX 를 대상 좌표로 하드 설정하므로(Camera.js §startFollow)
 * 시간표 점검마다 부르면 0.2 러프가 죽고 카메라가 튄다.
 */
export function rebindEventFollowCamera(scene: PlaySceneContext): void {
  const camera = scene.session.camera;
  if (camera?.mode !== "follow" || camera.target.kind !== "event") return;
  applyStoredCameraState(scene);
}

export async function fireAutoTriggers(scene: PlaySceneContext): Promise<void> {
  // Map loading and surface refresh also call this path before PlayScene.create ends.
  if (scene.game.registry.get('initialPresentationPending') === true) return;
  // Map refresh can run before player.ts installs dialogue. Do not consume the
  // one-shot key before runEvent/runCommands can actually accept this event.
  if (!dialogueUi(scene) || scene.sys?.isActive() === false) return;
  const events = activeRuntimeEvents(scene, "auto");
  for (const event of events) {
    const key = `${scene.getMapId()}:${event.event.id}:${event.pageId ?? "legacy"}`;
    if (scene.autoStartedKeys.has(key) || scene.running) continue;
    scene.autoStartedKeys.add(key);
    await scene.runEvent(event.event.id);
  }
  const project = store.getCurrent();
  for (const commonEvent of project.commonEvents) {
    if (commonEvent.trigger !== "auto") continue;
    const key = `common:${commonEvent.id}`;
    if (commonEvent.conditionSwitchId && !scene.session.switches[commonEvent.conditionSwitchId]) {
      scene.autoStartedKeys.delete(key);
      continue;
    }
    if (scene.autoStartedKeys.has(key) || scene.running) continue;
    // 본문이 비었거나 빈 문장뿐인 자동 공용 이벤트는 빈 대사 창만 열고 입력을 잠근다. 건너뛴다.
    if (!commonEventHasContent(commonEvent.commands)) continue;
    scene.autoStartedKeys.add(key);
    // 전이 뒤에도 명령을 이어 실행한다 — 「transfer → setSwitch false」 패턴(꿈에서 깨어남, 2026-09-24 dream-r5)
    // 가 전이에서 잘리면 스위치가 남아 자동 이벤트가 맵 로드마다 다시 살아 방으로 되돌린다(출하 플레이어 실측).
    await runCommands(scene, commonEvent.commands, undefined, { continueAfterTransfer: true });
  }
}

function commonEventHasContent(commands: readonly Command[]): boolean {
  return commands.some((command) => command.kind !== "text" || command.body.trim() !== "");
}

export function applyMapOverrides(scene: PlaySceneContext): void {
  if (!scene.session.mapOverrides[scene.getMapId()]) return;
  invalidateTilePassabilityComponents(scene.map);
  applyRuntimeMapOverrides(scene.map, scene.session);
}
