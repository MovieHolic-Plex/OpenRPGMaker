// 절차적으로 생성한 전투 이펙트 시트 등록.
//
// 아트는 `scripts/gen-effect-sheets.mjs` 가 이 카탈로그를 읽어 렌더한다(384x384 프레임을
// 이펙트 용도에 따라 8~12장 가로 스트립으로 구성, `sheet.assetScale` 0.5 로 무대에서 192 논리 px).
// 카탈로그가 유일한 정본이라 생성기·리소스 해석·기본 DB 레코드가 같은 slug 목록을 본다 —
// 한쪽만 늘어나면 test/generatedEffectSheets.test.ts 가 깨진다.
//
// 왜 절차 생성인가: 프레임 간 연속성이 이펙트의 전부다. 이미지 생성 모델은 프레임마다
// 실루엣을 다시 상상해서 스트립이 튄다. 여기서는 프레임 진행도 p 를 수식에 넣어 그린다.
//
// 왜 384px 인가(2026-09-03): 몬스터 배틀러 원본이 384px 이고 필드에서 약 200 논리 px 로 보인다.
// 예전 96px(48 격자 2배 복제) 시트는 화면에서 한 픽셀이 4 CSS px 로 몬스터의 1/10 밀도였다.

import type { BattleAnimationPosition, BattleAnimationScope, BattleAnimationSheet } from "@/project/types/database";
import catalogInput from "./generatedEffectSheets.json" with { type: "json" };

export type GeneratedEffectFlashSeed = {
  readonly frameIndex: number;
  readonly target: "target" | "screen";
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly durationFrames: number;
};

export type GeneratedEffectSoundSeed = {
  readonly frameIndex: number;
  readonly resourceId: string;
};

export type GeneratedEffectShakeSeed = {
  readonly frameIndex: number;
  readonly power: number;
  readonly speed: number;
  readonly durationFrames: number;
};

export type GeneratedEffectSheetSeed = {
  readonly slug: string;
  readonly name: string;
  readonly frameCount: number;
  readonly tags: readonly string[];
  readonly scope: BattleAnimationScope;
  readonly position: BattleAnimationPosition;
  /** 기본 레코드 셀의 zoom(%). 전체화면(screen) 이펙트는 200 으로 무대 384 논리 px 를 덮는다. 없으면 100. */
  readonly cellZoom?: number;
  readonly sound: GeneratedEffectSoundSeed;
  readonly flash?: GeneratedEffectFlashSeed;
  readonly shake?: GeneratedEffectShakeSeed;
};

export type GeneratedEffectSheetCatalog = {
  readonly sheet: {
    readonly frameWidth: number;
    readonly frameHeight: number;
    readonly frameDurationMs: number;
    /** 시트 1px → 전투 논리 px. `BattleAnimationSheet.assetScale` 로 그대로 실린다. */
    readonly assetScale: number;
  };
  readonly effects: readonly GeneratedEffectSheetSeed[];
};

const catalog = catalogInput as GeneratedEffectSheetCatalog;

/** 모든 생성 이펙트가 공유하는 셀 크기와 재생 간격. 열 수는 각 seed.frameCount 가 소유한다. */
export const GENERATED_EFFECT_SHEET = catalog.sheet;

export const GENERATED_EFFECT_SHEETS: readonly GeneratedEffectSheetSeed[] = catalog.effects;

const ASSET_DIR = "assets/generated/effects";

export function generatedEffectResourceId(slug: string): string {
  return `generated-battle-anim-${slug}`;
}

export function generatedEffectSheet(seed: GeneratedEffectSheetSeed): BattleAnimationSheet {
  return {
    frameWidth: GENERATED_EFFECT_SHEET.frameWidth,
    frameHeight: GENERATED_EFFECT_SHEET.frameHeight,
    columns: seed.frameCount,
    assetScale: GENERATED_EFFECT_SHEET.assetScale,
  };
}

/** 기본 레코드 셀 zoom(%). 카탈로그가 정하고, 없으면 RM 기본 100. */
export function generatedEffectCellZoom(seed: GeneratedEffectSheetSeed): number {
  return seed.cellZoom ?? 100;
}

/** 번들 생성 이펙트만 전용 75ms 프레임 간격을 쓴다. 다른 저작 애니메이션은 기존 120ms다. */
export function generatedEffectFrameDurationMs(resourceId: string | undefined): number | undefined {
  if (!resourceId?.startsWith("generated-battle-anim-")) return undefined;
  const slug = resourceId.slice("generated-battle-anim-".length);
  return GENERATED_EFFECT_SHEETS.some((effect) => effect.slug === slug)
    ? GENERATED_EFFECT_SHEET.frameDurationMs
    : undefined;
}

export function generatedEffectAnimationId(slug: string): string {
  return `anim_gen_${slug.replaceAll("-", "_")}`;
}

const GENERATED_EFFECT_ANIMATION_ID_ALIASES: Readonly<Record<string, string>> = {
  "arcane-nova": "anim_magic",
  "heal-bloom": "anim_heal",
  "poison-mist": "anim_poison",
};

/** Stable database id, including the three legacy ids retained for existing skill references. */
export function generatedEffectDatabaseAnimationId(slug: string): string {
  return GENERATED_EFFECT_ANIMATION_ID_ALIASES[slug] ?? generatedEffectAnimationId(slug);
}

export function generatedEffectSheetFileName(slug: string): string {
  return `effect-${slug}.png`;
}

export type GeneratedEffectSheetAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly tags: readonly string[];
};

export const GENERATED_EFFECT_SHEET_ASSETS: readonly GeneratedEffectSheetAsset[] = GENERATED_EFFECT_SHEETS.map(
  (effect) => ({
    id: generatedEffectResourceId(effect.slug),
    name: `${effect.name} 이펙트`,
    path: `${ASSET_DIR}/${generatedEffectSheetFileName(effect.slug)}`,
    tags: [...effect.tags],
  })
);

/** 프로젝트 직렬화 참조 검증(collectResourceIds)에 등록할 리소스 ID 목록. */
export const GENERATED_EFFECT_RESOURCE_IDS: readonly string[] = GENERATED_EFFECT_SHEET_ASSETS.map((asset) => asset.id);

export function resolveGeneratedEffectAssetUrl(resourceId: string): string | null {
  const asset = GENERATED_EFFECT_SHEET_ASSETS.find((entry) => entry.id === resourceId);
  return asset === undefined ? null : `/${asset.path}`;
}
