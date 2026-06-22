import { TEX_NPC, TILE_SIZE } from "@/assets/bundled";
import { isDefaultTilesetTexture, tilesetTextureKey } from "@/editor/tilesetImage";
import { isPassable } from "@/project/collision";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import { setMapTileOverride } from "@/project/session";
import type { MapId, TilesetDef } from "@/project/types";
import type { StepResult } from "@/player/interpreter";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  initialRuntimeEventPositions,
  runtimeEventView,
  type RuntimeEventView,
} from "@/player/runtimeEventState";
import type { RuntimeEventSnapshot } from "@/player/runtimeDom";

interface RenderedTileImage {
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
}

interface RenderedEventSprite extends RenderedTileImage {
  play(key: string): this;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
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
  runEvent(eventId: string): Promise<void>;
  syncRuntimeState(): void;
}

export function loadMap(scene: PlaySceneContext, mapId: MapId): void {
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    console.warn(`[player] map not found: ${mapId}`);
    return;
  }
  scene.map = structuredClone(map);
  scene.session.currentMapId = mapId;
  resetMapRuntime(scene);
  applyMapOverrides(scene);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  scene.syncRuntimeState();
}

export function renderTiles<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
>(scene: RenderTilesSceneContext<TImage, TSprite>): void {
  scene.tileLayer.removeAll(true);
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
  const textureKey = tilesetTextureKey(tileset);
  const animationKey = isDefaultTilesetTexture(tileset) ? animationKeyForTile(tile) : null;
  const image = animationKey
    ? scene.add.sprite(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${tile}`).play(animationKey)
    : scene.add.image(x * TILE_SIZE, y * TILE_SIZE, textureKey, `tile_${tile}`);
  image.setOrigin(0, 0);
  scene.tileLayer.add(image);
}

function renderEvents<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>
): void {
  for (const event of scene.map.events) {
    const view = runtimeEventView(event, scene.session, scene.eventPositions);
    scene.runtimeDom.upsertEventMarker(view, (eventId) => {
      void scene.runEvent(eventId);
    });
    const sprite = view.sprite;
    if (!sprite) continue;
    const spriteTexture = resolveEventSpriteTexture(store.getCurrent(), sprite.id, view.page?.graphic.pattern);
    if (!spriteTexture) scene.missingResources.add(sprite.id);
    const marker = scene.add.sprite(
      view.x * TILE_SIZE + TILE_SIZE / 2,
      view.y * TILE_SIZE + TILE_SIZE / 2,
      spriteTexture?.texture ?? TEX_NPC,
      spriteTexture?.frame ?? 0
    );
    marker.setOrigin(0.5, 0.5);
    marker.setDepth(view.priority === "above" ? 6 : view.priority === "below" ? 1 : 4);
    scene.tileLayer.add(marker);
    scene.eventSprites.set(event.id, marker);
  }
  scene.runtimeDom.syncMissingResourceError(scene.missingResources);
  scene.syncRuntimeState();
}

export function resetMapRuntime(scene: PlaySceneContext): void {
  scene.eventPositions = initialRuntimeEventPositions(scene.map.events);
  scene.eventSprites.clear();
  scene.parallelProcesses.clear();
  scene.autoStartedKeys.clear();
  scene.pageMoveRouteKeys.clear();
  scene.autonomousNPCs.clear();
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
}

export function activeRuntimeEvents(
  scene: PlaySceneContext,
  triggerKind: "action" | "touch" | "playerTouch" | "eventTouch" | "auto" | "parallel"
): RuntimeEventView[] {
  return scene.map.events
    .map((event) => runtimeEventView(event, scene.session, scene.eventPositions))
    .filter((event) => event.trigger.kind === triggerKind);
}

export function syncRuntimeState(scene: PlaySceneContext): void {
  const events: Record<string, RuntimeEventSnapshot> = {};
  for (const event of scene.map.events) {
    const view = runtimeEventView(event, scene.session, scene.eventPositions);
    events[event.id] = {
      x: view.x,
      y: view.y,
      pageId: view.pageId,
      priority: view.priority,
      trigger: view.trigger.kind,
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
    events,
    battleResult: scene.session.battleResult,
  });
  scene.runtimeDom.syncAudioState(scene.session.audio);
  scene.runtimeDom.syncPictureLayer(scene.session.pictures);
}

export function refreshRuntimeSurfaces(scene: PlaySceneContext): void {
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  void fireAutoTriggers(scene);
}

export async function fireAutoTriggers(scene: PlaySceneContext): Promise<void> {
  const events = activeRuntimeEvents(scene, "auto");
  for (const event of events) {
    const key = `${scene.getMapId()}:${event.event.id}:${event.pageId ?? "legacy"}`;
    if (scene.autoStartedKeys.has(key)) continue;
    scene.autoStartedKeys.add(key);
    await scene.runEvent(event.event.id);
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

export function applyChangeTileStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "changeTile" }>
): void {
  const targetMap = store.getCurrent().maps[step.mapId];
  if (!targetMap) return;
  const index = step.y * targetMap.width + step.x;
  if (index < 0 || index >= targetMap.lowerTiles.length) return;
  setMapTileOverride(scene.session, step.mapId, step.layer, index, step.tile);
  if (step.mapId === scene.getMapId()) applyMapOverrides(scene);
}

export function transferTo(scene: PlaySceneContext, mapId: MapId, x: number, y: number): void {
  const project = store.getCurrent();
  const targetMap = project.maps[mapId];
  if (!targetMap) {
    console.warn(`[player] transfer target map missing: ${mapId}`);
    return;
  }
  const destination = nearestPassableTile(project, targetMap, x, y);
  scene.loadMap(mapId);
  scene.tileX = destination.x;
  scene.tileY = destination.y;
  scene.session.x = destination.x;
  scene.session.y = destination.y;
  scene.player.setPosition(
    destination.x * TILE_SIZE + TILE_SIZE / 2,
    destination.y * TILE_SIZE + TILE_SIZE / 2
  );
  scene.moving = false;
  scene.centerCamera();
  void fireAutoTriggers(scene);
}

function nearestPassableTile(
  project: ReturnType<typeof store.getCurrent>,
  map: ReturnType<typeof store.getCurrent>["maps"][MapId],
  x: number,
  y: number
): { x: number; y: number } {
  let fx = Math.max(0, Math.min(map.width - 1, x));
  let fy = Math.max(0, Math.min(map.height - 1, y));
  if (isPassable(project, map, fx, fy)) return { x: fx, y: fy };
  for (let radius = 0; radius < Math.max(map.width, map.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (isPassable(project, map, fx + dx, fy + dy)) {
          return { x: fx + dx, y: fy + dy };
        }
      }
    }
  }
  return { x: fx, y: fy };
}
