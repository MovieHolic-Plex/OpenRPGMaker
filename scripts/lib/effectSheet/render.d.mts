// render.mjs 의 공개 API 타입. 테스트(test/generatedEffectSheets.test.ts)가 이 모듈을
// 타입 안전하게 import 하도록 둔다 — 선언이 없으면 TS7016 으로 타입체크가 시끄러워진다.

export type EffectSheetCatalog = {
  readonly sheet: { readonly frameWidth: number; readonly frameHeight: number; readonly frameDurationMs: number };
  readonly effects: readonly {
    readonly slug: string;
    readonly name: string;
    readonly frameCount: number;
    readonly sound: { readonly frameIndex: number; readonly resourceId: string };
  }[];
};

export type EffectStrip = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
};

export const REPO_ROOT: string;
export const CATALOG_PATH: string;
export const OUTPUT_DIR: string;

export function loadEffectCatalog(): EffectSheetCatalog;
export function effectSheetFileName(slug: string): string;
export function effectSheetOutputPath(slug: string): string;
export function renderEffectStrip(slug: string, catalog?: EffectSheetCatalog): EffectStrip;
export function renderEffectSheetPng(slug: string, catalog?: EffectSheetCatalog): Uint8Array;
export function paintedEffectSlugs(): string[];
