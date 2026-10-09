import type { BattleAnimationSheet } from "@/project/types";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";

export {
  BATTLE_ANIMATION_FRAME_MS,
  DEFAULT_BATTLE_ANIMATION_DURATION_MS,
  battleAnimationChainDurationMs,
  battleAnimationDurationMs,
  battleAnimationFrameDurationMs,
} from "@/battle/animationTiming";

/**
 * 시트 1px → 전투 논리 px. 레코드가 값을 안 들고 있으면 320 시대 자산(2)이다.
 * 정규화 뒤에는 항상 채워져 있지만, 미정규화 레코드(테스트·구 픽스처)도 같은 답을 내야 한다.
 */
export function battleAnimationSheetAssetScale(sheet: BattleAnimationSheet | undefined): number {
  const value = sheet?.assetScale;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : BATTLE_ASSET_PIXEL_SCALE;
}

/**
 * 시트 1px → RM px(320×240 시대 좌표). 편집기 미리보기와 맵 `showAnimation` 은 이 좌표계로
 * 그린다 — 96px 레거시 시트가 96 CSS px / 96 맵 px 로 보이는 지금의 관례가 그것이다.
 * 레거시 1, 384px 고해상도 시트 0.25.
 */
export function battleAnimationSheetRmScale(sheet: BattleAnimationSheet | undefined): number {
  return battleAnimationSheetAssetScale(sheet) / BATTLE_ASSET_PIXEL_SCALE;
}

export type BattleAnimationSheetRendering = "pixelated" | "smooth";

/**
 * 확대해 그리는 시트(픽셀아트)만 최근접 보간, 축소해 그리는 시트는 보간을 켠다.
 * 384px 시트를 pixelated 로 축소하면 가장자리가 계단으로 깨진다(실측).
 */
export function battleAnimationSheetRendering(sheet: BattleAnimationSheet | undefined): BattleAnimationSheetRendering {
  return battleAnimationSheetAssetScale(sheet) >= 1 ? "pixelated" : "smooth";
}
