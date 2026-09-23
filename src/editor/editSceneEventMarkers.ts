import { mapTileSize } from "@/project/tileGeometry";
import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { editorState, type Layer } from "@/editor/editorState";
import { eventSpriteFrameForDirection, eventSpriteScale, isCharsetSpriteTexture, resolveEventSpriteTexture, type EventSpriteTexture } from "@/player/eventSpriteResources";
import { editorWorkingEvents } from "@/project/eventDrafts";
import { resolveEventAppearanceGraphic } from "@/project/characterAppearances";
import { overlappingEventPairs } from "@/project/eventFootprintQuery";
import {
  UNIT_FOOTPRINT,
  footprintBounds,
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  normalizePassRows,
  passageBounds,
} from "@/project/footprint";
import { store } from "@/project/store";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { resolveEventPage } from "@/project/io/pageResolution";
import { projectFontStack } from "@/project/fontRegistry";
import type {
  CharacterFootprint,
  EventPage,
  EventPageGraphic,
  GameEvent,
  GameMap,
  MapId,
  Project,
} from "@/project/types";

const SELECTED_EVENT_RING_COLOR = 0x69db7c;
const EVENT_TILE_FILL_COLOR = 0x1f2937;
const EVENT_TILE_FILL_ALPHA = 0.34;
const EVENT_TILE_SPRITE_FILL_ALPHA = 0;
const EVENT_TILE_STROKE_COLOR = 0xffffff;
const EVENT_TILE_STROKE_ALPHA = 0.95;
/** 다중 타일 몸 사각은 채움을 옅게 — 안에 든 타일 그림이 보여야 한다. */
const EVENT_BODY_FILL_ALPHA = 0.12;
const EVENT_PASS_FILL_COLOR = 0x0a246a;
const EVENT_PASS_FILL_ALPHA = 0.38;
/** 몸 사각이 겹친 이벤트의 외곽선. 저작 시점 경고이고 lint 와 같은 판정식을 쓴다(D5). */
const EVENT_OVERLAP_STROKE_COLOR = 0xff6b6b;
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
  /** 이 맵의 좌표 단위(px). 렌더·히트테스트가 같은 값을 읽도록 호출자가 넘긴다. */
  readonly tileSize?: number;
}

export type EventLayerClickFeedback = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly mode: "create" | "edit";
};

export function editorEventMarkerTexture(project: Project, graphic: EventPageGraphic | undefined): EventSpriteTexture | null {
  if (graphic?.transparent === true) return null;
  const effective = graphic ? resolveEventAppearanceGraphic(project, graphic) : undefined;
  const sprite = effective?.sprite;
  const texture = sprite ? resolveEventSpriteTexture(project, sprite.id, effective.pattern) : null;
  return texture ? { ...texture, frame: eventSpriteFrameForDirection(texture, effective?.direction) ?? texture.frame } : null;
}

/**
 * 배율 없는 그림을 타일 한 칸에 밀어 넣는 축소율. **1x1 폴백과 레이어 배지 전용**이다.
 * 발자국·배율이 있는 이벤트는 `editorSpriteScale` 로 실제 크기를 그린다 — 여기로 보내면
 * 3x3 골렘이 16px 로 쪼그라들어 편집 맵이 크기를 못 보여준다.
 *
 * `tileSize` 를 주면 그 좌표 단위로 계산한다. 인자를 생략하면 16(기본 규격) — 기존 호출부와
 * 테스트가 보던 값이 변하지 않게 하려는 것이고, 편집 렌더는 항상 맵의 값을 넘긴다.
 */
export function eventMarkerTileScale(width: number, height: number, tileSize: number = TILE_SIZE): number {
  return Math.min((tileSize - 2) / width, (tileSize - 2) / height, 1);
}

/**
 * 편집 맵 스프라이트 배율. 저장된 `graphic.scale` 을 그대로 쓴다 — 플레이 화면과 같은 크기로
 * 보이는 것이 목적이므로 타일에 맞춰 줄이지 않는다. 배율이 없으면 기존 축소 폴백으로 돌아간다.
 */
export function editorSpriteScale(
  graphic: EventPageGraphic | undefined,
  width: number,
  height: number,
  tileSize: number = TILE_SIZE
): number {
  if (graphic?.scale === undefined) return eventMarkerTileScale(width, height, tileSize);
  return normalizeCharacterScale(graphic.scale);
}

export function renderEventMarkers(context: EventMarkerRenderContext, map: GameMap, activeLayer: Layer): void {
  const project = store.getCurrent();
  const state = editorState.get();
  const selectedId = state.selectedEventId;
  const events = editorWorkingEvents(map.events);
  const overlapping = activeLayer === "event" ? overlappingEventIds(events) : new Set<string>();
  const tileSize = context.tileSize ?? mapTileSize(map);
  for (const event of events) {
    const cx = event.x * tileSize + tileSize / 2;
    const cy = event.y * tileSize + tileSize / 2;
    const position = { x: cx, y: cy };
    if (activeLayer === "event") {
      const page = eventPageForEditorMarker(event, selectedId, state.selectedEventPageId, project, map);
      const graphic = page?.graphic ?? (event.sprite ? { sprite: event.sprite } : undefined);
      const body = normalizeCharacterFootprint(page?.footprint);
      const passRows = normalizePassRows(page?.passRows, body.height);
      const spriteTexture = editorEventMarkerTexture(project, graphic);
      // 몸 사각이 1x1 을 넘으면 사각 오버레이가 크기를 말해 주므로 한 칸 마커는 접는다.
      if (isUnitBody(body)) {
        context.overlayLayer.add(createEditableEventMarker(context.scene, position, spriteTexture !== null, tileSize));
      } else {
        addFootprintOverlay(context, event, body, passRows, overlapping.has(event.id), tileSize);
      }
      if (spriteTexture) {
        context.overlayLayer.add(
          createEditableEventSprite(context.scene, event, body, graphic, spriteTexture, tileSize)
        );
      }
    } else {
      const page = eventPageForEditorMarker(event, selectedId, state.selectedEventPageId, project, map);
      const graphic = page?.graphic ?? (event.sprite ? { sprite: event.sprite } : undefined);
      const texture = editorEventMarkerTexture(project, graphic);
      if (texture) {
        context.overlayLayer.add(createEditableEventSprite(context.scene, event,
          normalizeCharacterFootprint(page?.footprint), graphic, texture, tileSize));
      } else {
        context.overlayLayer.add(createEventBadgeMarker(context.scene, cx, cy, tileSize));
      }
    }
    if (event.id === selectedId) addSelectedEventRing(context, position, tileSize);
  }
}

function isUnitBody(body: CharacterFootprint): boolean {
  return body.width === UNIT_FOOTPRINT.width && body.height === UNIT_FOOTPRINT.height;
}

/** 몸 사각이 겹치는 이벤트 id. 겹침 경고 배지가 lint 와 같은 판정식을 쓴다(D5). */
function overlappingEventIds(events: readonly GameEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const pair of overlappingEventPairs(events)) {
    ids.add(pair.a.id);
    ids.add(pair.b.id);
  }
  return ids;
}

/** 몸 사각 외곽선 + 통행 차단 행 음영. 앵커 칸은 따로 표시해 발밑이 어디인지 남긴다. */
function addFootprintOverlay(
  context: EventMarkerRenderContext,
  event: GameEvent,
  body: CharacterFootprint,
  passRows: number,
  overlapping: boolean,
  tileSize: number
): void {
  const bodyRect = footprintBounds(event.x, event.y, body);
  const passRect = passageBounds(event.x, event.y, body, passRows);
  const pass = context.scene.add.rectangle(
    passRect.left * tileSize,
    passRect.top * tileSize,
    (passRect.right - passRect.left + 1) * tileSize,
    (passRect.bottom - passRect.top + 1) * tileSize,
    EVENT_PASS_FILL_COLOR,
    EVENT_PASS_FILL_ALPHA
  );
  pass.setOrigin(0, 0);
  context.overlayLayer.add(pass);

  const outline = context.scene.add.rectangle(
    bodyRect.left * tileSize,
    bodyRect.top * tileSize,
    (bodyRect.right - bodyRect.left + 1) * tileSize,
    (bodyRect.bottom - bodyRect.top + 1) * tileSize,
    EVENT_TILE_FILL_COLOR,
    EVENT_BODY_FILL_ALPHA
  );
  outline.setOrigin(0, 0);
  outline.setStrokeStyle(
    2,
    overlapping ? EVENT_OVERLAP_STROKE_COLOR : EVENT_TILE_STROKE_COLOR,
    EVENT_TILE_STROKE_ALPHA
  );
  outline.setData("testid", overlapping ? "event-body-overlap" : "event-body-rect");
  context.overlayLayer.add(outline);
}

export function renderEventLayerClickFeedback(
  context: EventMarkerRenderContext,
  feedback: EventLayerClickFeedback
): void {
  const tileSize = context.tileSize ?? mapTileSize(store.getCurrent().maps[feedback.mapId]);
  const worldX = feedback.x * tileSize;
  const worldY = feedback.y * tileSize;
  const marker = context.scene.add.rectangle(
    worldX,
    worldY,
    tileSize,
    tileSize,
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

function addSelectedEventRing(context: EventMarkerRenderContext, position: EventMarkerPosition, tileSize: number): void {
  const ring = context.scene.add.rectangle(
    position.x,
    position.y,
    tileSize,
    tileSize,
    SELECTED_EVENT_RING_COLOR,
    0
  );
  ring.setStrokeStyle(2, SELECTED_EVENT_RING_COLOR);
  context.overlayLayer.add(ring);
}

function createEditableEventMarker(
  scene: Phaser.Scene,
  position: EventMarkerPosition,
  hasSprite: boolean,
  tileSize: number
): Phaser.GameObjects.Rectangle {
  const fillAlpha = hasSprite ? EVENT_TILE_SPRITE_FILL_ALPHA : EVENT_TILE_FILL_ALPHA;
  const marker = scene.add.rectangle(
    position.x,
    position.y,
    tileSize - 4,
    tileSize - 4,
    EVENT_TILE_FILL_COLOR,
    fillAlpha
  );
  marker.setStrokeStyle(2, EVENT_TILE_STROKE_COLOR, EVENT_TILE_STROKE_ALPHA);
  return marker;
}

/**
 * 작성자가 크기를 지정했는가. 지정하지 않은 이벤트는 **예전 그대로** 타일 중앙에 축소해
 * 그린다 — 발자국 없는 기존 맵의 모습이 한 픽셀도 바뀌면 안 된다(항등 게이트).
 */
function usesAuthoredSize(body: CharacterFootprint, graphic: EventPageGraphic | undefined): boolean {
  return !isUnitBody(body) || graphic?.scale !== undefined;
}

/**
 * 크기를 지정한 이벤트는 실제 배율로, 몸 사각의 **발밑 중앙**에 세운다.
 *
 * 원점이 (0.5, 1) 인 이유: 플레이 화면과 같다. 발이 몸 사각 밑변에 닿고 머리가 위로 자라야
 * 3x3 골렘의 상체가 자기 위 칸을 덮는 모습이 편집 맵에서도 그대로 보인다. 지정 안 한
 * 이벤트는 (0.5, 0.5) + 한 칸 축소 — 1차와 같다.
 */
function createEditableEventSprite(
  scene: Phaser.Scene,
  event: GameEvent,
  body: CharacterFootprint,
  graphic: EventPageGraphic | undefined,
  spriteTexture: EventSpriteTexture,
  tileSize: number
): Phaser.GameObjects.Image {
  if (!isCharsetSpriteTexture(spriteTexture) && !usesAuthoredSize(body, graphic)) {
    const legacy = scene.add.image(
      event.x * tileSize + tileSize / 2,
      event.y * tileSize + tileSize / 2,
      spriteTexture.texture,
      spriteTexture.frame
    );
    legacy.setOrigin(0.5, 0.5);
    legacy.setScale(eventMarkerTileScale(legacy.width, legacy.height, tileSize));
    return legacy;
  }
  const rect = footprintBounds(event.x, event.y, body);
  const sprite = scene.add.image(
    event.x * tileSize + tileSize / 2,
    (rect.bottom + 1) * tileSize,
    spriteTexture.texture,
    spriteTexture.frame
  );
  sprite.setOrigin(0.5, 1);
  sprite.setScale(isCharsetSpriteTexture(spriteTexture)
    ? eventSpriteScale(spriteTexture, sprite, graphic?.scale, tileSize, graphic?.scaleMode, projectReferenceTileSize(store.getCurrent()))
    : editorSpriteScale(graphic, sprite.width, sprite.height, tileSize));
  return sprite;
}

/**
 * 맵에 그릴 페이지. 편집기가 이 이벤트의 어떤 페이지를 **보고 있는 동안**은 그 페이지(편집 중 미리보기),
 * 아니면 **게임을 새로 시작했을 때 켜질 페이지**다. 예전엔 후자가 무조건 1페이지였고, 편집기가 닫혀도
 * `selectedEventPageId` 가 남아 2페이지 그래픽(없음)을 계속 그렸다(2026-09-17 적대적 리뷰 P0-4).
 */
function eventPageForEditorMarker(
  event: GameEvent,
  selectedEventId: string | null,
  selectedEventPageId: string | null,
  project: Project,
  map: GameMap,
): EventPage | undefined {
  const selectedPage = event.id === selectedEventId && selectedEventPageId
    ? event.pages?.find((page) => page.id === selectedEventPageId)
    : undefined;
  return selectedPage ?? eventPageAtGameStart(event, project, map);
}

/**
 * 새 게임 시작 직후 이 이벤트가 켤 페이지 — 저작한 시작 상태(`project.session`)로 페이지 조건을 평가한다.
 * 어느 페이지도 조건을 못 채우면(게임에서는 보이지 않는 이벤트) 마커는 1페이지 모습으로 자리를 표시한다.
 */
export function eventPageAtGameStart(event: GameEvent, project: Project, map: GameMap): EventPage | undefined {
  const start = project.session;
  const resolved = resolveEventPage(
    event,
    {
      switches: start?.switches ?? {},
      variables: start?.variables ?? {},
      selfSwitches: start?.selfSwitches,
      inventory: start?.inventory,
      partyActorIds: start?.partyActorIds,
      gold: start?.gold,
    },
    { locations: map.locations },
  );
  return resolved ?? event.pages?.[0];
}

function createEventBadgeMarker(scene: Phaser.Scene, x: number, y: number, tileSize: number): Phaser.GameObjects.Container {
  const marker = scene.add.container(x, y);
  const badge = scene.add.circle(0, 0, tileSize / 2 - 2, EVENT_BADGE_FILL_COLOR, EVENT_BADGE_FILL_ALPHA);
  badge.setStrokeStyle(1, EVENT_BADGE_STROKE_COLOR, EVENT_BADGE_STROKE_ALPHA);
  const label = scene.add.text(0, 0, "E", {
    color: "#dbeafe",
    fontFamily: projectFontStack(store.getCurrent().system.fonts, "mono"),
    fontSize: `${tileSize - 7}px`,
    fontStyle: "bold",
  }).setOrigin(0.5);
  marker.add(badge);
  marker.add(label);
  // 이벤트 레이어가 아닐 때는 배지를 절반으로 내린다(2026-09-21) — 타일 레이어에서는
  // 배지가 참고 표시이고, 이벤트 레이어에서만 본체다. 레이어 버튼을 눌렀을 때
  // 배지 대비 변화가 「이제 이벤트 레이어다」라는 즉시 신호가 된다.
  marker.setAlpha(editorState.get().layer === "event" ? EVENT_BADGE_ALPHA : EVENT_BADGE_ALPHA * 0.45);
  return marker;
}
