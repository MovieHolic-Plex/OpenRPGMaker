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
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] !== 255) continue;
      const color = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      counts.set(color, (counts.get(color) ?? 0) + weight);
    }
  }
  const chosen: number[] = [];
  for (const [color] of [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    if (chosen.length >= limit) break;
    if (chosen.some((other) => distance(other, color) <= NEAR)) continue;
    chosen.push(color);
  }
  return chosen.sort((a, b) => luma(a) - luma(b) || a - b).map(hex);
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
export function similarObjects(source: WorkshopTilesetSource, title: string, description: string, limit = 4): { name: string; image: RgbaImage }[] {
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
  for (const entry of scored) if (entry.object.layers.some((layer) => layer.length > 1 || (layer[0]?.length ?? 0) > 1)) take(entry);
  return out;
}

/** 시트에서 색이 가장 다양한 조각 하나(정사각, 한 변 최대 maxPx) — 물체가 학습돼 있지 않은 칩셋의 화풍 기준. */
export function sheetExcerpt(source: WorkshopTilesetSource, maxPx = 192): RgbaImage {
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
