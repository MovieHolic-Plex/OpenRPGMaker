import { chipsetAnimationKey, TILE_SIZE } from "@/assets/bundled";
import {
  isDefaultTilesetTexture,
  supportsChipsetQuarterComposition,
  tilesetTextureKey,
} from "@/editor/tilesetImage";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import { isTransparentChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import {
  isLakeAutotileTile,
  lakeAutotileQuarterSources,
  type LakeAutotileQuarter,
} from "@/project/defaults/lakeAutotile";
import {
  chipsetQuarterComposition,
  type ChipsetQuarterComposition,
} from "@/project/defaults/terrainQuarterAutotile";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { isTreeTrunkTileId } from "@/project/tilesetHarness";
import { store } from "@/project/store";
import type { MapId, TilesetDef } from "@/project/types";
import { runCommands } from "@/player/playSceneInterpreter";
import { abortHop, PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { destroyAllCharacterShadows } from "@/player/characterShadow";
import { startMapBgm } from "@/player/mapBgm";
import { eventSpriteFrameForDirection, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import {
  characterSpriteY,
  footprintSpriteX,
  isAlwaysAboveCharacterUpperTile,
  mapUpperTileDepth,
  placeCharacterSprite,
} from "@/player/characterDepth";
// ★ 수관은 upperTileLayer(고정 250k). 솔리드 가구(×)는 root display list + y-sort.
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import { runtimeMoverSnapshots } from "@/player/runtimeMoverSnapshots";
import { lifeCalendarHudLines } from "@/player/lifeCalendarHud";
import { resolveTimeSystem, timePhaseFor } from "@/project/gameTime";
import { runtimeTimerActivity } from "@/player/playSceneTimers";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { applyMapDefaultLighting } from "@/project/lightingRules";
import { initializeFieldSpawnsForScene } from "@/player/playSceneFieldSpawns";
import { renderFarmOverlays } from "@/player/playSceneFarming";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { initialRuntimeEventPositions,
runtimeEventViewsForMap,
type RuntimeEventView, } from "@/project/runtimeEventState"
import type { RuntimeEventSnapshot } from "@/player/runtimeDom";

interface RenderedTileImage {
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
  destroy?(removeFromDisplayList?: boolean): void;
}

/** root display list 에 올린 솔리드 upper 가구 — container removeAll 대상이 아니라 직접 destroy. */
const rootYSortTiles = new WeakMap<object, RenderedTileImage[]>();

interface RenderedEventSprite extends RenderedTileImage {
  readonly y: number;
  play(key: string): this;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
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
    removeAll(removeChildren?: boolean): void;
    add(image: TImage | TSprite | unknown): unknown;
  };
  /**
   * ★ 수관 등 always-above upper 전용. 솔리드 가구(×)는 root에 y-sort 로 올린다.
   * 없으면 tileLayer 로 폴백(레거시 테스트).
   */
  readonly upperTileLayer?: {
    removeAll(removeChildren?: boolean): void;
    add(image: TImage | TSprite | unknown): unknown;
  };
  /** optional host identity for WeakMap tracking of root y-sort tiles */
  readonly sceneHost?: object;
  /** 체공 그림자 풀. 이벤트 스프라이트를 파괴할 때 같이 비워야 고아 그림자가 남지 않는다. */
  characterShadows?: Map<string, import("@/player/characterShadow").ShadowImage>;
  readonly eventSprites: {
    values(): IterableIterator<TSprite>;
    clear(): void;
    set(eventId: string, marker: TSprite): unknown;
  };
  readonly eventGraphicPatternOverrides?: Map<string, number>;
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
  applyMapOverrides(scene);
  initializeFieldSpawnsForScene(scene);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  scene.syncRuntimeState();
}

export function renderTiles<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
>(scene: RenderTilesSceneContext<TImage, TSprite>): void {
  scene.tileLayer.removeAll(true);
  scene.upperTileLayer?.removeAll(true);
  clearRootYSortTiles(scene);
  for (const sprite of scene.eventSprites.values()) sprite.destroy();
  scene.eventSprites.clear();
  destroyAllCharacterShadows(scene);
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
  const map = scene.map;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const index = y * map.width + x;
      renderTile(scene, tileset, x, y, map.lowerTiles[index], "lower");
      for (const tile of tileStackAt(map, "lower", index)) renderTile(scene, tileset, x, y, tile, "lower");
      renderTile(scene, tileset, x, y, map.upperTiles[index], "upper");
      for (const tile of tileStackAt(map, "upper", index)) renderTile(scene, tileset, x, y, tile, "upper");
    }
  }
  renderFarmOverlays(scene, store.getCurrent().database.crops ?? []);
  renderPlaceableOverlays(scene);
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
  image: RenderedTileImage,
  tileset: TilesetDef,
  tile: number,
  y: number,
  layer: "lower" | "upper",
): void {
  if (layer !== "upper") {
    // lower 컨테이너 안 정렬: 같은 셀 스택 순서를 안정화.
    image.setDepth(y * 2);
    return;
  }
  image.setDepth(mapUpperTileDepth(tileset, tile, y));
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
  image: TImage,
): void {
  const host = rootYSortHost(scene);
  const tiles = rootYSortTiles.get(host) ?? [];
  tiles.push(image);
  rootYSortTiles.set(host, tiles);
}

function placeMapTileImage<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  image: TImage,
  tileset: TilesetDef,
  tile: number,
  y: number,
  layer: "lower" | "upper",
): void {
  const alwaysAbove = layer === "upper" && isAlwaysAboveCharacterUpperTile(tileset, tile);
  image.setOrigin(0, 0);
  applyTileDepth(image, tileset, tile, y, layer);
  if (layer === "upper" && !alwaysAbove) {
    // root display list — same-priority 캐릭터와 y-sort.
    trackRootYSortTile(scene, image);
    return;
  }
  tileTargetLayer(scene, layer, alwaysAbove).add(image);
}

function renderTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  layer: "lower" | "upper",
): void {
  if (tile < 0) return;
  const textureKey = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함.
  if (supportsChipsetQuarterComposition(tileset) && isLakeAutotileTile(tile)) {
    renderLakeAutotile(scene, tileset, textureKey, x, y, layer);
    return;
  }
  if (layer === "lower" && supportsChipsetQuarterComposition(tileset)) {
    const composition = chipsetQuarterComposition(scene.map, tileset, x, y);
    if (composition) {
      renderTerrainQuarter(scene, tileset, textureKey, x, y, composition, layer);
      return;
    }
  }
  // lower 투명 밑동: 잔디를 먼저 깔아 투명 픽셀이 검게 보이지 않게 한다.
  if (
    layer === "lower"
    && isDefaultTilesetTexture(tileset)
    && isTreeTrunkTileId(tile)
    && isTransparentChipsetTile(tile)
  ) {
    const grass = scene.add.image(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${TILE.GRASS}`);
    placeMapTileImage(scene, grass, tileset, TILE.GRASS, y, layer);
  }
  const baseAnimationKey = isDefaultTilesetTexture(tileset) ? animationKeyForTile(tile) : null;
  const animationKey = baseAnimationKey ? chipsetAnimationKey(textureKey, baseAnimationKey) : null;
  const image = animationKey
    ? scene.add.sprite(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${tile}`).play(animationKey)
    : scene.add.image(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${tile}`);
  placeMapTileImage(scene, image, tileset, tile, y, layer);
}

function renderLakeAutotile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  textureKey: string,
  x: number,
  y: number,
  layer: "lower" | "upper",
): void {
  for (const part of lakeAutotileQuarterSources(scene.map, x, y)) {
    const animationKey = quarterAnimationKey(textureKey, part.tile, part.quarter);
    const frameName = quarterFrameName(part.tile, part.quarter);
    const image = animationKey
      ? scene.add.sprite(x * TILE_SIZE + part.offsetX, y * TILE_SIZE + part.offsetY, textureKey, frameName).play(animationKey)
      : scene.add.image(x * TILE_SIZE + part.offsetX, y * TILE_SIZE + part.offsetY, textureKey, frameName);
    // 쿼터 소스는 맵 셀 좌표 기준 depth 를 공유한다.
    placeMapTileImage(scene, image, tileset, part.tile, y, layer);
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
): void {
  if (composition.underlayTile !== undefined) {
    const underlay = scene.add.image(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${composition.underlayTile}`);
    placeMapTileImage(scene, underlay, tileset, composition.underlayTile, y, layer);
  }
  for (const part of composition.sources) {
    const image = scene.add.image(
      x * TILE_SIZE + part.offsetX,
      y * TILE_SIZE + part.offsetY,
      textureKey,
      `tile_${part.tile}_${part.quarter}`
    );
    placeMapTileImage(scene, image, tileset, part.tile, y, layer);
  }
}

function quarterFrameName(tile: number, quarter: LakeAutotileQuarter): string {
  return `tile_${tile}_${quarter}`;
}

function quarterAnimationKey(textureKey: string, tile: number, quarter: LakeAutotileQuarter): string | null {
  const animationKey = animationKeyForTile(tile);
  return animationKey ? chipsetAnimationKey(textureKey, `${animationKey}_${quarter}`) : null;
}

function renderEvents<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>
): void {
  for (const view of runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)) {
    const event = view.event;
    scene.runtimeDom.upsertEventMarker(view, (eventId) => {
      void scene.runEvent(eventId);
    });
    const sprite = view.sprite;
    if (!sprite) continue;
    // Command-driven frame changes must survive refreshRuntimeSurfaces (wait/transfer mid-sequence).
    const overrideFrame = scene.eventGraphicPatternOverrides?.get(event.id);
    const authoredPattern = view.page?.graphic.pattern;
    const pattern = overrideFrame ?? authoredPattern;
    const spriteTexture = resolveEventSpriteTexture(store.getCurrent(), sprite.id, pattern);
    if (!spriteTexture) scene.missingResources.add(sprite.id);
    // Absolute override frames already encode direction/walk — do not re-idle remap.
    const frame =
      overrideFrame !== undefined
        ? overrideFrame
        : eventSpriteFrameForDirection(spriteTexture, view.runtimeDirection) ?? spriteTexture?.frame ?? 0;
    const marker = scene.add.sprite(
      footprintSpriteX(view.x, view.footprint),
      characterSpriteY(view.y),
      spriteTexture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
      frame
    );
    placeCharacterSprite(marker, view.priority);
    marker.setScale(view.scale);
    scene.eventSprites.set(event.id, marker);
  }
  scene.runtimeDom.syncMissingResourceError(scene.missingResources);
  scene.syncRuntimeState();
}

export function resetMapRuntime(scene: PlaySceneContext): void {
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
  abortHop(scene, PLAYER_SHADOW_KEY, scene.player);
  destroyAllCharacterShadows(scene);
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
}

export function activeRuntimeEvents(
  scene: PlaySceneContext,
  triggerKind: "action" | "touch" | "playerTouch" | "eventTouch" | "auto" | "parallel"
): RuntimeEventView[] {
  return runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
    .filter((event) => event.trigger.kind === triggerKind);
}

export function syncRuntimeState(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  // Production boundary: the broad debug snapshot (all runtime event views, session records,
  // mover snapshots) exists only for QA instrumentation. A shipped player syncs the visible
  // HUD and picture layer directly and never builds or serializes that payload.
  if (!scene.runtimeDom.instrumented) {
    const timed = resolveTimeSystem(project);
    scene.runtimeDom.syncVisibleHud({
      timers: scene.session.timers,
      timerActive: runtimeTimerActivity(scene.runtimeTimers),
      gameTime: timed ? scene.session.gameTime : undefined,
      timePhase: timed ? timePhaseFor(scene.session.gameTime) : undefined,
      lifeCalendarHudLines: timed ? lifeCalendarHudLines(project, scene.session) : undefined,
    });
    scene.runtimeDom.syncPictureLayer(scene.session.pictures);
    return;
  }
  const events: Record<string, RuntimeEventSnapshot> = {};
  for (const view of runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)) {
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
  scene.runtimeDom.syncRuntimeState({
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
  });
  scene.runtimeDom.syncAudioState(scene.session.audio);
  scene.runtimeDom.syncPictureLayer(scene.session.pictures);
}

export function refreshRuntimeSurfaces(scene: PlaySceneContext): void {
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  syncScreenEffects(scene);
  void fireAutoTriggers(scene);
}

export async function fireAutoTriggers(scene: PlaySceneContext): Promise<void> {
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
    scene.autoStartedKeys.add(key);
    await runCommands(scene, commonEvent.commands);
  }
}

export function applyMapOverrides(scene: PlaySceneContext): void {
  const overrides = scene.session.mapOverrides[scene.getMapId()];
  if (!overrides) return;
  for (const idxStr in overrides.lower) {
    const index = Number(idxStr);
    if (index >= 0 && index < scene.map.lowerTiles.length) {
      scene.map.lowerTiles[index] = overrides.lower[index];
    }
  }
  for (const idxStr in overrides.upper) {
    const index = Number(idxStr);
    if (index >= 0 && index < scene.map.upperTiles.length) {
      scene.map.upperTiles[index] = overrides.upper[index];
    }
  }
}
