import { TILE_SIZE } from "@/assets/bundled";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import {
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetFrameSource,
  type CharsetDirection,
} from "@/assets/easyrpgRtp";
import {
  applyTransparentColorKey,
  applyTransparentColorKeys,
  STANDARD_COLOR_KEYS,
} from "@/assets/transparentColorKey";
import { characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import {
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  UNIT_FOOTPRINT,
} from "@/project/footprint";
import type {
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

const PRIORITY_ORDER: Record<EventPriority, number> = { below: 0, same: 1, above: 2 };
const charsetImagePromises = new Map<string, Promise<HTMLImageElement>>();

/**
 * Map events inside a show_map_region clip, using only canonical charset/uploaded graphics.
 * Unsupported claimed graphics fail closed — never silently omit into a tile-only proof.
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
    const resolved = resolveEventSprite(project, event, region, pixelsPerTile);
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
    const image = await loadCharsetImage(sprite.imageUrl);
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
  charsetImagePromises.clear();
}

function resolveEventSprite(
  project: Project,
  event: GameEvent,
  region: RegionBox,
  pixelsPerTile: number,
): { readonly ok: true; readonly sprite: RegionEventSprite | null } | { readonly ok: false; readonly reason: string } {
  const page = previewPage(event);
  const graphic = page?.graphic ?? (event.sprite ? { sprite: event.sprite } : undefined);
  if (!graphic || graphic.transparent === true || !graphic.sprite) {
    return { ok: true, sprite: null };
  }
  const imageUrl = charsetImageUrl(project, graphic.sprite.id);
  if (!imageUrl) {
    return {
      ok: false,
      reason: `map-event-rendering-unavailable: event ${event.id} graphic ${graphic.sprite.id} is not a supported charset/image for show_map_region; no approval`,
    };
  }
  const footprint = normalizeCharacterFootprint(page?.footprint ?? UNIT_FOOTPRINT);
  const scale = normalizeCharacterScale(graphic.scale);
  const frame = frameSourceForGraphic(graphic);
  const worldScale = pixelsPerTile / TILE_SIZE;
  const destW = frame.width * worldScale * scale;
  const destH = frame.height * worldScale * scale;
  const feetX = (footprintSpriteX(event.x, footprint) - region.x * TILE_SIZE) * worldScale;
  const feetY = (characterSpriteY(event.y) - region.y * TILE_SIZE) * worldScale;
  return {
    ok: true,
    sprite: {
      eventId: event.id,
      priority: page?.priority ?? "same",
      imageUrl,
      frame,
      destX: feetX - destW / 2,
      destY: feetY - destH,
      destW,
      destH,
    },
  };
}

function previewPage(event: GameEvent): EventPage | undefined {
  return event.pages?.[0];
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

function loadCharsetImage(url: string): Promise<HTMLImageElement> {
  const existing = charsetImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      void keyOutCharsetImage(image).then(resolve, reject);
    };
    image.onerror = () => reject(new Error(`charset image failed to load: ${url}`));
    image.src = url;
  });
  charsetImagePromises.set(url, promise);
  promise.catch(() => charsetImagePromises.delete(url));
  return promise;
}

async function keyOutCharsetImage(source: HTMLImageElement): Promise<HTMLImageElement> {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (width <= 0 || height <= 0) return source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  applyTransparentColorKey(imageData.data);
  applyTransparentColorKeys(imageData.data, STANDARD_COLOR_KEYS);
  context.putImageData(imageData, 0, 0);
  const keyed = new Image();
  await new Promise<void>((resolve, reject) => {
    keyed.onload = () => resolve();
    keyed.onerror = () => reject(new Error("keyed charset image failed"));
    keyed.src = canvas.toDataURL("image/png");
  });
  return keyed;
}
