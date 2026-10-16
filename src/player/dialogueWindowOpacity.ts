// player/dialogueWindowOpacity.ts
// 대사창 투명도(설정 > 대사창 투명도) — 상자 배경의 알파만 낮춘다. 글자·초상·테두리는 그대로 또렷하다(2026-10-17).
// 상자 배경은 스타일마다 단색·rgba·그라데이션이 섞여 있어 CSS 한 줄로 못 낮춘다. 그려진 뒤 계산된 값을 읽어 색 함수의 알파만 곱한다.
// url() 그림(창 스킨 이미지)은 알파를 건드릴 수 없으므로 그대로 둔다.

const LEGACY_FN = /\b(rgba?|hsla?)\(([^()]*)\)/gi;
const MODERN_FN = /\b(color|oklab|oklch|lab|lch|hwb)\(([^()]*)\)/gi;

function clampAlpha(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

function scaleAlphaIn(name: string, inner: string, factor: number): string {
  const slash = inner.lastIndexOf("/");
  if (slash >= 0) {
    const alphaText = inner.slice(slash + 1).trim();
    const alpha = alphaText.endsWith("%") ? Number.parseFloat(alphaText) / 100 : Number.parseFloat(alphaText);
    return `${name}(${inner.slice(0, slash).trimEnd()} / ${clampAlpha((Number.isFinite(alpha) ? alpha : 1) * factor)})`;
  }
  const parts = inner.split(",").map((part) => part.trim());
  if (parts.length === 4) {
    const alphaText = parts[3] ?? "1";
    const alpha = alphaText.endsWith("%") ? Number.parseFloat(alphaText) / 100 : Number.parseFloat(alphaText);
    return `${name}(${parts.slice(0, 3).join(", ")}, ${clampAlpha((Number.isFinite(alpha) ? alpha : 1) * factor)})`;
  }
  if (parts.length === 3) return `${name}(${parts.join(", ")}, ${clampAlpha(factor)})`;
  return `${name}(${inner.trim()} / ${clampAlpha(factor)})`;
}

/** CSS 값 안의 모든 색 함수 알파에 factor 를 곱한다(알파 없는 색은 factor 가 알파가 된다). 순수 함수. */
export function scaleCssAlpha(css: string, factor: number): string {
  const f = Number.isFinite(factor) ? Math.min(1, Math.max(0, factor)) : 1;
  return css
    .replace(LEGACY_FN, (_match, name: string, inner: string) => scaleAlphaIn(name, inner, f))
    .replace(MODERN_FN, (_match, name: string, inner: string) => scaleAlphaIn(name, inner, f));
}

/** 붙은 뒤의 상자에 호출한다(계산된 스타일이 필요하다). opacity 1 이면 아무것도 하지 않는다. */
export function applyWindowOpacity(box: HTMLElement, opacity: number | undefined): void {
  if (opacity === undefined || !(opacity < 0.995) || typeof getComputedStyle !== "function" || box.classList.contains("transparent")) return;
  const computed = getComputedStyle(box);
  const color = computed.backgroundColor;
  const image = computed.backgroundImage;
  if (color && color !== "transparent" && !/\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(color)) box.style.backgroundColor = scaleCssAlpha(color, opacity);
  // url() 이 섞인 그림 배경은 알파를 못 낮추므로 건드리지 않는다(그라데이션만 낮춘다).
  if (image && image !== "none" && !image.includes("url(")) box.style.backgroundImage = scaleCssAlpha(image, opacity);
  box.dataset.windowOpacity = String(Math.round(opacity * 100));
}
