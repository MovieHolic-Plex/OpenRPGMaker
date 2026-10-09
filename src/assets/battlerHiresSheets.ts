// Optional high resolution battler companions. No starter sheets are bundled.
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";
import { withInlineAsset } from "@/assets/inlineAssetStore";

export type BattlerHiresSheet = {
  /** 원본 시트의 리소스 id(`generated-actor-hero-0N-battle`). 이 id 로 조회한다. */
  readonly resourceId: string;
  /** public 기준 경로(선행 슬래시 없음). */
  readonly path: string;
  /** 고해상도 셀 크기(px). 원본 48 × 배율. */
  readonly cellWidth: number;
  readonly cellHeight: number;
};

export const BATTLER_HIRES_CELL = 192;
export const BATTLER_HIRES_FACTOR = BATTLER_HIRES_CELL / 48;

// The bundled starter sheets were removed on 2026-10-03.
export const BATTLER_HIRES_SHEETS: readonly BattlerHiresSheet[] = [];

export function battlerHiresSheet(resourceId: string | undefined): BattlerHiresSheet | undefined {
  if (!resourceId) return undefined;
  return BATTLER_HIRES_SHEETS.find((entry) => entry.resourceId === resourceId);
}

export function battlerHiresSheetUrl(entry: BattlerHiresSheet): string {
  return withInlineAsset(`/${entry.path}`);
}

/**
 * 시트 1px 이 차지하는 전투 논리 px. 원본 48px 셀은 2(320 시대 자산), 고해상도 192px 셀은 0.5.
 * 셀의 화면 크기(48 × 2 = 96 논리 px)는 두 경우 모두 같다.
 */
export function battlerSheetAssetScale(entry: BattlerHiresSheet | undefined): number {
  return entry ? (48 * BATTLE_ASSET_PIXEL_SCALE) / entry.cellWidth : BATTLE_ASSET_PIXEL_SCALE;
}
