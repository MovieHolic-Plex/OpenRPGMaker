import { mapTileSize } from "@/project/tileGeometry";
import { findCharsetAsset } from "@/assets/charsetCatalog";
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
  readonly frame: CharsetFrameSource;
  /** Destination top-left in region canvas pixels (origin feet at bottom-center). */
  readonly destX: number;
  readonly destY: number;
  readonly destW: number;
  readonly destH: number;
};

export type RegionEventSpritesResult =
  | { readonly ok: true; readonly sprites: readonly RegionEventSprite[] }
  | { readonly ok: false; readonly reason: string };

type RegionBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

type ClaimedPageVisual = {
  readonly imageUrl: string;
  readonly frame: CharsetFrameSource;
  readonly scale: number;
  readonly footprint: CharacterFootprint;
  readonly priority: EventPriority;
};

const PRIORITY_ORDER: Record<EventPriority, number> = { below: 0, same: 1, above: 2 };
/**
 * Map events inside a show_map_region clip, using only canonical charset/uploaded graphics.
 * Every page graphic is a claimed visual (same contract as mapVisualContent). Unsupported or
 * multi-variant page states fail closed — never silently pick page[0] as full coverage.
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
    return a.destY - b.destY || a.destX - b.destX || a.eventId.localeCompare(b.eventId);
  });
  return { ok: true, sprites };
}

export async function drawRegionEventSprites(
  context: CanvasRenderingContext2D,
  sprites: readonly RegionEventSprite[],
): Promise<void> {
  for (const sprite of sprites) {
    const image = await loadKeyedCharsetImage(sprite.imageUrl);
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
  if (claimed.visuals.length > 1) {
    return {
      ok: false,
      reason: `map-event-rendering-unavailable: event ${event.id} has ${claimed.visuals.length} distinct page graphics/priorities/footprints; show_map_region cannot represent conditional page states in one frame; no approval`,
    };
  }
  const visual = claimed.visuals[0];
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
      frame: visual.frame,
      destX: feetX - destW / 2,
      destY: feetY - destH,
      destW,
      destH,
    },
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
    const imageUrl = charsetImageUrl(project, graphic.sprite.id);
    if (!imageUrl) {
      return {
        ok: false,
        reason: `map-event-rendering-unavailable: event ${event.id} graphic ${graphic.sprite.id} is not a supported charset/image for show_map_region; no approval`,
      };
    }
    const visual: ClaimedPageVisual = {
      imageUrl,
      frame: frameSourceForGraphic(graphic),
      scale: normalizeCharacterScale(graphic.scale),
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
    visual.frame.x,
    visual.frame.y,
    visual.frame.width,
    visual.frame.height,
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
  const uploaded = project.assets.uploaded[spriteId];
  if (uploaded?.kind === "charset" && uploaded.dataUrl) return uploaded.dataUrl;
  const spriteDef = project.assets.sprites[spriteId];
  if (spriteDef?.image.type === "bundled") {
    const nested = findCharsetAsset(spriteDef.image.id);
    if (nested) return `/${nested.path}`;
  }
  if (spriteDef?.image.type === "uploaded") {
    const dataUrl = project.assets.uploaded[spriteDef.image.id]?.dataUrl;
    if (dataUrl) return dataUrl;
  }
  return null;
}

