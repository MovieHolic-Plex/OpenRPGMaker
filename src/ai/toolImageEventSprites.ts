import { spriteFrameOrigin, type SpriteFrameOrigin } from "@/project/spriteFrameAnchor";
import { uploadedSpriteFrame } from "@/project/uploadedSpriteGeometry";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import { mapTileSize } from "@/project/tileGeometry";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { CC0_ICON_ASSETS, resolveCc0IconAssetUrl } from '@/assets/cc0IconAssets';
import {
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetDirection,
  type CharsetFrameSource,
} from "@/assets/easyrpgRtp";
import { clearCharsetImageCache, loadKeyedCharsetImage } from "./toolImageCanvas";
import { characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import {
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  UNIT_FOOTPRINT,
} from "@/project/footprint";
import { resolveEventPage } from "@/project/io/pageResolution";
import type {
  CharacterFootprint,
  EventPage,
  EventPageGraphic,
  EventPriority,
  GameEvent,
  GameMap,
  Project,
} from "@/project/types";

export type RegionEventSprite = {
  readonly eventId: string;
  readonly priority: EventPriority;
  readonly imageUrl: string;
  readonly preserveAlpha?: boolean;
  readonly frame: CharsetFrameSource;
  /** Destination top-left in region canvas pixels (origin at authored ground anchor). */
  readonly destX: number;
  readonly destY: number;
  readonly destW: number;
  readonly destH: number;
  readonly groundX?: number;
  readonly groundY?: number;
};

export type RegionEventSpritesResult =
  | { readonly ok: true; readonly sprites: readonly RegionEventSprite[] }
  | { readonly ok: false; readonly reason: string };

type RegionBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

type ClaimedPageVisual = {
  readonly origin?: SpriteFrameOrigin;
  readonly imageUrl: string;
  readonly preserveAlpha?: boolean;
  readonly frame: CharsetFrameSource;
  readonly scale: number;
  readonly footprint: CharacterFootprint;
  readonly priority: EventPriority;
};

const PRIORITY_ORDER: Record<EventPriority, number> = { below: 0, same: 1, above: 2 };
/**
 * Map events inside a show_map_region clip, using only canonical charset/uploaded graphics.
 * Every page graphic is a claimed visual (same contract as mapVisualContent). Unsupported graphics
 * fail closed. Multi-variant page states draw the page active at game start (runtime page rule).
 */
export function resolveRegionEventSprites(
  project: Project,
  map: GameMap,
  region: RegionBox,
  pixelsPerTile: number,
): RegionEventSpritesResult {
  const sprites: RegionEventSprite[] = [];
  for (const event of map.events) {
    if (!anchorInRegion(event, region)) continue;
    const resolved = resolveEventSprite(project, event, region, pixelsPerTile, mapTileSize(map));
    if (!resolved.ok) return resolved;
    if (resolved.sprite) sprites.push(resolved.sprite);
  }
  sprites.sort((a, b) => {
    const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priority !== 0) return priority;
    return (a.groundY ?? a.destY + a.destH) - (b.groundY ?? b.destY + b.destH)
      || (a.groundX ?? a.destX) - (b.groundX ?? b.destX) || a.eventId.localeCompare(b.eventId);
  });
  return { ok: true, sprites };
}

export async function drawRegionEventSprites(
  context: CanvasRenderingContext2D,
  sprites: readonly RegionEventSprite[],
): Promise<void> {
  for (const sprite of sprites) {
    const image = sprite.preserveAlpha ? await loadUnkeyedSpriteImage(sprite.imageUrl) : await loadKeyedCharsetImage(sprite.imageUrl);
    context.drawImage(
      image,
      sprite.frame.x,
      sprite.frame.y,
      sprite.frame.width,
      sprite.frame.height,
      sprite.destX,
      sprite.destY,
      sprite.destW,
      sprite.destH,
    );
  }
}

export function clearToolImageEventSpriteCache(): void {
  clearCharsetImageCache();
}

function resolveEventSprite(
  project: Project,
  event: GameEvent,
  region: RegionBox,
  pixelsPerTile: number,
  tileSize: number,
): { readonly ok: true; readonly sprite: RegionEventSprite | null } | { readonly ok: false; readonly reason: string } {
  const claimed = claimedPageVisuals(project, event);
  if (!claimed.ok) return claimed;
  if (claimed.visuals.length === 0) return { ok: true, sprite: null };
  // 페이지마다 모습이 다르면(닫힌 상자/열린 상자 같은 표준 2페이지) 한 장에 다 그릴 수 없다.
  // 예전에는 여기서 실패해 프로젝트 전체 검수가 보통 상자 하나로 멈췄다(2026-09-23 도그푸딩).
  // 런타임과 같은 규칙으로 **게임 시작 시점에 켜지는 페이지**(조건이 맞는 마지막 페이지)를 그린다.
  const visual = claimed.visuals.length === 1 ? claimed.visuals[0] : startPageVisual(project, event);
  if (!visual) return { ok: true, sprite: null };
  const worldScale = pixelsPerTile / tileSize;
  const destW = visual.frame.width * worldScale * visual.scale;
  const destH = visual.frame.height * worldScale * visual.scale;
  const feetX = (footprintSpriteX(event.x, visual.footprint, tileSize) - region.x * tileSize) * worldScale;
  const feetY = (characterSpriteY(event.y, tileSize) - region.y * tileSize) * worldScale;
  return {
    ok: true,
    sprite: {
      eventId: event.id,
      priority: visual.priority,
      imageUrl: visual.imageUrl,
      preserveAlpha: visual.preserveAlpha,
      frame: visual.frame,
      destX: feetX - destW * (visual.origin?.x ?? 0.5),
      destY: feetY - destH * (visual.origin?.y ?? 1),
      destW,
      destH,
      groundX: feetX,
      groundY: feetY,
    },
  };
}

function startPageVisual(project: Project, event: GameEvent): ClaimedPageVisual | undefined {
  const start = project.session;
  const page = resolveEventPage(event, {
    switches: start.switches ?? {},
    variables: start.variables ?? {},
    selfSwitches: {},
    inventory: start.inventory ?? {},
    partyActorIds: start.partyActorIds ?? [],
    gold: start.gold ?? 0,
    timers: start.timers ?? {},
  });
  return page ? pageVisual(project, page) ?? undefined : undefined;
}

function pageVisual(project: Project, page: EventPage): ClaimedPageVisual | null {
  const graphic = page.graphic;
  if (!graphic || graphic.transparent === true || !graphic.sprite) return null;
  const resolved = graphicVisual(project, graphic);
  if (!resolved) return null;
  return {
    ...resolved,
    scale: normalizeCharacterScale(graphic.scale) * (resolved.fitScale ?? 1),
    footprint: normalizeCharacterFootprint(page.footprint ?? UNIT_FOOTPRINT),
    priority: page.priority,
  };
}

function claimedPageVisuals(
  project: Project,
  event: GameEvent,
): { readonly ok: true; readonly visuals: readonly ClaimedPageVisual[] } | { readonly ok: false; readonly reason: string } {
  const pages = previewPages(event);
  const byKey = new Map<string, ClaimedPageVisual>();
  for (const page of pages) {
    const graphic = page.graphic;
    if (!graphic || graphic.transparent === true || !graphic.sprite) continue;
    const resolved = graphicVisual(project, graphic);
    if (!resolved) {
      return {
        ok: false,
        reason: `map-event-rendering-unavailable: event ${event.id} graphic ${graphic.sprite.id} is not a supported charset/image for show_map_region; no approval`,
      };
    }
    const visual: ClaimedPageVisual = {
      ...resolved,
      scale: normalizeCharacterScale(graphic.scale) * (resolved.fitScale ?? 1),
      footprint: normalizeCharacterFootprint(page.footprint ?? UNIT_FOOTPRINT),
      priority: page.priority,
    };
    byKey.set(pageVisualKey(visual), visual);
  }
  return { ok: true, visuals: [...byKey.values()] };
}

function previewPages(event: GameEvent): readonly EventPage[] {
  if (event.pages && event.pages.length > 0) return event.pages;
  if (event.sprite) {
    return [{
      id: `${event.id}_legacy`,
      name: event.name ?? event.id,
      conditions: [],
      graphic: { sprite: event.sprite },
      trigger: event.trigger,
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: event.commands,
    }];
  }
  return [];
}

function pageVisualKey(visual: ClaimedPageVisual): string {
  return [
    visual.imageUrl,
    visual.preserveAlpha ? "alpha" : "charset-key",
    visual.frame.x,
    visual.frame.y,
    visual.frame.width,
    visual.frame.height,
    visual.origin?.x ?? 0.5,
    visual.origin?.y ?? 1,
    visual.scale,
    visual.footprint.width,
    visual.footprint.height,
    visual.priority,
  ].join(":");
}

function anchorInRegion(event: GameEvent, region: RegionBox): boolean {
  return event.x >= region.x && event.x < region.x + region.w
    && event.y >= region.y && event.y < region.y + region.h;
}

function graphicVisual(project: Project, graphic: EventPageGraphic): { imageUrl: string; frame: CharsetFrameSource; preserveAlpha?: boolean; fitScale?: number; origin?: SpriteFrameOrigin } | null {
  const id = graphic.sprite?.id;
  if (!id) return null;
  const def = project.assets.sprites[id];
  const iconUrl = resolveCc0IconAssetUrl(id);
  const icon = CC0_ICON_ASSETS.find(asset => asset.id === id);
  if (!def && iconUrl && icon) return { imageUrl: iconUrl,
    frame: {x:0,y:0,width:icon.imageWidth,height:icon.imageHeight}, preserveAlpha:true,
    fitScale:16 / Math.max(icon.imageWidth,icon.imageHeight) };
  const asset = project.assets.uploaded[def?.image.type === "uploaded" ? def.image.id : id];
  if (asset?.kind === "sprite") {
    const frame = uploadedSpriteFrame(asset, graphic.pattern ?? 0);
    const imageUrl = uploadedAssetUrl(asset);
    return frame && imageUrl ? { imageUrl, frame, preserveAlpha: true, origin: spriteFrameOrigin(def) } : null;
  }
  const imageUrl = charsetImageUrl(project, id);
  return imageUrl ? { imageUrl, frame: frameSourceForGraphic(graphic), origin: spriteFrameOrigin(def) } : null;
}

async function loadUnkeyedSpriteImage(url: string): Promise<HTMLImageElement> {
  const image = new Image(); image.src = url; await image.decode(); return image;
}

function frameSourceForGraphic(graphic: EventPageGraphic): CharsetFrameSource {
  if (typeof graphic.pattern === "number") {
    return charsetFrameSource(decodeCharsetFrameIndex(graphic.pattern));
  }
  const direction = isCharsetDirection(graphic.direction) ? graphic.direction : "down";
  return charsetFrameSource({ characterIndex: 0, direction, pattern: 1 });
}

function isCharsetDirection(value: unknown): value is CharsetDirection {
  return value === "down" || value === "left" || value === "right" || value === "up";
}

function charsetImageUrl(project: Project, spriteId: string): string | null {
  const bundled = findCharsetAsset(spriteId);
  if (bundled) return `/${bundled.path}`;
  // SQLite 정본(편집기·호스트)의 업로드는 dataUrl 대신 ref 로 온다 — dataUrl 만 보면 에메랄드 필드 인물이 있는 몬스터 맵 전부에서
  // show_map_region 이 거절됐다(2026-10-06 실편집기 이어 고치기). 읽기는 uploadedAssetUrl 하나로.
  const uploaded = project.assets.uploaded[spriteId];
  if (uploaded?.kind === "charset") { const url = uploadedAssetUrl(uploaded); if (url) return url; }
  const spriteDef = project.assets.sprites[spriteId];
  if (spriteDef?.image.type === "bundled") {
    const nested = findCharsetAsset(spriteDef.image.id);
    if (nested) return `/${nested.path}`;
  }
  if (spriteDef?.image.type === "uploaded") {
    const asset = project.assets.uploaded[spriteDef.image.id];
    const url = asset ? uploadedAssetUrl(asset) : "";
    if (url) return url;
  }
  return null;
}

