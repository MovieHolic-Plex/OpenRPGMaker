/**
 * 생성 건물 검사기용 작은 래스터 도구. numpy/scipy 없이 bp_fit.py 가 쓰던 연산만 옮겼다.
 * 모든 마스크는 행 우선 Uint8Array(0/1), 그림은 RGBA Uint8ClampedArray.
 */
export type Rgb = readonly [number, number, number];

export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export const LUM: Rgb = [0.299, 0.587, 0.114];
export const lum = (r: number, g: number, b: number): number => r * LUM[0] + g * LUM[1] + b * LUM[2];

export function createRaster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function decodeBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** sRGB → CIE Lab (bp_fit.lab 와 같은 식). */
export function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number): number => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.9505;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.089;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** 팔레트 가장 가까운 색(Lab 거리). 같은 색은 한 번만 잰다. */
export function createNearest(palette: readonly Rgb[]): (r: number, g: number, b: number) => { index: number; d2: number } {
  const pl = palette.map((c) => lab(c[0], c[1], c[2]));
  const cache = new Map<number, { index: number; d2: number }>();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit) return hit;
    const q = lab(r, g, b);
    let index = 0, d2 = Infinity;
    for (let i = 0; i < pl.length; i++) {
      const p = pl[i]!;
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
      if (d < d2) { d2 = d; index = i; }
    }
    const res = { index, d2 };
    cache.set(key, res);
    return res;
  };
}

/** 연결 성분(4방향 또는 8방향). 0 = 배경, 1.. = 성분 번호(행 우선 첫 픽셀 순서 = ndimage.label 과 같은 번호). */
export function label(mask: Uint8Array, w: number, h: number, eight = false): { labels: Int32Array; count: number } {
  const labels = new Int32Array(w * h);
  let count = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || labels[i]) continue;
    count++;
    labels[i] = count;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!eight && dx !== 0 && dy !== 0)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (mask[n] && !labels[n]) { labels[n] = count; stack.push(n); }
        }
      }
    }
  }
  return { labels, count };
}

/** 성분별 경계 상자 [x0, y0, x1, y1)(ndimage.find_objects). */
export function boxes(labels: Int32Array, count: number, w: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = Array.from({ length: count }, () => [Infinity, Infinity, -1, -1]);
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]!;
    if (!l) continue;
    const x = i % w, y = (i - x) / w, b = out[l - 1]!;
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x + 1 > b[2]) b[2] = x + 1;
    if (y + 1 > b[3]) b[3] = y + 1;
  }
  return out;
}

/** 십자 구조 원소로 iterations 번 팽창 = 맨해튼 거리 ≤ iterations(ndimage.binary_dilation 기본값). */
export function dilateCross(mask: Uint8Array, w: number, h: number, iterations: number): Uint8Array {
  const dist = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) { dist[i] = 0; queue.push(i); }
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi]!;
    if (dist[p]! >= iterations) continue;
    const x = p % w, y = (p - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (dist[n] === -1) { dist[n] = dist[p]! + 1; queue.push(n); }
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = dist[i]! >= 0 ? 1 : 0;
  return out;
}

/** 각 픽셀에서 가장 가까운 source 픽셀 번호(8방향 BFS; distance_transform_edt 의 인덱스 대용). source 가 없으면 -1. */
export function nearestSource(source: Uint8Array, w: number, h: number): Int32Array {
  const near = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (source[i]) { near[i] = i; queue.push(i); }
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi]!;
    const x = p % w, y = (p - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (near[n] === -1) { near[n] = near[p]!; queue.push(n); }
      }
    }
  }
  return near;
}

/** 크기 맞춤(양선형). 뽑는 쪽마다 출력 크기가 달라 기준 이미지 좌표로 되돌릴 때만 쓴다. */
export function resizeBilinear(src: Raster, width: number, height: number): Raster {
  if (src.width === width && src.height === height) return src;
  const out = createRaster(width, height);
  const sx = src.width / width, sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5), y0 = Math.floor(fy), y1 = Math.min(src.height - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5), x0 = Math.floor(fx), x1 = Math.min(src.width - 1, x0 + 1), tx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const a = src.data[(y0 * src.width + x0) * 4 + c]!, b = src.data[(y0 * src.width + x1) * 4 + c]!;
        const d = src.data[(y1 * src.width + x0) * 4 + c]!, e = src.data[(y1 * src.width + x1) * 4 + c]!;
        out.data[(y * width + x) * 4 + c] = Math.round((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty);
      }
    }
  }
  return out;
}

/** 중앙값을 정수로 자른 값(np.median(...).astype(int)). */
export function medianTrunc(values: number[]): number {
  values.sort((a, b) => a - b);
  const n = values.length, m = n >> 1;
  return n % 2 ? values[m]! : Math.trunc((values[m - 1]! + values[m]!) / 2);
}
