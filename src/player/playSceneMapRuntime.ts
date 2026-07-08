import { chipsetAnimationKey, TILE_SIZE } from "@/assets/bundled";
import { isDefaultTilesetTexture, tilesetTextureKey } from "@/editor/tilesetImage";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import {
  isLakeAutotileTile,
  lakeAutotileQuarterSources,
  type LakeAutotileQuarter,
} from "@/project/defaults/lakeAutotile";
import {
  isTerrainQuarterTile,
  terrainQuarterSources,
  type TerrainQuarterSource,
} from "@/project/defaults/terrainQuarterAutotile";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { MapId, TilesetDef } from "@/project/types";
import { runCommands } from "@/player/playSceneInterpreter";
import { eventSpriteFrameForDirection, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { characterSpriteX, characterSpriteY, placeCharacterSprite } from "@/player/characterDepth";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import { runtimeMoverSnapshots } from "@/player/runtimeMoverSnapshots";
import { resolveTimeSystem, timePhaseFor } from "@/project/gameTime";
import { runtimeTimerActivity } from "@/player/playSceneTimers";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { applyMapDefaultLighting } from "@/player/lighting";
import { initializeFieldSpawnsForScene } from "@/player/playSceneFieldSpawns";
import {
  initialRuntimeEventPositions,
  runtimeEventViewsForMap,
  type RuntimeEventView,
} from "@/player/runtimeEventState";
import type { RuntimeEventSnapshot } from "@/player/runtimeDom";

interface RenderedTileImage {
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
}

interface RenderedEventSprite extends RenderedTileImage {
  readonly y: number;
  play(key: string): this;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
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
    add(image: TImage | TSprite): unknown;
  };
  readonly eventSprites: {
    values(): IterableIterator<TSprite>;
    clear(): void;
    set(eventId: string, marker: TSprite): unknown;
  };
  readonly runtimeDom: Pick<
    PlaySceneContext["runtimeDom"],
    "clearEventMarkers" | "upsertEventMarker" | "syncMissingResourceError"
  >;
  readonly missingResources: Set<string>;
  readonly add: {
    image(x: number, y: number, texture: string, frame?: string | number): TImage;
    sprite(x: number, y: number, texture: string, frame?: string | number): TSprite;
  };
  readonly resolveTilesetTexture?: (tileset: TilesetDef) => string;
  runEvent(eventId: string): Promise<void>;
  syncRuntimeState(): void;
}

export function loadMap(scene: PlaySceneContext, mapId: MapId, options: { readonly preserveErasedEvents?: boolean; readonly applyDefaultLighting?: boolean } = {}): void {
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    console.warn(`[player] map not found: ${mapId}`);
    return;
  }
  scene.map = mapWithCommittedEvents(map);
  scene.session.currentMapId = mapId;
  if (options.applyDefaultLighting !== false) applyMapDefaultLighting(scene.session, scene.map);
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
  for (const sprite of scene.eventSprites.values()) sprite.destroy();
  scene.eventSprites.clear();
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
  const map = scene.map;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const index = y * map.width + x;
      renderTile(scene, tileset, x, y, map.lowerTiles[index]);
      for (const tile of tileStackAt(map, "lower", index)) renderTile(scene, tileset, x, y, tile);
      renderTile(scene, tileset, x, y, map.upperTiles[index]);
      for (const tile of tileStackAt(map, "upper", index)) renderTile(scene, tileset, x, y, tile);
    }
  }
  renderEvents(scene);
}

function renderTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number
): void {
  if (tile < 0) return;
  const textureKey = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  if (isDefaultTilesetTexture(tileset) && isLakeAutotileTile(tile)) {
    renderLakeAutotile(scene, textureKey, x, y);
    return;
  }
  if (isDefaultTilesetTexture(tileset) && isTerrainQuarterTile(tile)) {
    const terrainQuarters = terrainQuarterSources(scene.map, x, y);
    if (terrainQuarters) {
      renderTerrainQuarter(scene, textureKey, x, y, terrainQuarters);
      return;
    }
  }
  const baseAnimationKey = isDefaultTilesetTexture(tileset) ? animationKeyForTile(tile) : null;
  const animationKey = baseAnimationKey ? chipsetAnimationKey(textureKey, baseAnimationKey) : null;
  const image = animationKey
    ? scene.add.sprite(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${tile}`).play(animationKey)
    : scene.add.image(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${tile}`);
  image.setOrigin(0, 0);
  scene.tileLayer.add(image);
}

function renderLakeAutotile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  textureKey: string,
  x: number,
  y: number
): void {
  for (const part of lakeAutotileQuarterSources(scene.map, x, y)) {
    const animationKey = quarterAnimationKey(textureKey, part.tile, part.quarter);
    const frameName = quarterFrameName(part.tile, part.quarter);
    const image = animationKey
      ? scene.add.sprite(x * TILE_SIZE + part.offsetX, y * TILE_SIZE + part.offsetY, textureKey, frameName).play(animationKey)
      : scene.add.image(x * TILE_SIZE + part.offsetX, y * TILE_SIZE + part.offsetY, textureKey, frameName);
    image.setOrigin(0, 0);
    scene.tileLayer.add(image);
  }
}

// 모래/흙길 지형 쿼터 합성: 각 쿼터는 계산된 소스 타일의 같은 위치를 사용한다.
function renderTerrainQuarter<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  textureKey: string,
  x: number,
  y: number,
  sources: readonly TerrainQuarterSource[]
): void {
  for (const part of sources) {
    const image = scene.add.image(
      x * TILE_SIZE + part.offsetX,
      y * TILE_SIZE + part.offsetY,
      textureKey,
      `tile_${part.tile}_${part.quarter}`
    );
    image.setOrigin(0, 0);
    scene.tileLayer.add(image);
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
    const spriteTexture = resolveEventSpriteTexture(store.getCurrent(), sprite.id, view.page?.graphic.pattern);
    if (!spriteTexture) scene.missingResources.add(sprite.id);
    const frame = eventSpriteFrameForDirection(spriteTexture, view.runtimeDirection) ?? spriteTexture?.frame ?? 0;
    const marker = scene.add.sprite(
      characterSpriteX(view.x),
      characterSpriteY(view.y),
      spriteTexture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
      frame
    );
    placeCharacterSprite(marker, view.priority);
    scene.eventSprites.set(event.id, marker);
  }
  scene.runtimeDom.syncMissingResourceError(scene.missingResources);
  scene.syncRuntimeState();
}

export function resetMapRuntime(scene: PlaySceneContext): void {
  scene.eventPositions = initialRuntimeEventPositions(scene.map.events);
  scene.eventSprites.clear();
  for (const sprite of scene.followerSprites.values()) sprite.destroy();
  scene.followerSprites.clear();
  scene.parallelProcesses.clear();
  scene.autoStartedKeys.clear();
  scene.pageMoveRouteKeys.clear();
  scene.pageMoveRouteEventIds.clear();
  scene.commandMoveRouteEventIds.clear();
  scene.autonomousNPCs.clear();
  scene.fieldSpawnState = null;
  for (const animation of scene.activeMapAnimations) animation.destroy(true);
  scene.activeMapAnimations.clear();
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
  const events: Record<string, RuntimeEventSnapshot> = {};
  for (const view of runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)) {
    events[view.event.id] = {
      x: view.x,
      y: view.y,
      pageId: view.pageId,
      priority: view.priority,
      trigger: view.trigger.kind,
      direction: view.direction,
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
    m2Runtime: scene.session.m2Runtime,
    events,
    movers: runtimeMoverSnapshots(scene.autonomousNPCs),
    battleResult: scene.session.battleResult,
    gameTime: resolveTimeSystem(store.getCurrent()) ? scene.session.gameTime : undefined,
    timePhase: resolveTimeSystem(store.getCurrent()) ? timePhaseFor(scene.session.gameTime) : undefined,
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
