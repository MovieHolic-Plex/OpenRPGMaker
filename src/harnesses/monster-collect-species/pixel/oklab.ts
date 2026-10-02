/** sRGB → OKLab. 색 거리는 OKLab 유클리드 거리로 잰다 (0.1 ≈ 눈에 띄는 차이). */
export type Lab = readonly [number, number, number];

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function oklab(r: number, g: number, b: number): Lab {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function labDistance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const cache = new Map<number, Lab>();

/** 같은 색을 수천 번 재므로 캐시한다. */
export function oklabCached(r: number, g: number, b: number): Lab {
  const key = (r << 16) | (g << 8) | b;
  let lab = cache.get(key);
  if (!lab) {
    lab = oklab(r, g, b);
    cache.set(key, lab);
  }
  return lab;
}

export const MAGENTA_LAB = oklab(255, 0, 255);

/** 마젠타 계열(붉은 보라) 색인가 — 배경 번짐 판정 */
export function isMagentaCast(lab: Lab): boolean {
  return lab[1] > 0.09 && lab[2] < -0.01;
}
