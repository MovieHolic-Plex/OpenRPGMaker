// src/harnesses/map-objects/editor/sheet.ts
/**
 * 맵 기물 실행기가 칩셋에서 화풍 기준을 꺼낸다: 팔레트(자주 쓴 색), 닮은 물체 그림, 시트 한 조각.
 * 칩셋은 편집기가 WorkshopEnv.tilesetSource 로 넘겨준다 — 이 파일은 프로젝트를 모른다.
 */
import type { RgbaImage, WorkshopTilesetSource } from "@/harnesses/_core/workshop/types";

/** 팔레트 색 수 상한. 모델이 고를 수 있는 만큼만 — 많으면 명암 단을 못 고른다. */
export const MAP_PALETTE_LIMIT = 48;
/** 거의 같은 색(RGB 거리)은 하나로 친다 */
const NEAR = 10;

const luma = (c: number): number => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
const distance = (a: number, b: number): number => Math.hypot(((a >> 16) & 255) - ((b >> 16) & 255), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255));
const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

/**
 * 그림들에서 자주 쓰인 불투명 색을 고른다. weight 가 큰 그림(닮은 물체)의 색이 먼저 뽑힌다 — 시트 전체는 땅 색이 대부분이다.
 * 결과는 밝기 순 #rrggbb(어두운 것부터). 반투명 화소는 세지 않는다.
 */
export function paletteFromImages(images: readonly { readonly image: RgbaImage; readonly weight: number }[], limit = MAP_PALETTE_LIMIT): string[] {
  const counts = new Map<number, number>();
  for (const { image, weight } of images) {
    for (const [color, n] of colorCounts(image)) counts.set(color, (counts.get(color) ?? 0) + n * weight);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const chosen: number[] = [];
  const take = (color: number): boolean => {
    if (chosen.length >= limit || chosen.some((other) => distance(other, color) <= NEAR)) return false;
    chosen.push(color);
    return true;
  };
  // 1) 자주 쓴 색 — 단, 끝 몇 칸은 비워 둔다.
  for (const [color] of ranked) { if (chosen.length >= limit - HUE_RESERVE) break; take(color); }
  // 2) 칩셋에 있는데 빠진 진한 색상(hue)마다 어두운·가운데·밝은 셋. 빈도만 보면 땅·돌 색이 자리를 다 차지해
  //    밀밭의 금빛 노랑(버들항 빈도 62위 밖)이 빠지고 건초 짐마차가 베이지 덩어리로 그려졌다(2026-10-22 VQA major).
  const total = ranked.reduce((sum, [, n]) => sum + n, 0);
  const bins = new Map<number, [number, number][]>();
  for (const [color, n] of ranked) {
    const [h, l, sat] = hls(color);
    if (sat < 0.45 || l < 0.18 || l > 0.86 || n < total * 0.0002) continue;
    const bin = binOf(h, sat);
    (bins.get(bin) ?? bins.set(bin, []).get(bin)!).push([color, n]);
  }
  const covered = (bin: number) => chosen.some((color) => { const [h, , sat] = hls(color); return sat >= 0.45 && binOf(h, sat) === bin; });
  const missing = [...bins].filter(([bin]) => !covered(bin)).sort((a, b) => b[1].reduce((s, [, n]) => s + n, 0) - a[1].reduce((s, [, n]) => s + n, 0));
  for (const [, list] of missing) {
    const byLuma = [...list].sort((a, b) => luma(a[0]) - luma(b[0]));
    const third = (k: number) => byLuma.slice(Math.floor(byLuma.length * k / 3), Math.max(Math.floor(byLuma.length * k / 3) + 1, Math.floor(byLuma.length * (k + 1) / 3)));
    for (const k of [1, 0, 2]) { const best = third(k).sort((a, b) => b[1] - a[1])[0]; if (best) take(best[0]); }
  }
  // 3) 남은 칸은 다시 빈도 순.
  for (const [color] of ranked) { if (chosen.length >= limit) break; take(color); }
  return chosen.sort((a, b) => luma(a) - luma(b) || a - b).map(hex);
}

/** 빠진 색상을 채울 칸 수(팔레트 끝) */
const HUE_RESERVE = 12;
const HUE_BINS = 12;
/** 색상 칸 × 채도 단(0.45~0.7 · 0.7 이상) — 흙빛 황갈색이 있다고 금빛 노랑이 있는 것은 아니다 */
const binOf = (h: number, sat: number): number => (Math.floor(h * HUE_BINS) % HUE_BINS) * 2 + (sat >= 0.7 ? 1 : 0);
function hls(c: number): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, l, 0];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, l, s];
}

/** 그림 하나의 불투명 색 개수 — 같은 그림(시트 전체)은 한 번만 센다. */
const COLOR_COUNT_CACHE = new WeakMap<RgbaImage, Map<number, number>>();
function colorCounts(image: RgbaImage): Map<number, number> {
  const cached = COLOR_COUNT_CACHE.get(image);
  if (cached) return cached;
  const counts = new Map<number, number>();
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) continue;
    const color = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  COLOR_COUNT_CACHE.set(image, counts);
  return counts;
}

/** 가장 많이 칠해진 불투명 색 — 후보를 그 칩셋의 땅 위에 얹어 보여 줄 때 쓴다. */
export function dominantColor(image: RgbaImage): [number, number, number, 255] {
  const counts = new Map<number, number>();
  for (let i = 0; i < image.data.length; i += 16) {
    if (image.data[i + 3] !== 255) continue;
    const color = (image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best = 0x787878, most = -1;
  for (const [color, n] of counts) if (n > most) { best = color; most = n; }
  return [(best >> 16) & 255, (best >> 8) & 255, best & 255, 255];
}

/** 칸 번호 하나를 바탕 시트에서 찾는다. 이식 칸(시트 밖)이면 null. */
function tileOrigin(source: WorkshopTilesetSource, tile: number): { x: number; y: number } | null {
  const size = source.tileSize;
  const perRow = Math.max(1, source.tilesPerRow);
  const x = (tile % perRow) * size, y = Math.floor(tile / perRow) * size;
  return x + size <= source.image.width && y + size <= source.image.height ? { x, y } : null;
}

/** 물체 하나를 그림으로 겹쳐 그린다(아래층 → 위층). 시트 밖 칸이 하나라도 있으면 null. */
export function objectImage(source: WorkshopTilesetSource, object: WorkshopTilesetSource["objects"][number]): RgbaImage | null {
  const size = source.tileSize;
  const rows = Math.max(0, ...object.layers.map((layer) => layer.length));
  const columns = Math.max(0, ...object.layers.flatMap((layer) => layer.map((row) => row.length)));
  if (!rows || !columns || rows > 8 || columns > 8) return null;
  const width = columns * size, height = rows * size;
  const data = new Uint8ClampedArray(width * height * 4);
  let painted = false;
  for (const layer of object.layers) {
    for (let r = 0; r < layer.length; r++) {
      for (let c = 0; c < layer[r]!.length; c++) {
        const tile = layer[r]![c]!;
        if (tile < 0) continue;
        const origin = tileOrigin(source, tile);
        if (!origin) return null;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const from = ((origin.y + y) * source.image.width + origin.x + x) * 4;
            if (source.image.data[from + 3] === 0) continue;
            data.set(source.image.data.subarray(from, from + 4), ((r * size + y) * width + c * size + x) * 4);
            painted = true;
          }
        }
      }
    }
  }
  return painted ? { width, height, data } : null;
}

// 한글은 한 글자 낱말(돌·탑·꽃)도 뜻이 있다 — 영문만 두 글자 이상
const words = (text: string): string[] => text.toLowerCase().split(/[\s,.;:!?()[\]{}「」『』'"·/\\|~\-_]+/u).filter((w) => w.length >= 2 || /[^\x00-\x7f]/.test(w));

/**
 * 만들 기물과 닮은 물체를 고른다 — 이름·설명 낱말이 겹치는 것부터, 모자라면 여러 칸짜리 물체로 채운다.
 * 그림으로 그릴 수 있는 것(시트 안 칸만 쓰는 것)만.
 */
export function similarObjects(source: WorkshopTilesetSource, title: string, description: string, limit = 4, matchedOnly = false): { name: string; image: RgbaImage }[] {
  const wanted = new Set(words(`${title} ${description}`));
  const scored = source.objects.map((object, index) => {
    const hay = `${object.name} ${object.description}`.toLowerCase();
    let score = 0;
    for (const word of wanted) if (hay.includes(word)) score += 2;
    for (const word of words(object.name)) if (title.toLowerCase().includes(word)) score += 3;
    return { object, index, score };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const out: { name: string; image: RgbaImage }[] = [];
  const seen = new Set<string>();
  const take = (entry: (typeof scored)[number]): void => {
    if (out.length >= limit || seen.has(entry.object.name)) return;
    const image = objectImage(source, entry.object);
    if (!image) return;
    seen.add(entry.object.name);
    out.push({ name: entry.object.name, image });
  };
  for (const entry of scored) if (entry.score > 0) take(entry);
  if (matchedOnly) return out;
  for (const entry of scored) if (entry.object.layers.some((layer) => layer.length > 1 || (layer[0]?.length ?? 0) > 1)) take(entry);
  return out;
}

/** 시트에서 색이 가장 다양한 조각 하나(정사각, 한 변 최대 maxPx) — 물체가 학습돼 있지 않은 칩셋의 화풍 기준. */
export function sheetExcerpt(source: WorkshopTilesetSource, maxPx = 192): RgbaImage {
  // 같은 시트를 판마다 다시 훑지 않는다(큰 시트는 한 번에 수백 ms — 여러 판이 함께 돌면 편집기가 멈춘다).
  const cached = EXCERPT_CACHE.get(source.image)?.get(maxPx);
  if (cached) return cached;
  const excerpt = computeSheetExcerpt(source, maxPx);
  const perImage = EXCERPT_CACHE.get(source.image) ?? new Map<number, RgbaImage>();
  perImage.set(maxPx, excerpt);
  EXCERPT_CACHE.set(source.image, perImage);
  return excerpt;
}
const EXCERPT_CACHE = new WeakMap<RgbaImage, Map<number, RgbaImage>>();

function computeSheetExcerpt(source: WorkshopTilesetSource, maxPx: number): RgbaImage {
  const { image } = source;
  const side = Math.min(maxPx, image.width, image.height);
  const step = Math.max(source.tileSize, Math.floor(side / 2));
  let best = { x: 0, y: 0, score: -1 };
  for (let y = 0; y + side <= image.height; y += step) {
    for (let x = 0; x + side <= image.width; x += step) {
      const colors = new Set<number>();
      for (let sy = y; sy < y + side; sy += 3) {
        for (let sx = x; sx < x + side; sx += 3) {
          const i = (sy * image.width + sx) * 4;
          if (image.data[i + 3] === 255) colors.add((image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!);
        }
      }
      if (colors.size > best.score) best = { x, y, score: colors.size };
    }
  }
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) data.set(image.data.subarray(((best.y + y) * image.width + best.x) * 4, ((best.y + y) * image.width + best.x + side) * 4), y * side * 4);
  return { width: side, height: side, data };
}
