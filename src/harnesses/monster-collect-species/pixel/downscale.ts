/**
 * 격자 도트 축소. 칸 묶음마다 최빈 색을 고르되, 어두운 선 색(L<0.32)이 1/4 이상이면 선을 살린다 —
 * 그냥 최빈 색을 고르면 한 칸 두께 윤곽·관절선이 절반쯤 사라진다. 끝으로 실루엣 가장자리의 끊긴 윤곽을 잇는다.
 */
import { createImage, isOpaque, pixelAt, rgbKey, setPixel, type Rgba, type RgbaImage } from "./image";
import { oklabCached } from "./oklab";

const LINE_L = 0.32;
/** 눈 하이라이트 판정(격자 단계): 밝은 화소 덩어리가 어두운 동공에 거의 둘러싸여 있다 */
const HL_L = 0.8;
const HL_DARK_L = 0.4;
const HL_MAX_AREA = 9;
const HL_ENCLOSED = 0.7;

function lightness(p: Rgba): number {
  return oklabCached(p[0], p[1], p[2])[0];
}

type Tally = Map<number, { color: Rgba; weight: number; dark: number }>;

function pickFromTally(tally: Tally, total: number): Rgba {
  let darkTotal = 0;
  for (const entry of tally.values()) darkTotal += entry.dark;
  let best: { color: Rgba; weight: number; dark: number } | undefined;
  const useDark = darkTotal >= total / 4;
  for (const entry of tally.values()) {
    const score = useDark ? entry.dark : entry.weight;
    if (score > 0 && (!best || score > (useDark ? best.dark : best.weight))) best = entry;
  }
  return best!.color;
}

export type Highlight = { cells: [number, number][]; color: Rgba };

/**
 * 눈 하이라이트 덩어리 찾기. 최빈색 축소는 동공(어두운 면) 속 흰 점 1~2칸을 먹어 눈이 구슬처럼 죽는다(pipbug 후보 12장 전멸, 2026-10-16).
 * 덩어리 = 밝은(L≥0.8) 불투명 칸의 4연결 성분, 면적 ≤9, 둘레 이웃 중 어두운(L<0.4) 칸이 70% 이상.
 * 둘레가 몸 살갗이면(밝은 점무늬) 어두운 비율이 낮아 제외된다.
 */
export function findHighlights(image: RgbaImage): Highlight[] {
  const { width, height } = image;
  const bright = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (isOpaque(image, x, y) && lightness(pixelAt(image, x, y)) >= HL_L) bright[y * width + x] = 1;
  }
  const seen = new Uint8Array(width * height);
  const found: Highlight[] = [];
  for (let sy = 0; sy < height; sy += 1) {
    for (let sx = 0; sx < width; sx += 1) {
      if (!bright[sy * width + sx] || seen[sy * width + sx]) continue;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[sx, sy]];
      seen[sy * width + sx] = 1;
      while (stack.length > 0 && cells.length <= HL_MAX_AREA) {
        const [x, y] = stack.pop()!;
        cells.push([x, y]);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !bright[ny * width + nx] || seen[ny * width + nx]) continue;
          seen[ny * width + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (stack.length > 0 || cells.length > HL_MAX_AREA) {
        // 너무 큰 덩어리(몸 밝은 면): 남은 칸을 표시만 하고 버린다
        while (stack.length > 0) stack.pop();
        continue;
      }
      const inSet = new Set(cells.map(([x, y]) => y * width + x));
      let ring = 0;
      let dark = 0;
      const counted = new Set<number>();
      for (const [x, y] of cells) {
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + ox;
          const ny = y + oy;
          const key = ny * width + nx;
          if (inSet.has(key) || counted.has(key)) continue;
          counted.add(key);
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !isOpaque(image, nx, ny)) continue;
          ring += 1;
          if (lightness(pixelAt(image, nx, ny)) < HL_DARK_L) dark += 1;
        }
      }
      if (ring < 3 || dark / ring < HL_ENCLOSED) continue;
      let best = pixelAt(image, cells[0]![0], cells[0]![1]);
      for (const [x, y] of cells) if (lightness(pixelAt(image, x, y)) > lightness(best)) best = pixelAt(image, x, y);
      found.push({ cells, color: [best[0], best[1], best[2], 255] });
    }
  }
  return found;
}

/** 정수 배율: f×f 칸 묶음 하나가 새 칸 하나 */
export function downscaleBy(image: RgbaImage, factor: number): RgbaImage {
  return downscaleGrid(image, factor, Math.ceil(image.width / factor), Math.ceil(image.height / factor));
}

/** 비정수 배율: 목표 폭에 맞춘다 */
export function downscaleTo(image: RgbaImage, targetWidth: number): RgbaImage {
  const f = image.width / targetWidth;
  return downscaleGrid(image, f, targetWidth, Math.max(1, Math.round(image.height / f)));
}

/** 새 칸마다 원본 칸이 겹치는 면적으로 색을 센다. */
function downscaleGrid(image: RgbaImage, f: number, targetWidth: number, targetHeight: number): RgbaImage {
  const out = createImage(targetWidth, targetHeight);
  for (let j = 0; j < targetHeight; j += 1) {
    for (let i = 0; i < targetWidth; i += 1) {
      const x0 = i * f;
      const x1 = (i + 1) * f;
      const y0 = j * f;
      const y1 = (j + 1) * f;
      const tally: Tally = new Map();
      let total = 0;
      let opaque = 0;
      for (let y = Math.floor(y0); y < Math.min(image.height, Math.ceil(y1)); y += 1) {
        for (let x = Math.floor(x0); x < Math.min(image.width, Math.ceil(x1)); x += 1) {
          const w = (Math.min(x1, x + 1) - Math.max(x0, x)) * (Math.min(y1, y + 1) - Math.max(y0, y));
          if (w <= 0) continue;
          total += w;
          if (!isOpaque(image, x, y)) continue;
          opaque += w;
          const p = pixelAt(image, x, y);
          const key = rgbKey(p[0], p[1], p[2]);
          const entry = tally.get(key) ?? { color: p, weight: 0, dark: 0 };
          entry.weight += w;
          if (lightness(p) < LINE_L) entry.dark += w;
          tally.set(key, entry);
        }
      }
      if (opaque * 2 < total || tally.size === 0) continue;
      setPixel(out, i, j, pickFromTally(tally, total));
    }
  }
  return reconnectOutline(preserveHighlights(out, image, f));
}

/**
 * 축소가 하이라이트를 먹었으면 되살린다: 덩어리마다 새 칸별 겹침 면적을 재서
 * 면적 비율 ≥ 1/3 인 칸은 모두, 하나도 없으면 가장 많이 겹친 칸 하나를 하이라이트 색으로 칠한다(파이프라인 규칙 — 손으로 찍지 않는다).
 */
function preserveHighlights(out: RgbaImage, source: RgbaImage, f: number): RgbaImage {
  for (const hl of findHighlights(source)) {
    const weights = new Map<number, number>();
    for (const [x, y] of hl.cells) {
      const i0 = Math.floor(x / f);
      const j0 = Math.floor(y / f);
      for (let j = Math.max(0, j0 - 1); j <= Math.min(out.height - 1, j0 + 1); j += 1) {
        for (let i = Math.max(0, i0 - 1); i <= Math.min(out.width - 1, i0 + 1); i += 1) {
          const w = Math.max(0, Math.min(x + 1, (i + 1) * f) - Math.max(x, i * f)) * Math.max(0, Math.min(y + 1, (j + 1) * f) - Math.max(y, j * f));
          if (w > 0) weights.set(j * out.width + i, (weights.get(j * out.width + i) ?? 0) + w);
        }
      }
    }
    const cellArea = f * f;
    let bestKey = -1;
    let bestW = 0;
    const chosen: number[] = [];
    for (const [key, w] of weights) {
      if (w > bestW) {
        bestW = w;
        bestKey = key;
      }
      if (w / cellArea >= 1 / 3) chosen.push(key);
    }
    if (chosen.length === 0 && bestKey >= 0) chosen.push(bestKey);
    for (const key of chosen) {
      const i = key % out.width;
      const j = (key - i) / out.width;
      if (isOpaque(out, i, j) && lightness(pixelAt(out, i, j)) < HL_L) setPixel(out, i, j, hl.color);
    }
  }
  return out;
}

/** 가장자리 칸이 밝으면 5x5 안의 가장 어두운 선 색으로 칠해 윤곽을 잇는다. */
export function reconnectOutline(image: RgbaImage): RgbaImage {
  const out = createImage(image.width, image.height);
  out.data.set(image.data);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
        const nx = x + ox!;
        const ny = y + oy!;
        return nx < 0 || ny < 0 || nx >= image.width || ny >= image.height || !isOpaque(image, nx, ny);
      });
      if (!edge || lightness(pixelAt(image, x, y)) <= 0.36) continue;
      let darkest: Rgba | undefined;
      let darkestL = Infinity;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(image.height - 1, y + 2); yy += 1) {
        for (let xx = Math.max(0, x - 2); xx <= Math.min(image.width - 1, x + 2); xx += 1) {
          if (!isOpaque(image, xx, yy)) continue;
          const p = pixelAt(image, xx, yy);
          const l = lightness(p);
          if (l < darkestL) {
            darkestL = l;
            darkest = p;
          }
        }
      }
      if (darkest && darkestL < LINE_L) setPixel(out, x, y, darkest);
    }
  }
  return out;
}
