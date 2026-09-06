// 48px 영웅 전투 시트의 **고해상도 짝** 카탈로그(2026-09-03).
//
// 몬스터 배틀러는 384px 원본이 필드에서 밀도 1.6 으로 보이는데, 영웅은 48px 셀을 2배로 그려 0.5 였다.
// `scripts/asset-gen/gen-battler-hires-sheets.mjs` 가 xBR 로 4배(192px 셀) 키운 시트를 `starter/hires/`
// 아래에 원본과 같은 파일명으로 둔다. 화면 크기는 그대로다 — 스프라이트의 background-size 는 논리 px 로
// 고정돼 있어(`battleFieldDom.actorBattleImage`) 시트 해상도와 무관하게 96 논리 px 셀로 그려진다.
//
// 이 카탈로그가 유일한 정본이다. 등록되지 않은 시트(사용자 저작 48px 캐릭터셋)는 지금까지처럼
// 원본을 pixelated 로 그린다 — 옵트인이라 줄만 늘리면 된다(idle 스트립 카탈로그와 같은 규약).
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

const HERO_SHEETS: readonly BattlerHiresSheet[] = [1, 2, 3, 4, 5, 6].map((index) => ({
  resourceId: `generated-actor-hero-0${index}-battle`,
  path: `assets/generated/starter/hires/hero-0${index}-battle.png`,
  cellWidth: BATTLER_HIRES_CELL,
  cellHeight: BATTLER_HIRES_CELL,
}));

/** 레거시 별칭 `hero` 는 리졸버가 hero-01 시트로 보낸다 — 여기서도 같은 짝을 준다. */
export const BATTLER_HIRES_SHEETS: readonly BattlerHiresSheet[] = [
  ...HERO_SHEETS,
  { ...HERO_SHEETS[0]!, resourceId: "hero" },
];

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
