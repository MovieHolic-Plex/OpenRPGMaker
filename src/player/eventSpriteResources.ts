import { BUNDLED_EASYRPG_CHARSET_ASSETS } from "@/assets/bundled";
import type { Project } from "@/project/types";
import type { Dir } from "@/player/input";
import { charsetIdleFrameIndex, isEasyRpgCharsetTextureKey } from "@/player/charsetMotion";

export type EventSpriteTexture = {
  readonly texture: string;
  readonly frame: string | number;
};

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
  return bundledSprite ? { texture: spriteId, frame } : null;
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
