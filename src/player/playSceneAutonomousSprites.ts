import {
  charsetIdleFrameIndex,
  charsetWalkFrameIndex,
  charsetWalkStepFromElapsedMs,
  isEasyRpgCharsetTextureKey,
} from "@/player/charsetMotion";
import type { Dir } from "@/player/input";
import type { AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";

export function setNpcWalkFrame(
  sprite: AutonomousNpcSprite | undefined,
  baseFrame: number,
  dir: Dir,
  elapsedMs: number,
  animationType: string,
  animationEnabled: boolean
): void {
  if (!animationEnabled) return;
  if (animationType === "fixedGraphic") return;
  if (!sprite || !isEasyRpgCharsetTextureKey(sprite.texture.key)) return;
  sprite.setFrame(charsetWalkFrameIndex(baseFrame, dir, charsetWalkStepFromElapsedMs(elapsedMs)));
}

export function setNpcIdleFrame(
  sprite: AutonomousNpcSprite | undefined,
  baseFrame: number,
  dir: Dir,
  animationType: string,
  animationEnabled: boolean
): void {
  if (!animationEnabled) return;
  if (animationType === "fixedGraphic") return;
  if (!sprite) return;
  if (isEasyRpgCharsetTextureKey(sprite.texture.key)) sprite.setFrame(charsetIdleFrameIndex(baseFrame, dir));
}

export function applySpriteAlpha(sprite: AutonomousNpcSprite | undefined, opacity: number): void {
  if (!sprite) return;
  sprite.setAlpha(opacity / 255);
}
