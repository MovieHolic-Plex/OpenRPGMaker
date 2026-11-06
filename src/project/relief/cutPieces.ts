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

/**
 * 역방향(북향 절벽, 높은 땅이 남쪽) 깎은 길의 칸 수: 단 차 + 2. 3/4 시점에서 오르막 rise 칸은 높은 단 뒤에 숨고 나머지 2칸이
 * 화면에 「멀어지며 내려가는」 2줄짜리 면으로 보인다(화면 높이 = (칸 수 − 단 차)·16 = 32px). 그래서 조각은 w×2줄 하나로 정해지고
 * 높이 차이는 그 안의 디딤판 수·그늘로 읽힌다. 경사로 키는 `<kind>:s:<w>x<rise+2>:<rise>`.
 */
export const REVERSE_VISIBLE_ROWS = 2;
export const reverseCutLength = (rise: number): number => rise + REVERSE_VISIBLE_ROWS;

const composed = new WeakMap<object, Map<string, ReliefArtPatch | null>>();

/**
 * 넓은 경사로(폭 4~8): 폭 3 조각을 왼쪽 가장자리 칸 · 가운데 칸 × (폭−2) · 오른쪽 가장자리 칸으로 늘린다.
 * 옆벽은 양끝에 한 번씩만 나오므로 한 장짜리 비탈로 읽힌다. 새 화소는 없다.
 */
function widenedPiece(pieces: Readonly<Record<string, ReliefArtPatch>>, kind: "ramp" | "stairs", dir: string, w: number, h: number, rise: number, key: string): ReliefArtPatch | null {
  let cache = composed.get(pieces);
  if (!cache) { cache = new Map(); composed.set(pieces, cache); }
  if (cache.has(key)) return cache.get(key)!;
  const base = cutPieceFor(pieces, kind, dir, 3, h, rise);
  let out: ReliefArtPatch | null = null;
  if (base && base.w % 3 === 0) {
    const cell = base.w / 3, width = cell * w, height = base.h;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let col = 0; col < w; col++) {
      const from = (col === 0 ? 0 : col === w - 1 ? 2 : 1) * cell;
      for (let y = 0; y < height; y++) for (let k = 0; k < cell * 4; k++) rgba[(y * width + col * cell) * 4 + k] = base.rgba[(y * base.w + from) * 4 + k]!;
    }
    out = { w: width, h: height, rgba };
  }
  cache.set(key, out);
  return out;
}
/**
 * 긴 비탈(북향, 길이 = 단 차 ≥ 2): 16px 모듈 넷을 위에서 아래로 쌓는다 — 꼭대기 · 절벽 면 줄 × (단 차−1) · 낮은 땅 위 줄 × (길이−1, 옆벽 6→3px 로 좁아짐) · 발치.
 * 모듈은 `ramp:n:<2|3>:long-<top|cut|out6|out5|out4|out3|toe>`(scripts/experiments/long-ramp/pieces.py). 폭 4 이상은 폭 3 모듈의 왼·가운데·오른 칸으로 늘린다.
 */
function longRampPiece(pieces: Readonly<Record<string, ReliefArtPatch>>, w: number, h: number, rise: number, key: string): ReliefArtPatch | null {
  let cache = composed.get(pieces);
  if (!cache) { cache = new Map(); composed.set(pieces, cache); }
  if (cache.has(key)) return cache.get(key)!;
  const mw = Math.min(3, w), mod = (n: string) => pieces[`ramp:n:${mw}:long-${n}`];
  const walls = [6, 5, 4, 3], outs = Array.from({ length: h - 1 }, (_, k) => `out${walls[Math.min(walls.length - 1, Math.floor((k * walls.length) / Math.max(1, h - 1)))]}`);
  const seq = ["top", ...Array<string>(rise - 1).fill("cut"), ...outs, "toe"].map(mod);
  let out: ReliefArtPatch | null = null;
  if (seq.every(Boolean)) {
    const cell = seq[0]!.w / mw, width = cell * w, height = seq.length * 16;
    const rgba = new Uint8ClampedArray(width * height * 4);
    seq.forEach((m, k) => {
      for (let col = 0; col < w; col++) {
        const from = (w <= 3 ? col : col === 0 ? 0 : col === w - 1 ? 2 : 1) * cell;
        for (let y = 0; y < 16; y++) for (let c = 0; c < cell * 4; c++) rgba[((k * 16 + y) * width + col * cell) * 4 + c] = m!.rgba[(y * m!.w + from) * 4 + c]!;
      }
    });
    out = { w: width, h: height, rgba };
  }
  cache.set(key, out);
  return out;
}

/** 경사로 하나의 통째 조각: 북향 긴 비탈(길이 = 단 차 ≥ 2)은 모듈로, 키가 있으면 그것, 북쪽 h=2 이면 정본 나눔으로 낱조각 둘을 이어 붙인다. */
export function cutPieceFor(pieces: Readonly<Record<string, ReliefArtPatch>>, kind: "ramp" | "stairs", dir: string, w: number, h: number, rise: number): ReliefArtPatch | null {
  const key = `${kind}:${dir}:${w}x${h}:${rise}`;
  if (kind === "ramp" && dir === "n" && rise >= 2 && h === rise && pieces["ramp:n:3:long-top"]) return longRampPiece(pieces, w, h, rise, key);
  const direct = pieces[key];
  if (direct) return direct;
  if (w > 3 && (dir === "n" || dir === "s")) return widenedPiece(pieces, kind, dir, w, h, rise, key);
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
