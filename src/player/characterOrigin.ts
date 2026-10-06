import type { SpriteFrameOrigin } from "@/project/spriteFrameAnchor";

const origins = new WeakMap<object, SpriteFrameOrigin>();
const DEFAULT_ORIGIN: SpriteFrameOrigin = Object.freeze({ x: 0.5, y: 1 });

/** Keep the authored ground anchor separate from temporary hop/pose offsets. */
export function setCharacterBaseOrigin(sprite: object, origin: SpriteFrameOrigin | undefined): void {
  if (origin) origins.set(sprite, origin);
  else origins.delete(sprite);
}

export function characterBaseOrigin(sprite: object): SpriteFrameOrigin {
  return origins.get(sprite) ?? DEFAULT_ORIGIN;
}
