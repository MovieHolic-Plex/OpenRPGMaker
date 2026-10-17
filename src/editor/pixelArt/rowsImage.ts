// 조수가 «행 문자열 + 팔레트»로 직접 찍은 도트를 이미지로 바꾼다. 순수 함수(브라우저 전역 없음).
// 문자 하나 = 화소 하나, '.' = 투명. 모델이 그림을 «쓰는» 입구라서 검증은 모델이 바로 고칠 수 있는 한국어 문장으로 낸다.
import type { RgbaImage } from "@/editor/cutsceneArt/imageProcess";

export type Rgba = readonly [number, number, number, number];
export type PixelPalette = ReadonlyMap<string, Rgba>;

export class PixelArtError extends Error {}

const MAX_COLORS = 40;

export function parsePalette(raw: unknown): PixelPalette {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new PixelArtError("palette 는 {문자: '#rrggbb'} 객체여야 합니다(예: {\"k\":\"#1b1b26\",\"a\":\"#6e7f9c\"}). '.' 는 투명이라 팔레트에 넣지 않습니다.");
  const map = new Map<string, Rgba>();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if ([...key].length !== 1 || key === "." || key === " ") throw new PixelArtError(`palette 의 키는 '.'·공백이 아닌 글자 하나여야 합니다(받은 키: "${key}").`);
    const m = typeof value === "string" ? /^#?([0-9a-f]{6})([0-9a-f]{2})?$/iu.exec(value.trim()) : null;
    if (!m) throw new PixelArtError(`palette["${key}"] 는 '#rrggbb' 색이어야 합니다(받은 값: ${String(value)}).`);
    const n = parseInt(m[1]!, 16);
    map.set(key, [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) : 255]);
  }
  if (map.size === 0) throw new PixelArtError("palette 가 비어 있습니다.");
  if (map.size > MAX_COLORS) throw new PixelArtError(`palette 가 ${map.size}색입니다 — 도트는 ${MAX_COLORS}색 이하로 쓰세요(한 재질은 어두운 선·그림자·바탕·밝은 면·하이라이트 4~6단이면 충분합니다).`);
  return map;
}

export function parseRows(raw: unknown, field: string): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.some((row) => typeof row !== "string")) throw new PixelArtError(`${field} 는 같은 길이의 문자열 배열이어야 합니다(한 줄 = 화소 한 행).`);
  const rows = (raw as string[]).map((row) => [...row].join(""));
  const width = [...rows[0]!].length;
  rows.forEach((row, y) => { if ([...row].length !== width) throw new PixelArtError(`${field}[${y}] 의 길이가 ${[...row].length}입니다 — 모든 줄이 ${width}글자여야 합니다.`); });
  return rows;
}

export function rowsToImage(rows: readonly string[], palette: PixelPalette, field: string): RgbaImage {
  const height = rows.length, width = [...rows[0]!].length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || ch === " ") return;
      const color = palette.get(ch);
      if (!color) throw new PixelArtError(`${field}[${y}] 의 ${x + 1}번째 글자 '${ch}' 가 palette 에 없습니다.`);
      data.set(color, (y * width + x) * 4);
    });
  });
  return { width, height, data };
}

export interface ArtStats {
  readonly opaque: number;
  readonly coverage: number;
  readonly colors: number;
  readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } | null;
}

export function artStats(image: RgbaImage): ArtStats {
  let opaque = 0, x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
  const colors = new Set<number>();
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    const i = (y * image.width + x) * 4;
    if (image.data[i + 3] === 0) continue;
    opaque += 1;
    colors.add((image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!);
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { opaque, coverage: opaque / Math.max(1, image.width * image.height), colors: colors.size, bounds: x1 < 0 ? null : { x0, y0, x1, y1 } };
}

/** 캔버스를 칸(tile) 배수로 늘린다 — 가로는 가운데, 세로는 위쪽을 투명으로 채워 발밑(맨 아래)을 지킨다. */
export function padToTiles(image: RgbaImage, tile: number): { image: RgbaImage; padTop: number } {
  const width = Math.ceil(image.width / tile) * tile, height = Math.ceil(image.height / tile) * tile;
  if (width === image.width && height === image.height) return { image, padTop: 0 };
  const left = Math.floor((width - image.width) / 2), top = height - image.height;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < image.height; y += 1) data.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), ((y + top) * width + left) * 4);
  return { image: { width, height, data }, padTop: top };
}

/** 완전히 투명하지 않은 tile×tile 칸을 잘라 낸다(dx, dy = 칸 좌표). */
export function sliceTiles(image: RgbaImage, tile: number): { dx: number; dy: number; pixels: Uint8ClampedArray }[] {
  const out: { dx: number; dy: number; pixels: Uint8ClampedArray }[] = [];
  for (let dy = 0; dy < image.height / tile; dy += 1) for (let dx = 0; dx < image.width / tile; dx += 1) {
    const pixels = new Uint8ClampedArray(tile * tile * 4);
    let any = false;
    for (let y = 0; y < tile; y += 1) for (let x = 0; x < tile; x += 1) {
      const from = ((dy * tile + y) * image.width + dx * tile + x) * 4;
      if (image.data[from + 3] === 0) continue;
      any = true;
      pixels.set(image.data.subarray(from, from + 4), (y * tile + x) * 4);
    }
    if (any) out.push({ dx, dy, pixels });
  }
  return out;
}

/** 칸들을 perRow 칸 폭 시트 한 장으로 늘어놓는다. */
export function tilesToSheet(tiles: readonly { pixels: Uint8ClampedArray }[], tile: number, perRow: number): RgbaImage {
  const rows = Math.max(1, Math.ceil(tiles.length / perRow));
  const width = perRow * tile, height = rows * tile;
  const data = new Uint8ClampedArray(width * height * 4);
  tiles.forEach((t, k) => {
    const ox = (k % perRow) * tile, oy = Math.floor(k / perRow) * tile;
    for (let y = 0; y < tile; y += 1) data.set(t.pixels.subarray(y * tile * 4, (y + 1) * tile * 4), ((oy + y) * width + ox) * 4);
  });
  return { width, height, data };
}

/** 모델이 자기 그림을 «눈으로» 검수하도록 키운 미리보기(최근접, 체크무늬 바탕). */
export function previewImage(image: RgbaImage, scale: number, bg: Rgba = [96, 112, 104, 255]): RgbaImage {
  const width = image.width * scale, height = image.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const sx = Math.floor(x / scale), sy = Math.floor(y / scale), i = (sy * image.width + sx) * 4, o = (y * width + x) * 4;
    const checker = ((Math.floor(x / (scale * 4)) + Math.floor(y / (scale * 4))) & 1) === 0;
    const a = image.data[i + 3]! / 255;
    for (let c = 0; c < 3; c += 1) data[o + c] = Math.round(image.data[i + c]! * a + (bg[c]! + (checker ? 0 : 14)) * (1 - a));
    data[o + 3] = 255;
  }
  return { width, height, data };
}

/** 발밑 줄(캔버스 맨 아래)에 칠한 화소가 있는가. */
export function touchesBottom(image: RgbaImage): boolean {
  const y = image.height - 1;
  for (let x = 0; x < image.width; x += 1) if (image.data[(y * image.width + x) * 4 + 3]! > 0) return true;
  return false;
}

export function flipHorizontal(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) data.set(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4), (y * image.width + (image.width - 1 - x)) * 4);
  return { width: image.width, height: image.height, data };
}

function shifted(image: RgbaImage, y0: number, y1: number, x0: number, x1: number, dy: number): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data.fill(0, (y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
    const ty = y + dy;
    if (ty < 0 || ty >= image.height) continue;
    const from = (y * image.width + x) * 4;
    if (image.data[from + 3] === 0) continue;
    data.set(image.data.subarray(from, from + 4), (ty * image.width + x) * 4);
  }
  return { width: image.width, height: image.height, data };
}

/** 서 있는 그림 한 장에서 걷기 두 프레임을 만든다: 아래 1/3(다리)의 한쪽 절반을 lift px(기본 1) 들어 올린다. 큰 기계는 lift 를 키운다. */
export function autoWalkFrames(stand: RgbaImage, liftPx = 1): [RgbaImage, RgbaImage] {
  const legTop = Math.floor(stand.height * 0.68), mid = Math.floor(stand.width / 2);
  const lift = (left: boolean): RgbaImage => shifted(stand, legTop, stand.height, left ? 0 : mid, left ? mid : stand.width, -Math.max(1, liftPx));
  return [lift(true), lift(false)];
}
