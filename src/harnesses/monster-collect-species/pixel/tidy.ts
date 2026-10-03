/** 격자 도트 정리: 마젠타 번짐 제거 → 작은 섬 제거 → 가까운 색 합치기(최대 kmax) → 외톨이 점 흡수 */
import { cloneImage, cropToInk, isOpaque, keyRgb, pixelAt, rgbKey, setPixel, type Rgba, type RgbaImage } from "./image";
import { isMagentaCast, labDistance, MAGENTA_LAB, oklabCached } from "./oklab";

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function labOf(p: Rgba) {
  return oklabCached(p[0], p[1], p[2]);
}

function removeSmallIslands(image: RgbaImage, minSize: number): void {
  const { width, height } = image;
  const seen = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpaque(image, x, y) || seen[y * width + x]) continue;
      const component: number[] = [];
      const stack = [y * width + x];
      seen[y * width + x] = 1;
      while (stack.length > 0) {
        const i = stack.pop()!;
        component.push(i);
        const cx = i % width;
        const cy = (i - cx) / width;
        for (const [ox, oy] of NEIGHBORS) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!seen[ni] && isOpaque(image, nx, ny)) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }
      if (component.length < minSize) for (const i of component) image.data[i * 4 + 3] = 0;
    }
  }
}

/** 많이 쓰인 색부터 대표로 삼고, 문턱 안의 색을 대표에 합친다. 대표가 kmax 이하가 될 때까지 문턱을 올린다. */
function mergePalette(image: RgbaImage, kmax: number): number {
  const counts = new Map<number, number>();
  for (let i = 0; i < image.width * image.height; i += 1) {
    const d = image.data;
    if (d[i * 4 + 3]) counts.set(rgbKey(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!), (counts.get(rgbKey(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!)) ?? 0) + 1);
  }
  const order = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const lab = new Map(order.map((key) => {
    const [r, g, b] = keyRgb(key);
    return [key, oklabCached(r, g, b)] as const;
  }));
  let threshold = 0.03;
  let mapping = new Map<number, number>();
  let reps: number[] = [];
  for (;;) {
    reps = [];
    mapping = new Map();
    for (const key of order) {
      let best: number | undefined;
      let bestDistance = Infinity;
      for (const rep of reps) {
        const distance = labDistance(lab.get(key)!, lab.get(rep)!);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = rep;
        }
      }
      if (best !== undefined && bestDistance < threshold) mapping.set(key, best);
      else {
        reps.push(key);
        mapping.set(key, key);
      }
    }
    if (reps.length <= kmax) break;
    threshold += 0.01;
  }
  for (let i = 0; i < image.width * image.height; i += 1) {
    const d = image.data;
    if (!d[i * 4 + 3]) continue;
    const [r, g, b] = keyRgb(mapping.get(rgbKey(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!))!);
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
  }
  return reps.length;
}

/** 네 이웃 중 같은 색이 없고, 불투명 이웃이 3개 이상이며, 이웃 최빈 색과 가까운 점은 그 색으로 흡수한다. */
function absorbOrphans(image: RgbaImage): RgbaImage {
  const out = cloneImage(image);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      const me = pixelAt(image, x, y);
      const opaque: Rgba[] = [];
      let same = false;
      for (const [ox, oy] of NEIGHBORS) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
        const n = pixelAt(image, nx, ny);
        if (n[0] === me[0] && n[1] === me[1] && n[2] === me[2] && n[3] === me[3]) same = true;
        if (n[3]) opaque.push(n);
      }
      if (same || opaque.length < 3) continue;
      const mode = modeColor(opaque);
      if (labDistance(labOf(me), labOf(mode)) < 0.09) setPixel(out, x, y, mode);
    }
  }
  return out;
}

export function modeColor(colors: Rgba[]): Rgba {
  const counts = new Map<number, { color: Rgba; count: number }>();
  for (const color of colors) {
    const key = rgbKey(color[0], color[1], color[2]);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { color, count: 1 });
  }
  let best: { color: Rgba; count: number } | undefined;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best!.color;
}

export type TidyResult = { image: RgbaImage; colors: number };

export function tidyCells(cells: RgbaImage, kmax = 20): TidyResult {
  const image = cloneImage(cells);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (isOpaque(image, x, y) && labDistance(labOf(pixelAt(image, x, y)), MAGENTA_LAB) <= 0.18) image.data[(y * image.width + x) * 4 + 3] = 0;
    }
  }
  removeSmallIslands(image, 6);
  const colors = mergePalette(image, kmax);
  return { image: cropToInk(absorbOrphans(image)), colors };
}

/** 축소 뒤에도 남는 마젠타 기운 점: 불투명 이웃 2개 이상이면 이웃 최빈 색, 아니면 지운다. */
export function removeMagentaCasts(image: RgbaImage): { image: RgbaImage; removed: number } {
  const out = cloneImage(image);
  let removed = 0;
  const cast = (p: Rgba) => p[3] > 0 && isMagentaCast(labOf(p));
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const me = pixelAt(out, x, y);
      if (!cast(me)) continue;
      const neighbors: Rgba[] = [];
      for (const [ox, oy] of NEIGHBORS) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
        const n = pixelAt(out, nx, ny);
        if (n[3] && !cast(n)) neighbors.push(n);
      }
      setPixel(out, x, y, neighbors.length >= 2 ? modeColor(neighbors) : [0, 0, 0, 0]);
      removed += 1;
    }
  }
  return { image: out, removed };
}
