import { spriteFrameOrigin, type SpriteFrameOrigin } from "@/project/spriteFrameAnchor";
import { BUNDLED_EASYRPG_CHARSET_ASSETS } from "@/assets/bundled";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { resolveCc0IconAssetUrl } from "@/assets/cc0IconAssets";
import { isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import type { Project } from "@/project/types";
import type { Dir } from "@/player/input";
import { charsetIdleFrameIndex, isCharsetLikeTextureKey } from "@/player/charsetMotion";
import { CHARSET_FRAME_WIDTH } from "@/assets/easyrpgRtp";
import { DERIVED_FIELD_FOE_BASE_FRAME, ensureDerivedFieldFoeTexture } from "@/player/fieldFoeSprite";
import { characterRenderScale } from "@/project/characterScale";
import { normalizeCharacterScale } from "@/project/footprint";
import type { EventPageGraphic } from "@/project/types";

export type EventSpriteTexture = {
  readonly texture: string;
  readonly frame: string | number;
  readonly charset?: boolean;
  readonly origin?: SpriteFrameOrigin;
  /** Static battler art is fitted to a field-sized box before authored scale. */
  readonly fitSize?: number;
  /** Battle dot art standing in for a field enemy: the scene may swap it for a derived walking sheet (fieldFoeSprite.ts). */
  readonly monster?: boolean;
  /** Walking sheet derived from battle art: charset frames, scaled like a 24px walking chip. */
  readonly derived?: boolean;
};

/** Spatial overlay graphics may use catalog picture/charset ids. Event sprites stay on resolveEventSpriteTexture. */
export function resolveSpatialGraphicTexture(
  project: Project,
  resourceId: string,
): EventSpriteTexture | null {
  const existing = resolveEventSpriteTexture(project, resourceId, 0);
  if (existing) return existing;
  if (EASYRPG_PICTURE_ASSETS.some((asset) => asset.id === resourceId)) {
    return { texture: resourceId, frame: "__BASE" };
  }
  const charset = CHARSET_ASSETS.find((asset) => asset.id === resourceId);
  if (charset) return { texture: charset.textureKey, frame: 0 };
  return null;
}

export function resolveEventSpriteTexture(
  project: Project,
  spriteId: string,
  pattern: string | number | undefined
): EventSpriteTexture | null {
  const frame = pattern ?? 0;
  const spriteDef = project.assets.sprites[spriteId];
  const origin = spriteFrameOrigin(spriteDef);
  const anchored = origin ? { origin } : {};
  const uploadedCharsetDefinition = spriteDef?.image.type === "uploaded"
    && project.assets.uploaded[spriteDef.image.id]?.kind === "charset";
  if (spriteDef?.image.type === "bundled") {
    return { texture: spriteDef.image.id, frame, ...anchored };
  }
  if (spriteDef) return { texture: spriteId, frame, ...anchored, ...(uploadedCharsetDefinition ? { charset: true } : {}) };

  // Existing item pictures can depict a real investigation object. They are
  // static images, so a charset frame number must never crop them.
  if (resolveCc0IconAssetUrl(spriteId)) return { texture: spriteId, frame: '__BASE', fitSize: 16 };

  const uploadedKind = project.assets.uploaded[spriteId]?.kind;
  if (uploadedKind === "monster") return { texture: spriteId, frame: "__BASE", fitSize: 32, monster: true };
  if (uploadedKind === "charset") return { texture: spriteId, frame, charset: true };
  if (isSpriteLikeUpload(uploadedKind)) return { texture: spriteId, frame };
  const charset = findCharsetAsset(spriteId);
  if (charset) return { texture: charset.textureKey, frame };
  if (isBundledCharsetTexture(spriteId)) return { texture: spriteId, frame };

  const bundledSprite = Object.values(project.assets.sprites).find(
    (sprite) => sprite.image.type === "bundled" && sprite.image.id === spriteId
  );
  if (bundledSprite) {
    const base = spriteFrameOrigin(bundledSprite);
    return { texture: spriteId, frame, ...(base ? { origin: base } : {}) };
  }
  if (!uploadedKind && isGeneratedMonsterSprite(spriteId)) return { texture: spriteId, frame: "__BASE", fitSize: 32, monster: true };
  return null;
}

/**
 * Field-enemy battle art → derived walking sheet (about 2 tiles, facing, step, shadow, outline + light rim).
 * Explicit charsets never reach here, so a hand-dotted field chip always wins. Falls back to the static battler
 * when the source texture is not loaded yet or its pixels cannot be read.
 */
export function withDerivedFieldFoe(
  scene: Parameters<typeof ensureDerivedFieldFoeTexture>[0],
  texture: EventSpriteTexture | null,
): EventSpriteTexture | null {
  if (!texture?.monster) return texture;
  const key = ensureDerivedFieldFoeTexture(scene, texture.texture);
  return key ? { texture: key, frame: DERIVED_FIELD_FOE_BASE_FRAME, charset: true, derived: true } : texture;
}

export function isCharsetSpriteTexture(texture: EventSpriteTexture | null): boolean {
  return !!texture && (texture.charset === true || !!findCharsetAsset(texture.texture));
}

export function eventSpriteScale(
  texture: EventSpriteTexture | null,
  sprite: { readonly width?: number; readonly height?: number },
  authoredScale?: number,
  tileSize = 16,
  scaleMode?: EventPageGraphic["scaleMode"],
  referenceTileSize = tileSize,
  /** 맵 캐릭터 크기 배율(mapCharacterSizeFactor) — 캐릭터 칩에만 곱한다. 상자·그림 이벤트는 칸 크기 그대로. */
  mapCharacterFactor = 1,
): number {
  if (isCharsetSpriteTexture(texture)) {
    // Derived field-foe frames are wider than a 24px chip but must scale exactly like one (never shrink, same on 48px maps).
    return characterRenderScale(texture?.derived ? CHARSET_FRAME_WIDTH : sprite.width, tileSize, { scale: authoredScale, scaleMode }, referenceTileSize) * mapCharacterFactor;
  }
  const scale = normalizeCharacterScale(authoredScale);
  if (!texture?.fitSize) return scale;
  const size = Math.max(sprite.width ?? 0, sprite.height ?? 0);
  return Number.isFinite(size) && size > 0 ? scale * texture.fitSize / size : scale;
}

export function setEventSpritePattern(
  project: Project,
  sprite: { readonly texture: { readonly key: string }; setFrame(frame: string | number): unknown } | undefined,
  pattern: number,
): void {
  if (sprite) sprite.setFrame(resolveEventSpriteTexture(project, sprite.texture.key, pattern)?.frame ?? pattern);
}

export function eventSpriteFrameForDirection(
  texture: EventSpriteTexture | null,
  direction: Dir | undefined
): string | number | undefined {
  if (!texture) return undefined;
  if (!direction) return texture.frame;
  if (typeof texture.frame !== "number") return texture.frame;
  if (!texture.charset && !isCharsetLikeTextureKey(texture.texture)) return texture.frame;
  return charsetIdleFrameIndex(texture.frame, direction);
}

function isSpriteLikeUpload(kind: string | undefined): boolean {
  return kind === "sprite" || kind === "charset" || kind === "battleCharset" || kind === "monster";
}

function isBundledCharsetTexture(spriteId: string): boolean {
  return BUNDLED_EASYRPG_CHARSET_ASSETS.some((asset) => asset.textureKey === spriteId);
}
