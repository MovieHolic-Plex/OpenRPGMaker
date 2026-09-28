// Frozen pre-reuse event layer (2026-09-28); independent differential oracle.
import { renderEventLayer } from "@/player/playSceneMapRuntime";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { runtimeEventViewsForMap, type RuntimeEventView } from "@/project/runtimeEventState";
import { furniturePushPosition } from "@/player/furniturePushAnimation";
import { characterSpriteY, footprintSpriteX, placeCharacterSprite } from "@/player/characterDepth";
import { eventSpriteFrameForDirection, eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { syncForageWarnings } from "@/player/playScenePlaceables";
import { destroyAllCharacterShadows } from "@/player/characterShadow";
import type { AutonomousMover } from "@/player/playSceneTypes";
export function legacyRenderEvents(
  scene: Parameters<typeof renderEventLayer>[0]
): void {
  for (const sprite of scene.eventSprites.values()) sprite.destroy();
  scene.eventSprites.clear();
  destroyAllCharacterShadows(scene);
  scene.runtimeDom.clearEventMarkers();
  scene.missingResources.clear();
  for (const view of runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)) {
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
    const marker = scene.add.sprite(
      footprintSpriteX(position.x, view.footprint, mapTileSize(scene.map)),
      characterSpriteY(position.y, mapTileSize(scene.map)),
      spriteTexture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
      frame
    );
    placeCharacterSprite(marker, view.priority);
    marker.setScale(eventSpriteScale(spriteTexture, marker, view.page?.graphic.scale, mapTileSize(scene.map), view.page?.graphic.scaleMode, projectReferenceTileSize(store.getCurrent())));
    scene.eventSprites.set(event.id, marker);
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
