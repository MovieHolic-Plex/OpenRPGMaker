// 절벽 깎은 경사로·계단 통째 조각(rampArt.pieces) 고르기 — 겹친 계단(층계참 한 줄을 사이에 둔 두 단 오르막)까지.
//
// 겹친 계단은 엔진에 h=2 경사로 하나로 들어간다(가운데 띠 칸이 아래 단으로 내려가 경사로 규칙을 그대로 쓴다). 그래서
// 렌더러가 아는 것은 전체 단 차뿐이고, 1+3 과 3+1 처럼 나눔이 다른 두 계단은 구별되지 않는다. 그래서 나눔을 하나로 정한다:
//   정본 나눔(canonical split): 아래 계단 = floor(전체/2), 위 계단 = 전체 − 아래  (2=1+1, 3=1+2, 4=2+2, 5=2+3, 6=3+3, 7=3+4, 8=4+4)
// 그 밖의 나눔은 그릴 그림이 없으므로 깔 때(검증기) 거절한다. 겹친 계단 그림은 낱조각 둘을 이어 붙인 것(위 계단 + 그 발치 = 층계참,
// 아래 계단 + 발치)이라 새 화소가 없다 — 관문은 낱조각 16장에만 걸린다.
import type { ReliefArtPatch } from "./render";

export const CUT_MAX_RISE = 4;
/** 두 단 겹친 계단의 정본 나눔 [아래, 위] — 없으면(전체 < 2 또는 > 2×CUT_MAX_RISE) null. */
export function canonicalStackSplit(total: number): [lower: number, upper: number] | null {
  const lower = Math.floor(total / 2), upper = total - lower;
  return lower >= 1 && upper <= CUT_MAX_RISE ? [lower, upper] : null;
}

const composed = new WeakMap<object, Map<string, ReliefArtPatch | null>>();
/** 경사로 하나의 통째 조각: 키가 있으면 그것, 북쪽 h=2 이면 정본 나눔으로 낱조각 둘을 이어 붙인다. */
export function cutPieceFor(pieces: Readonly<Record<string, ReliefArtPatch>>, kind: "ramp" | "stairs", dir: string, w: number, h: number, rise: number): ReliefArtPatch | null {
  const key = `${kind}:${dir}:${w}x${h}:${rise}`;
  const direct = pieces[key];
  if (direct) return direct;
  if (dir !== "n" || h !== 2) return null;
  let cache = composed.get(pieces);
  if (!cache) { cache = new Map(); composed.set(pieces, cache); }
  if (cache.has(key)) return cache.get(key)!;
  const split = canonicalStackSplit(rise);
  const lower = split && pieces[`${kind}:n:${w}x1:${split[0]}`], upper = split && pieces[`${kind}:n:${w}x1:${split[1]}`];
  let out: ReliefArtPatch | null = null;
  if (lower && upper && lower.w === upper.w) {
    const rgba = new Uint8ClampedArray(upper.rgba.length + lower.rgba.length);
    rgba.set(Array.from(upper.rgba), 0); rgba.set(Array.from(lower.rgba), upper.rgba.length);
    out = { w: upper.w, h: upper.h + lower.h, rgba };
  }
  cache.set(key, out);
  return out;
}
