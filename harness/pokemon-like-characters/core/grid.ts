/**
 * 생성 도트 그림 → 진짜 도트.
 *
 * 이미지 생성기는 「도트풍」 그림을 8~27px 정도의 가짜 픽셀 블록으로 그린다. 이걸 BOX 축소하면 격자와
 * 어긋난 칸이 이웃 블록 색을 섞어 잘게 갈라진 색 조각(1픽셀 조각 13~30%)이 생긴다 — v9 까지의 실패 원인.
 * 여기서는 색 경계의 주기로 블록 크기와 격자선을 찾고, 칸마다 가운데 영역의 최빈 색을 고른다.
 * 그러면 생성기가 고른 도트가 그대로 남는다.
 */
import { createImage, cropToInk, pixelAt, setPixel, type RgbaImage } from "./image";
import { labDistance, oklab, oklabCached, type Lab } from "./oklab";

export type GridResult = {
  /** 칸 하나 = 픽셀 하나인 도트 (잉크 상자로 잘림) */
  cells: RgbaImage;
  /** 찾은 블록 크기(원본 픽셀) */
  block: number;
};

function isMagentaBackground(r: number, g: number, b: number): boolean {
  return r > 170 && b > 170 && g < 120 && Math.abs(r - b) < 70;
}

/** Explicit alpha/magenta background; infer corner RGB only without alpha background. */
function backgroundMask(image: RgbaImage): Uint8Array {
  const { width, height } = image;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const d = image.data;
    // Generated PNGs keep arbitrary RGB behind transparent / faint alpha.
    // Sampling that RGB as ink created colored halos and oversized bounding boxes.
    if (d[i * 4 + 3]! < 128) {
      mask[i] = 1;
    } else if (isMagentaBackground(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!)) mask[i] = 1;
  }
  const corner: number[][] = [];
  let magentaCorners = 0;
  let alphaCorners = 0;
  const size = Math.min(12, width, height);
  for (const [cx, cy] of [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]] as const) {
    for (let y = cy; y < cy + size; y += 1) {
      for (let x = cx; x < cx + size; x += 1) {
        const p = pixelAt(image, x, y);
        corner.push([p[0], p[1], p[2]]);
        if (p[3] < 128) alphaCorners += 1;
        if (isMagentaBackground(p[0], p[1], p[2])) magentaCorners += 1;
      }
    }
  }
  // A majority of transparent corner samples establishes alpha as the background.
  // Its hidden RGB is arbitrary; flooding it can erase same-colored foreground.
  // An isolated transparent hole in a solid-background image must not disable cleanup.
  if (alphaCorners * 2 > corner.length) return mask;
  if (magentaCorners * 2 > corner.length) return mask;
  const median = [0, 1, 2].map((c) => {
    const values = corner.map((p) => p[c]!).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)]!;
  });
  const ref = oklab(median[0]!, median[1]!, median[2]!);
  const near = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const d = image.data;
    if (labDistance(oklabCached(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!), ref) < 0.07) near[i] = 1;
  }
  // 가장자리에서 시작하는 연결 성분만 배경
  const stack: number[] = [];
  const seen = new Uint8Array(width * height);
  const push = (i: number) => {
    if (near[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    mask[i] = 1;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }
  return mask;
}

function smooth(profile: number[]): number[] {
  return profile.map((v, i) => 0.25 * (profile[i - 1] ?? 0) + 0.5 * v + 0.25 * (profile[i + 1] ?? 0));
}

function peaksOf(profile: number[]): number[] {
  const pr = smooth(profile);
  const mean = pr.reduce((a, b) => a + b, 0) / pr.length;
  const std = Math.sqrt(pr.reduce((a, b) => a + (b - mean) ** 2, 0) / pr.length);
  const threshold = mean + 0.5 * std;
  const peaks: number[] = [];
  for (let i = 1; i < pr.length - 1; i += 1) {
    if (pr[i]! >= pr[i - 1]! && pr[i]! > pr[i + 1]! && pr[i]! > threshold) peaks.push(i);
  }
  return peaks;
}

/**
 * 블록 크기 하한. 한 장에 한 마리를 그린 그림은 블록이 8~27px 라 5 아래는 경계 번짐 잡음이다.
 * 한 줄에 여러 프레임을 그린 동작 줄은 블록이 3~4px 까지 작아진다 — 하한 5 에선 2배 크기를 골라 몸집이 반이 됐다(2026-10-01).
 */
export const DEFAULT_MIN_BLOCK = 5;

export function peakGaps(profile: number[], minBlock = DEFAULT_MIN_BLOCK): number[] {
  const peaks = peaksOf(profile);
  const gaps: number[] = [];
  for (let i = 1; i < peaks.length; i += 1) {
    const gap = peaks[i]! - peaks[i - 1]!;
    if (gap >= minBlock && gap <= 40) gaps.push(gap);
  }
  return gaps;
}

/**
 * 블록 크기 고르기: 크기 p 마다 「간격이 p 의 정수배에 가까운가」를 센다. 배수 k 일수록 가중치 1/k.
 * 반올림한 몫에 투표하면 13·14px 간격이 반 크기 7 에 몰려 칸을 둘로 쪼갠다 (2026-10-01 리프링 뒷모습).
 */
export function chooseBlock(gaps: number[], minBlock = DEFAULT_MIN_BLOCK, maxBlock = 40): number {
  let best = 0;
  let bestScore = 0;
  for (let p = minBlock; p <= maxBlock; p += 1) {
    let score = 0;
    for (const gap of gaps) {
      const k = Math.max(1, Math.round(gap / p));
      if (k <= 3 && Math.abs(gap / p - k) < 0.15) score += 1 / k;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** 블록 크기 p 로 격자선을 따라간다. 생성기 격자는 조금씩 밀리므로 근처 봉우리에 다시 맞춘다. */
function gridLines(profile: number[], p: number): number[] {
  const n = profile.length;
  const peaks = peaksOf(profile);
  const peakSet = new Set(peaks);
  let cur = peaks.length > 0 ? peaks[0]! % p : 0;
  if (cur > 0) cur -= p;
  const out = [cur];
  while (cur < n) {
    const lo = Math.trunc(cur + 0.6 * p);
    const hi = Math.trunc(cur + 1.4 * p);
    let next = cur + p;
    let best = Infinity;
    for (let q = lo; q <= hi; q += 1) {
      if (peakSet.has(q) && Math.abs(q - cur - p) < best) {
        best = Math.abs(q - cur - p);
        next = q;
      }
    }
    out.push(next);
    cur = next;
  }
  return out.map((v) => Math.max(0, Math.min(n, v)));
}

/** 배경 마스크와 가로·세로 색 경계 세기 (블록 크기·격자선 추정의 입력) */
export function edgeProfiles(source: RgbaImage): { bg: Uint8Array; dx: number[]; dy: number[] } {
  const { width, height } = source;
  const bg = backgroundMask(source);
  const labs: Lab[] = new Array(width * height);
  const BG_LAB: Lab = [2, 2, 2];
  for (let i = 0; i < width * height; i += 1) {
    const d = source.data;
    labs[i] = bg[i] ? BG_LAB : oklabCached(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!);
  }
  const step = (a: Lab, b: Lab) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const dx = new Array<number>(width).fill(0);
  const dy = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) dx[x]! += step(labs[y * width + x]!, labs[y * width + x - 1]!);
  }
  for (let y = 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) dy[y]! += step(labs[y * width + x]!, labs[(y - 1) * width + x]!);
  }
  return { bg, dx, dy };
}

export type GridOptions = {
  /** 동일 시트 프레임의 검토된 블록 크기. 자동 탐색보다 우선한다. */
  block?: number;
  /** 블록 크기 하한 (기본 5) */
  minBlock?: number;
  /** 블록 크기를 대략 안다면 그 ±30% 안에서만 고른다 (동작 줄: 기준 스프라이트 폭으로 잰다 — anim/row.ts) */
  around?: number;
};

export function extractGrid(source: RgbaImage, options: GridOptions = {}): GridResult {
  const { width } = source;
  const { bg, dx, dy } = edgeProfiles(source);
  const lo = options.around ? Math.max(2, Math.floor(options.around * 0.7)) : options.minBlock ?? DEFAULT_MIN_BLOCK;
  const hi = options.around ? Math.ceil(options.around * 1.3) : 40;
  if (options.block !== undefined && (!Number.isInteger(options.block) || options.block < 2 || options.block > 40)) {
    throw new Error("고정 픽셀 블록은 2~40 사이의 정수여야 한다");
  }
  const block = options.block ?? (chooseBlock([...peakGaps(dx, lo), ...peakGaps(dy, lo)], lo, hi) || (options.around ? Math.round(options.around) : 0));
  if (block === 0) throw new Error("픽셀 격자를 찾지 못했다 — 도트풍 그림이 아니다");
  const xs = gridLines(dx, block);
  const ys = gridLines(dy, block);

  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const cells = createImage(cols, rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x0 = xs[i]!;
      const x1 = xs[i + 1]!;
      const y0 = ys[j]!;
      const y1 = ys[j + 1]!;
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;
      // 가운데 영역만 본다. 2~3px 칸(작은 블록 줄)에서 여백을 1px 씩 빼면 표본이 0개가 되어 칸이 빠지고,
      // 빠진 칸 열이 몸을 세로로 갈라 프레임 나누기가 틀렸다 (2026-10-01 동작 줄).
      const mx = Math.floor((x1 - x0) / 4);
      const my = Math.floor((y1 - y0) / 4);
      let total = 0;
      let background = 0;
      const buckets = new Map<number, number[]>();
      for (let y = y0 + my; y < y1 - my; y += 1) {
        for (let x = x0 + mx; x < x1 - mx; x += 1) {
          total += 1;
          const idx = y * width + x;
          if (bg[idx]) {
            background += 1;
            continue;
          }
          const d = source.data;
          const r = d[idx * 4]!;
          const g = d[idx * 4 + 1]!;
          const b = d[idx * 4 + 2]!;
          const key = (Math.floor(r / 6) << 16) | (Math.floor(g / 6) << 8) | Math.floor(b / 6);
          const list = buckets.get(key);
          if (list) list.push(r, g, b);
          else buckets.set(key, [r, g, b]);
        }
      }
      if (total === 0 || background * 2 > total) continue;
      let pick: number[] | undefined;
      for (const list of buckets.values()) if (!pick || list.length > pick.length) pick = list;
      if (!pick) continue;
      const n = pick.length / 3;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < pick.length; k += 3) {
        r += pick[k]!;
        g += pick[k + 1]!;
        b += pick[k + 2]!;
      }
      setPixel(cells, i, j, [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255]);
    }
  }
  return { cells: cropToInk(cells), block };
}
