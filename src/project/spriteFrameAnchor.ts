import type { SpriteDef } from "./types";

export type SpriteFrameOrigin = { readonly x: number; readonly y: number };

/** Convert authored source pixels once; scale and world position remain independent. */
export function spriteFrameOrigin(sprite: SpriteDef | undefined): SpriteFrameOrigin | undefined {
  const anchor = sprite?.anchor;
  if (!sprite || !anchor) return undefined;
  if (![anchor.x, anchor.y, sprite.frameWidth, sprite.frameHeight].every(Number.isFinite)
    || sprite.frameWidth <= 0 || sprite.frameHeight <= 0
    || anchor.x < 0 || anchor.x > sprite.frameWidth || anchor.y < 0 || anchor.y > sprite.frameHeight) return undefined;
  return { x: anchor.x / sprite.frameWidth, y: anchor.y / sprite.frameHeight };
}
