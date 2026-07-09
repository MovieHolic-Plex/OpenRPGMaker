// player/screen/tintModel.ts
// 화면 색조(tint) 오버레이의 순수 색 모델. Tint Screen 명령이 기록한 색 문자열을
// rgba 로 해석하고, 지속시간 트윈을 위해 두 색 사이를 보간한다.
// DOM(playSceneScreenEffects)은 이 결과를 배경색으로 적용만 한다.

import { screenColorToRgb } from "@/player/interpreter/commandCatalog";

export type Rgba = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

// 색조 없음(투명). neutral/none 또는 미지정 시.
export const TRANSPARENT_TINT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

// RM2K3 tint 는 색을 입히는 표현이므로 기본 알파 0.45.
const DEFAULT_TINT_ALPHA = 0.45;

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TINT_ALPHA;
  return Math.max(0, Math.min(1, value));
}

// tint 문자열("red" / "#ff0000" / "128,64,32" / "128,64,32,0.5" / "neutral")을 rgba 로.
// neutral/none/빈값은 투명(TRANSPARENT_TINT).
export function parseTintColor(tint: string | undefined): Rgba {
  if (tint === undefined) return TRANSPARENT_TINT;
  const trimmed = tint.trim();
  if (trimmed.length === 0 || trimmed === "neutral" || trimmed === "none") {
    return TRANSPARENT_TINT;
  }
  const parts = trimmed.split(",").map((part) => part.trim());
  if (parts.length >= 3 && parts.every((part) => /^-?\d+(\.\d+)?$/.test(part))) {
    return {
      r: clampByte(Number(parts[0])),
      g: clampByte(Number(parts[1])),
      b: clampByte(Number(parts[2])),
      a: parts[3] !== undefined ? clampAlpha(Number(parts[3])) : DEFAULT_TINT_ALPHA,
    };
  }
  const rgb = screenColorToRgb(trimmed);
  return { r: rgb.red, g: rgb.green, b: rgb.blue, a: DEFAULT_TINT_ALPHA };
}

// 두 rgba 사이 선형 보간. t 는 0~1 로 클램프. 알파도 함께 보간하므로
// 투명↔색상 전환이 자연스럽게 페이드된다.
export function interpolateRgba(from: Rgba, to: Rgba, t: number): Rgba {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 1));
  return {
    r: from.r + (to.r - from.r) * clamped,
    g: from.g + (to.g - from.g) * clamped,
    b: from.b + (to.b - from.b) * clamped,
    a: from.a + (to.a - from.a) * clamped,
  };
}

export function rgbaEqual(a: Rgba, b: Rgba): boolean {
  const eps = 0.002;
  return (
    Math.abs(a.r - b.r) < 0.5 &&
    Math.abs(a.g - b.g) < 0.5 &&
    Math.abs(a.b - b.b) < 0.5 &&
    Math.abs(a.a - b.a) < eps
  );
}

// rgba → CSS. 투명(a<=0)이면 완전 투명 문자열.
export function rgbaToCss(color: Rgba): string {
  const r = Math.round(color.r);
  const g = Math.round(color.g);
  const b = Math.round(color.b);
  const a = Math.round(color.a * 1000) / 1000;
  return `rgba(${r},${g},${b},${a})`;
}

export function isVisibleTint(color: Rgba): boolean {
  return color.a > 0.001;
}
