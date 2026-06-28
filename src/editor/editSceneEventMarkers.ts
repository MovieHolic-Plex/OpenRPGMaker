import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { editorState, type Layer } from "@/editor/editorState";
import { resolveEventSpriteTexture, type EventSpriteTexture } from "@/player/eventSpriteResources";
import { committedEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";

const SELECTED_EVENT_RING_COLOR = 0x69db7c;
const EVENT_TILE_FILL_COLOR = 0xff007a;
const EVENT_TILE_FILL_ALPHA = 1;
const EVENT_TILE_SPRITE_FILL_ALPHA = 0;
const EVENT_TILE_STROKE_COLOR = 0xffffff;
const EVENT_TILE_STROKE_ALPHA = 0.95;
const EVENT_BADGE_FILL_COLOR = 0x1f2937;
const EVENT_BADGE_FILL_ALPHA = 0.38;
const EVENT_BADGE_STROKE_COLOR = 0xcbd5e1;
const EVENT_BADGE_STROKE_ALPHA = 0.72;
const EVENT_BADGE_ALPHA = 0.86;

type EventMarkerPosition = {
  readonly x: number;
  readonly y: number;
};

export interface EventMarkerRenderContext {
  readonly scene: Phaser.Scene;
  readonly overlayLayer: Phaser.GameObjects.Container;
}

export function editorEventMarkerTexture(project: Project, graphic: EventPageGraphic | undefined): EventSpriteTexture | null {
  if (graphic?.transparent === true) return null;
  const sprite = graphic?.sprite;
  return sprite ? resolveEventSpriteTexture(project, sprite.id, graphic.pattern) : null;
}

export function eventMarkerTileScale(width: number, height: number): number {
  return Math.min((TILE_SIZE - 2) / width, (TILE_SIZE - 2) / height, 1);
}

export function renderEventMarkers(context: EventMarkerRenderContext, map: GameMap, activeLayer: Layer): void {
  const project = store.getCurrent();
  const state = editorState.get();
  const selectedId = state.selectedEventId;
  for (const event of committedEvents(map.events)) {
    const cx = event.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = event.y * TILE_SIZE + TILE_SIZE / 2;
    const position = { x: cx, y: cy };
    if (activeLayer === "event") {
      const graphic = eventGraphicForEditorMarker(event, selectedId, state.selectedEventPageId);
      const spriteTexture = editorEventMarkerTexture(project, graphic);
      context.overlayLayer.add(createEditableEventMarker(context.scene, position, spriteTexture !== null));
      if (spriteTexture) context.overlayLayer.add(createEditableEventSprite(context.scene, position, spriteTexture));
    } else {
      context.overlayLayer.add(createEventBadgeMarker(context.scene, cx, cy));
    }
    if (event.id === selectedId) addSelectedEventRing(context, position);
  }
}

function addSelectedEventRing(context: EventMarkerRenderContext, position: EventMarkerPosition): void {
  const ring = context.scene.add.rectangle(
    position.x,
    position.y,
    TILE_SIZE,
    TILE_SIZE,
    SELECTED_EVENT_RING_COLOR,
    0
  );
  ring.setStrokeStyle(2, SELECTED_EVENT_RING_COLOR);
  context.overlayLayer.add(ring);
}

function createEditableEventMarker(
  scene: Phaser.Scene,
  position: EventMarkerPosition,
  hasSprite: boolean
): Phaser.GameObjects.Rectangle {
  const fillAlpha = hasSprite ? EVENT_TILE_SPRITE_FILL_ALPHA : EVENT_TILE_FILL_ALPHA;
  const marker = scene.add.rectangle(
    position.x,
    position.y,
    TILE_SIZE - 4,
    TILE_SIZE - 4,
    EVENT_TILE_FILL_COLOR,
    fillAlpha
  );
  marker.setStrokeStyle(2, EVENT_TILE_STROKE_COLOR, EVENT_TILE_STROKE_ALPHA);
  return marker;
}

function createEditableEventSprite(
  scene: Phaser.Scene,
  position: EventMarkerPosition,
  spriteTexture: EventSpriteTexture
): Phaser.GameObjects.Image {
  const sprite = scene.add.image(position.x, position.y, spriteTexture.texture, spriteTexture.frame);
  sprite.setOrigin(0.5, 0.5);
  sprite.setScale(eventMarkerTileScale(sprite.width, sprite.height));
  return sprite;
}

function eventGraphicForEditorMarker(
  event: GameEvent,
  selectedEventId: string | null,
  selectedEventPageId: string | null
): EventPageGraphic | undefined {
  const selectedPage = event.id === selectedEventId && selectedEventPageId
    ? event.pages?.find((page) => page.id === selectedEventPageId)
    : undefined;
  const page = selectedPage ?? event.pages?.[0];
  if (page) return page.graphic;
  return event.sprite ? { sprite: event.sprite } : undefined;
}

function createEventBadgeMarker(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const marker = scene.add.container(x, y);
  const badge = scene.add.circle(0, 0, TILE_SIZE / 2 - 2, EVENT_BADGE_FILL_COLOR, EVENT_BADGE_FILL_ALPHA);
  badge.setStrokeStyle(1, EVENT_BADGE_STROKE_COLOR, EVENT_BADGE_STROKE_ALPHA);
  const label = scene.add.text(0, 0, "E", {
    color: "#dbeafe",
    fontFamily: "\"Cascadia Mono\", \"JetBrains Mono\", Consolas, monospace",
    fontSize: `${TILE_SIZE - 7}px`,
    fontStyle: "bold",
  }).setOrigin(0.5);
  marker.add(badge);
  marker.add(label);
  marker.setAlpha(EVENT_BADGE_ALPHA);
  return marker;
}
