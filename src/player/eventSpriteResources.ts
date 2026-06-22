import { BUNDLED_EASYRPG_CHARSET_ASSETS } from "@/assets/bundled";
import type { Project } from "@/project/types";

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

function isSpriteLikeUpload(kind: string | undefined): boolean {
  return kind === "sprite" || kind === "charset" || kind === "battleCharset" || kind === "monster";
}

function isBundledCharsetTexture(spriteId: string): boolean {
  return BUNDLED_EASYRPG_CHARSET_ASSETS.some((asset) => asset.textureKey === spriteId);
}
