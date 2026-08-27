import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { editorState, type Layer } from "@/editor/editorState";
import { resolveEventSpriteTexture, type EventSpriteTexture } from "@/player/eventSpriteResources";
import { editorWorkingEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import { projectFontStack } from "@/project/fontRegistry";
import type { EventPageGraphic, GameEvent, GameMap, MapId, Project } from "@/project/types";

const SELECTED_EVENT_RING_COLOR = 0x69db7c;
const EVENT_TILE_FILL_COLOR = 0x1f2937;
const EVENT_TILE_FILL_ALPHA = 0.34;
const EVENT_TILE_SPRITE_FILL_ALPHA = 0;
const EVENT_TILE_STROKE_COLOR = 0xffffff;
const EVENT_TILE_STROKE_ALPHA = 0.95;
const EVENT_BADGE_FILL_COLOR = 0x1f2937;
const EVENT_BADGE_FILL_ALPHA = 0.38;
const EVENT_BADGE_STROKE_COLOR = 0xcbd5e1;
const EVENT_BADGE_STROKE_ALPHA = 0.72;
const EVENT_BADGE_ALPHA = 0.86;
const EVENT_CLICK_FILL_COLOR = 0xd9e8f6;
const EVENT_CLICK_FILL_ALPHA = 0.55;
const EVENT_CLICK_STROKE_COLOR = 0x0a246a;
const EVENT_CLICK_STROKE_ALPHA = 0.95;
const EVENT_CLICK_TEXT_COLOR = "#ffffff";
const EVENT_CLICK_TEXT_BACKGROUND = "#0a246a";
/** 라벨 문자열('새 이벤트 위치 12,34')은 한글이 대부분이라 자자가 고른 UI 글꼴을 그대로 쓴다.
 *  UI 역할 스택은 한글 가능 글꼴로 시작하므로, 모노가 앞에 있을 때처럼 글자마다 폴백해
 *  베이스라인·굵기가 섞이는 문제가 생기지 않는다. 캔버스는 CSS 변수를 못 읽어 마킹
 *  시점에 스택 문자열을 집어와야 하므로 상수가 아니라 함수다. */
export function eventLabelFontFamily(): string {
  return projectFontStack(store.getCurrent().system.fonts, "ui");
}
export const EVENT_LABEL_FONT_SIZE = "12px";
/** 캔버스 텍스트 래스터화 해상도 하한. Phaser Text의 resolution 기본값은 1이라
 *  고DPI 화면이나 카메라 확대 시 1x로 래스터화된 뒤 뭉개진다. */
const EVENT_LABEL_MIN_RESOLUTION = 2;
/** 텍스처 메모리 낭비를 막기 위한 해상도 상한. */
const EVENT_LABEL_MAX_RESOLUTION = 4;

/** 클릭 피드백 라벨의 캔버스 래스터화 해상도를 계산하는 순수 함수.
 *  devicePixelRatio와 카메라 zoom을 곱해 올림하되, [하한, 상한] 범위로 제한한다.
 *  happy-dom 등 devicePixelRatio가 없는 환경에서는 1로 폴백한다. */
export function eventLabelResolution(devicePixelRatio: number | undefined, cameraZoom: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && (devicePixelRatio as number) > 0 ? (devicePixelRatio as number) : 1;
  const zoom = Number.isFinite(cameraZoom) && cameraZoom > 0 ? cameraZoom : 1;
  return Math.min(EVENT_LABEL_MAX_RESOLUTION, Math.max(EVENT_LABEL_MIN_RESOLUTION, Math.ceil(dpr * zoom)));
}

type EventMarkerPosition = {
  readonly x: number;
  readonly y: number;
};

export interface EventMarkerRenderContext {
  readonly scene: Phaser.Scene;
  readonly overlayLayer: Phaser.GameObjects.Container;
}

export type EventLayerClickFeedback = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly mode: "create" | "edit";
};

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
  for (const event of editorWorkingEvents(map.events)) {
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

export function renderEventLayerClickFeedback(
  context: EventMarkerRenderContext,
  feedback: EventLayerClickFeedback
): void {
  const worldX = feedback.x * TILE_SIZE;
  const worldY = feedback.y * TILE_SIZE;
  const marker = context.scene.add.rectangle(
    worldX,
    worldY,
    TILE_SIZE,
    TILE_SIZE,
    EVENT_CLICK_FILL_COLOR,
    EVENT_CLICK_FILL_ALPHA
  );
  marker.setOrigin(0, 0);
  marker.setStrokeStyle(2, EVENT_CLICK_STROKE_COLOR, EVENT_CLICK_STROKE_ALPHA);
  context.overlayLayer.add(marker);

  const labelY = Math.max(0, worldY - 14);
  const action = feedback.mode === "edit" ? "편집 위치" : "새 이벤트 위치";
  // overlayLayer는 카메라 zoom이 적용되므로 zoom까지 반영해 고해상도로 래스터화한다.
  // 12px + 배경(#0a246a) 대비로 가독성을 확보하며, 캔버스에서 뭉개지는 bold는 쓰지 않는다.
  const label = context.scene.add.text(worldX + 2, labelY, `${action} ${feedback.x},${feedback.y}`, {
    backgroundColor: EVENT_CLICK_TEXT_BACKGROUND,
    color: EVENT_CLICK_TEXT_COLOR,
    fontFamily: eventLabelFontFamily(),
    fontSize: EVENT_LABEL_FONT_SIZE,
    // cameras 는 테스트의 가짜 scene 에 없을 수 있다 — 옵셔널 체이닝으로 접근하고 zoom 은 1로 폴백한다.
    // (eventLabelResolution 이 비정상 zoom 을 다시 1로 정규화하므로 안전하다.)
    resolution: eventLabelResolution(globalThis.devicePixelRatio, context.scene.cameras?.main?.zoom ?? 1),
    padding: { left: 4, right: 4, top: 2, bottom: 2 },
  });
  context.overlayLayer.add(label);
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
    fontFamily: projectFontStack(store.getCurrent().system.fonts, "mono"),
    fontSize: `${TILE_SIZE - 7}px`,
    fontStyle: "bold",
  }).setOrigin(0.5);
  marker.add(badge);
  marker.add(label);
  marker.setAlpha(EVENT_BADGE_ALPHA);
  return marker;
}
