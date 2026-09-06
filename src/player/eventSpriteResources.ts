import { BUNDLED_EASYRPG_CHARSET_ASSETS } from "@/assets/bundled";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import type { Project } from "@/project/types";
import type { Dir } from "@/player/input";
import { charsetIdleFrameIndex, isEasyRpgCharsetTextureKey } from "@/player/charsetMotion";

export type EventSpriteTexture = {
  readonly texture: string;
  readonly frame: string | number;
  /** Static battler art is fitted to a field-sized box before authored scale. */
  readonly fitSize?: number;
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
  if (spriteDef?.image.type === "bundled") {
    return { texture: spriteDef.image.id, frame };
  }
  if (spriteDef) return { texture: spriteId, frame };

  const uploadedKind = project.assets.uploaded[spriteId]?.kind;
  if (isSpriteLikeUpload(uploadedKind)) return { texture: spriteId, frame };
  if (isBundledCharsetTexture(spriteId)) return { texture: spriteId, frame };

  const bundledSprite = Object.values(project.assets.sprites).find(
    (sprite) => sprite.image.type === "bundled" && sprite.image.id === spriteId
  );
  if (bundledSprite) return { texture: spriteId, frame };
  if (!uploadedKind && isGeneratedMonsterSprite(spriteId)) return { texture: spriteId, frame: "__BASE", fitSize: 32 };
  return null;
}

export function eventSpriteScale(
  texture: EventSpriteTexture | null,
  sprite: { readonly width?: number; readonly height?: number },
  authoredScale: number,
): number {
  if (!texture?.fitSize) return authoredScale;
  const size = Math.max(sprite.width ?? 0, sprite.height ?? 0);
  return Number.isFinite(size) && size > 0 ? authoredScale * texture.fitSize / size : authoredScale;
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
  if (!isEasyRpgCharsetTextureKey(texture.texture)) return texture.frame;
  return charsetIdleFrameIndex(texture.frame, direction);
}

function isSpriteLikeUpload(kind: string | undefined): boolean {
  return kind === "sprite" || kind === "charset" || kind === "battleCharset" || kind === "monster";
}

function isBundledCharsetTexture(spriteId: string): boolean {
  return BUNDLED_EASYRPG_CHARSET_ASSETS.some((asset) => asset.textureKey === spriteId);
}
