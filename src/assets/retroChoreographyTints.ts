// 스킬 연출 레코드의 「색」 손잡이 — 속성 팔레트 프리셋과 CSS filter 변환. 순수 모듈(DOM 을 모른다).
//
// 픽셀 아트라 색을 픽셀 단위로 바꾸지 않고 시트 요소에 CSS filter 를 건다(번지지 않는다).
// 모든 프리셋은 같은 처방 `grayscale(1) sepia(1) hue-rotate(H) saturate(S) brightness(B) contrast(C)` 를 쓴다 —
// 먼저 원본 색을 밝기만 남겨 갈색 단색(sepia, 색상각 약 38°)으로 만든 뒤 목표 색상각으로 돌린다.
// 그래서 어떤 원본 시트에 걸어도 같은 속성색이 나오고, 값은 실제 시트 여러 장에 걸어 눈으로 보고 골랐다
// (verify-shots/retro-choreo-b/ 의 tint-sheet).

export const RETRO_TINT_ORIGINAL = "original";

export interface RetroTintPreset {
  readonly id: string;
  readonly label: string;
  /** 칩 견본색. */
  readonly swatch: string;
  /** CSS filter 값. */
  readonly filter: string;
}

/** 속성 팔레트. 순서가 편집기 칩 순서다. */
export const RETRO_TINT_PRESETS: readonly RetroTintPreset[] = [
  { id: "fire", label: "불", swatch: "#f0561c", filter: "grayscale(1) sepia(1) hue-rotate(-24deg) saturate(4.2) brightness(1.08) contrast(1.05)" },
  { id: "ice", label: "얼음", swatch: "#6fd0ff", filter: "grayscale(1) sepia(1) hue-rotate(148deg) saturate(3.4) brightness(1.12) contrast(1.02)" },
  { id: "thunder", label: "번개", swatch: "#ffe23a", filter: "grayscale(1) sepia(1) hue-rotate(6deg) saturate(4.6) brightness(1.15) contrast(1.05)" },
  { id: "water", label: "물", swatch: "#2f7bff", filter: "grayscale(1) sepia(1) hue-rotate(172deg) saturate(3.6) brightness(1.05) contrast(1.02)" },
  { id: "wind", label: "바람", swatch: "#8fe8b0", filter: "grayscale(1) sepia(1) hue-rotate(96deg) saturate(2.6) brightness(1.1) contrast(1.0)" },
  { id: "earth", label: "대지", swatch: "#a7793f", filter: "grayscale(1) sepia(1) hue-rotate(-6deg) saturate(1.7) brightness(0.88) contrast(1.1)" },
  { id: "holy", label: "신성", swatch: "#fff3b0", filter: "grayscale(1) sepia(1) hue-rotate(8deg) saturate(1.8) brightness(1.5) contrast(0.95)" },
  { id: "dark", label: "암흑", swatch: "#5a2d8f", filter: "grayscale(1) sepia(1) hue-rotate(238deg) saturate(2.4) brightness(0.72) contrast(1.25)" },
  { id: "poison", label: "독", swatch: "#78d21e", filter: "grayscale(1) sepia(1) hue-rotate(58deg) saturate(3.6) brightness(1.0) contrast(1.08)" },
];

const PRESET_BY_ID: ReadonlyMap<string, RetroTintPreset> = new Map(RETRO_TINT_PRESETS.map((preset) => [preset.id, preset]));
const HEX = /^#[0-9a-f]{6}$/;

/** 「original」·프리셋 id·#rrggbb 중 하나인가(저장 정규화가 쓴다). */
export function isRetroTintValue(value: unknown): value is string {
  return typeof value === "string" && (value === RETRO_TINT_ORIGINAL || PRESET_BY_ID.has(value) || HEX.test(value));
}

export function retroTintPreset(id: string | undefined): RetroTintPreset | undefined {
  return id === undefined ? undefined : PRESET_BY_ID.get(id);
}

/** #rrggbb → 같은 처방의 filter. 밝기·채도는 색에서 읽는다. */
function hexFilter(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const rotate = Math.round(h - 38);
  return `grayscale(1) sepia(1) hue-rotate(${rotate}deg) saturate(${(1 + s * 3).toFixed(2)}) brightness(${(0.6 + l * 1.0).toFixed(2)}) contrast(1.05)`;
}

/**
 * 색 손잡이 값 → CSS filter. 「original」·모르는 값·없음은 undefined(원본 그대로).
 */
export function retroTintFilter(tint: string | undefined): string | undefined {
  if (!tint || tint === RETRO_TINT_ORIGINAL) return undefined;
  const preset = PRESET_BY_ID.get(tint);
  if (preset) return preset.filter;
  return HEX.test(tint) ? hexFilter(tint) : undefined;
}
