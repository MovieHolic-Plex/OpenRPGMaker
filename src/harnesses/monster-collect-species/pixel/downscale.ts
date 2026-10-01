/**
 * 격자 도트 축소. 칸 묶음마다 최빈 색을 고르되, 어두운 선 색(L<0.32)이 1/4 이상이면 선을 살린다 —
 * 그냥 최빈 색을 고르면 한 칸 두께 윤곽·관절선이 절반쯤 사라진다. 끝으로 실루엣 가장자리의 끊긴 윤곽을 잇는다.
 */
import { createImage, isOpaque, pixelAt, rgbKey, setPixel, type Rgba, type RgbaImage } from "./image";
import { oklabCached } from "./oklab";

const LINE_L = 0.32;

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
  return reconnectOutline(out);
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
