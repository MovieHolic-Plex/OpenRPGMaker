import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import {
  charsetFrameIndex,
  decodeCharsetFrameIndex,
  type CharsetDirection,
} from "@/assets/easyrpgRtp";

export const NPC_MOVE_DURATION_MS = 320;
export const NPC_WALK_FRAME_MS = 80;

const WALK_PATTERNS = [0, 1, 2, 1] as const;

export function isEasyRpgCharsetTextureKey(textureKey: string): boolean {
  return CHARSET_ASSETS.some((asset) => asset.textureKey === textureKey);
}

export function charsetWalkFrameIndex(
  baseFrameIndex: number,
  direction: CharsetDirection,
  walkStep: number
): number {
  const base = decodeCharsetFrameIndex(baseFrameIndex);
  return charsetFrameIndex({
    characterIndex: base.characterIndex,
    direction,
    pattern: WALK_PATTERNS[walkPatternIndex(walkStep)],
  });
}

export function charsetIdleFrameIndex(
  baseFrameIndex: number,
  direction: CharsetDirection
): number {
  const base = decodeCharsetFrameIndex(baseFrameIndex);
  return charsetFrameIndex({
    characterIndex: base.characterIndex,
    direction,
    pattern: 1,
  });
}

export function charsetWalkStepFromElapsedMs(elapsedMs: number, frameMs = NPC_WALK_FRAME_MS): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  const cadence = Number.isFinite(frameMs) && frameMs >= 50 && frameMs <= 1000 ? frameMs : NPC_WALK_FRAME_MS;
  return Math.floor(Math.max(0, elapsedMs) / cadence);
}

function walkPatternIndex(walkStep: number): number {
  if (!Number.isFinite(walkStep)) return 0;
  const index = Math.trunc(walkStep) % WALK_PATTERNS.length;
  return index < 0 ? index + WALK_PATTERNS.length : index;
}
