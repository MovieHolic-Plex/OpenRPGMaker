// 작은 맵의 바깥 여백 처리(2026-10-28).
//
// 작은 방을 화면에 채워도(playSceneCamera.smallMapFillZoom) 위아래·좌우에 반 칸 이상 여백이 남는다. 예전에는 그 여백이 순검정이라
//  1) 실내 칩셋의 천장(어두운 체크무늬) 띠가 방 둘레에서 검은 화면과 이어지지 않고 「마감 안 한 맵 바깥」처럼 보였고,
//  2) 맵 가장자리로 나가는 출구 통로가 검은 공간에서 일자로 끊겨 「덜 그린 맵」처럼 보였다(적대 VQA, standin escape·romance).
// 그래서 여백이 보이는 맵에서만
//  - 카메라 배경색을 맵 바깥 둘레(하층 타일)의 평균색으로 맞추고(어두운 색일 때만 — 밝은 들판이면 검정 유지),
//  - 둘레 타일 안에 결 없이 이어지는 반 칸 조각(천장 체크무늬)이 있으면 그 무늬로 여백 전체를 덮는다(2026-10-29).
//    평균색 단색만으로는 점무늬 천장 띠와 단색 여백의 경계가 「맵 바깥 빈 타일이 계단식으로 드러난다」로 읽혔다
//    (적대 VQA 네 판 20건: vm-smoke terra·mt3 argon/flash/terra). 같은 무늬가 화면 끝까지 이어지면 방을 둘러싼 천장으로 읽힌다.
//  - 맵 가장자리 줄에서 그 줄 대부분과 다른 하층 타일이고 안쪽 칸이 밟을 수 있는 칸(출구 통로 바닥·양옆 벽)을 바깥으로 몇 칸 이어 그린다.
// 맵 데이터는 바꾸지 않는다. 이어 그린 칸은 화면에만 있고 걸을 수 없다(카메라 경계 밖이 아니라 맵 밖이다).
import type Phaser from "phaser";
import { isPassable } from "@/project/collision";
import { mapTileSize } from "@/project/tileGeometry";
import { effectiveDarkness, normalizeLightingState } from "@/project/lightingRules";
import { store } from "@/project/store";
import { tilesetTextureKey } from "@/editor/tilesetImage";
import { MAP_BACKGROUND_LAYER_DEPTH } from "@/player/characterDepth";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { GameMap, TilesetDef } from "@/project/types";

/** 출구 통로를 바깥으로 이어 그리는 칸 수. 여백이 이보다 넓어도 그 뒤는 배경색이다. */
const SKIRT_TILES = 8;
/** 바깥으로 잇는 출구 토막의 최대 칸 수. */
const MAX_EXIT_RUN = 4;
/** 둘레 평균색이 이보다 밝으면(상대 밝기) 배경색으로 쓰지 않는다 — 밝은 들판·눈밭 둘레가 화면 전체를 칠하지 않게. */
const BACKDROP_MAX_LUMA = 0.32;
const DEFAULT_BACKDROP = "#000000";

const skirts = new WeakMap<object, Phaser.GameObjects.Container>();
const tileColorCache = new Map<string, [number, number, number] | null>();

type FramePixel = { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number };
const framePixelCache = new Map<string, { readonly data: Uint8ClampedArray; readonly w: number; readonly h: number } | null>();
/**
 * 타일 프레임 안 한 화소. 프레임마다 한 번 작은 캔버스에 그려 읽고 캐시한다.
 * Phaser textures.getPixel 은 화소마다 그리고 읽어 느리고, 원본이 ImageBitmap(워커에서 구운 이식 아틀라스)이면 null 만 준다.
 */
function pixelAt(scene: SkirtScene, x: number, y: number, textureKey: string, frameName: string): FramePixel | null {
  const cacheKey = `${textureKey}|${frameName}`;
  let pixels = framePixelCache.get(cacheKey);
  if (pixels === undefined) {
    pixels = null;
    const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
    const frame = texture?.has(frameName) ? texture.get(frameName) : undefined;
    if (frame) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
          pixels = { data: context.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data, w: frame.cutWidth, h: frame.cutHeight };
        }
      } catch { pixels = null; }
      framePixelCache.set(cacheKey, pixels);
    }
  }
  if (!pixels || x < 0 || y < 0 || x >= pixels.w || y >= pixels.h) return null;
  const at = (Math.floor(y) * pixels.w + Math.floor(x)) * 4;
  return { red: pixels.data[at]!, green: pixels.data[at + 1]!, blue: pixels.data[at + 2]!, alpha: pixels.data[at + 3]! };
}

type SkirtScene = Pick<PlaySceneContext, "map" | "cameras" | "add" | "textures" | "session"> & {
  readonly resolveTilesetTexture?: (tileset: TilesetDef) => string;
};

export function syncMapSkirt(scene: SkirtScene): void {
  skirts.get(scene)?.destroy(true);
  skirts.delete(scene);
  const camera = scene.cameras?.main;
  const map = scene.map;
  if (!camera || !map) return;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  const size = mapTileSize(map);
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const marginX = camera.width / zoom > map.width * size;
  const marginY = camera.height / zoom > map.height * size;
  // 배경 그림(파노라마)이 있는 맵은 그 그림이 여백을 맡는다. 여백이 안 보이는 맵은 손대지 않는다.
  if (!tileset || map.background || (!marginX && !marginY)) {
    camera.setBackgroundColor(DEFAULT_BACKDROP);
    return;
  }
  const textureKey = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  const backdrop = backdropColor(scene, map, textureKey);
  camera.setBackgroundColor(backdrop);
  const container = scene.add.container(0, 0);
  container.setDepth(MAP_BACKGROUND_LAYER_DEPTH + 2);
  if (backdrop !== DEFAULT_BACKDROP) {
    const fill = ceilingFillFrame(scene, map, textureKey);
    if (fill) {
      // 무늬 판은 맵 칸 격자에 맞춰 놓는다(반 칸 조각이 칸 원점에서 잘렸으므로 무늬 위상이 맵 둘레와 이어진다).
      const viewWidth = camera.width / zoom, viewHeight = camera.height / zoom;
      const pad = Math.ceil(Math.max(viewWidth, viewHeight) / size + 2) * size;
      const pattern = scene.add.tileSprite(-pad, -pad, map.width * size + pad * 2, map.height * size + pad * 2, textureKey, fill);
      pattern.setOrigin(0, 0);
      const tint = darknessTint(scene);
      if (tint !== undefined) pattern.setTint(tint);
      // 맵 칸(하층 depth 0) 아래, 이어 그린 출구 칸(+2) 아래.
      pattern.setDepth(MAP_BACKGROUND_LAYER_DEPTH + 1);
      const covers = coverEdgeOutlines(scene, map, textureKey, fill, size, tint);
      container.once("destroy", () => { pattern.destroy(); for (const cover of covers) cover.destroy(); });
    }
  }
  const project = store.getCurrent();
  const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
  const draw = (x: number, y: number, tile: number): void => {
    if (tile < 0 || !texture?.has(`tile_${tile}`)) return;
    const image = scene.add.image(x * size, y * size, textureKey, `tile_${tile}`);
    image.setOrigin(0, 0);
    container.add(image);
  };
  const lower = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? -1;
  const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y);
  // 가장자리 줄에서 출구 칸 찾기: 그 줄의 대부분(천장·벽 띠)과 다른 하층 타일이고 바로 안쪽 칸이 밟을 수 있는 칸.
  // 출구 칸 자체는 문 그림(상층) 때문에 막힘일 수 있어 통행으로 보지 않는다. 통로 바닥과 양옆 벽 칸이 같이 잡힌다.
  // 찾은 칸의 하층 타일을 바깥 방향 (dx,dy) 로 이어 그린다.
  const extendEdge = (cells: readonly { x: number; y: number }[], dx: number, dy: number): void => {
    const counts = new Map<number, number>();
    for (const cell of cells) counts.set(lower(cell.x, cell.y), (counts.get(lower(cell.x, cell.y)) ?? 0) + 1);
    const dominant = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    const picked = cells.map((cell) => {
      const tile = lower(cell.x, cell.y);
      // 이어 붙여도 이음매가 안 보이는 타일만 잇는다 — 벽 모서리 조각(테두리 선)을 옆으로 반복하면 창살 같은 줄무늬가 됐다.
      // 출구 타일은 그 가장자리에 드물다(넉 칸 이하). 같은 벽 조각이 길게 이어진 옆벽은 가구에 끊겨 짧은 토막이 돼도 출구가 아니다.
      return tile !== dominant && (counts.get(tile) ?? 0) <= MAX_EXIT_RUN && open(cell.x - dx, cell.y - dy) && tileSeamless(scene, textureKey, tile, dx !== 0 ? "x" : "y");
    });
    // 출구는 좁은 토막이다(통로 바닥 + 양옆 벽, 넉 칸까지). 긴 토막은 ㄱ자 방의 옆벽 같은 것이라 잇지 않는다(마법학교 기숙사 동쪽 벽이 창살처럼 이어졌다).
    for (let start = 0; start < cells.length; start += 1) {
      if (!picked[start]) continue;
      let end = start;
      while (end + 1 < cells.length && picked[end + 1]) end += 1;
      if (end - start + 1 <= MAX_EXIT_RUN) {
        for (let index = start; index <= end; index += 1) {
          const cell = cells[index]!;
          const tile = lower(cell.x, cell.y);
          for (let step = 1; step <= SKIRT_TILES; step += 1) draw(cell.x + dx * step, cell.y + dy * step, tile);
        }
      }
      start = end;
    }
  };
  const column = (x: number) => Array.from({ length: map.height }, (_, y) => ({ x, y }));
  const row = (y: number) => Array.from({ length: map.width }, (_, x) => ({ x, y }));
  if (marginY) {
    extendEdge(row(0), 0, -1);
    extendEdge(row(map.height - 1), 0, 1);
  }
  if (marginX) {
    extendEdge(column(0), -1, 0);
    extendEdge(column(map.width - 1), 1, 0);
  }
  skirts.set(scene, container);
}

/**
 * 여백을 덮을 반 칸 무늬 조각. 둘레에서 가장 흔한 하층 타일들의 네 사분면 가운데
 *  - 줄·열 평균이 고르고(테두리 선·벽 모서리가 없음),
 *  - 맞은편 끝 줄끼리 붙여도 안쪽 이웃 줄만큼만 다르면(반복해도 이음매가 없음)
 * 그 조각을 텍스처 프레임으로 더해 이름을 돌려준다. 없으면 undefined(평균색 단색 그대로).
 */
function ceilingFillFrame(scene: SkirtScene, map: GameMap, textureKey: string): string | undefined {
  const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
  if (!texture) return undefined;
  const counts = new Map<number, number>();
  const count = (x: number, y: number): void => {
    const tile = map.lowerTiles[y * map.width + x] ?? -1;
    if (tile >= 0) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  };
  for (let x = 0; x < map.width; x += 1) { count(x, 0); if (map.height > 1) count(x, map.height - 1); }
  for (let y = 1; y < map.height - 1; y += 1) { count(0, y); if (map.width > 1) count(map.width - 1, y); }
  const tiles = [...counts].sort((a, b) => b[1] - a[1]).map(([tile]) => tile).slice(0, 4);
  for (const tile of tiles) {
    const frameName = `tile_${tile}`;
    if (!texture.has(frameName)) continue;
    const frame = texture.get(frameName);
    const half = Math.floor(Math.min(frame.width, frame.height) / 2);
    if (half < 2) continue;
    for (const [qx, qy] of [[1, 1], [0, 1], [1, 0], [0, 0]] as const) {
      const name = `skirt_fill_${tile}_${qx}${qy}`;
      const verdict = fillCache.get(`${textureKey}|${name}`);
      if (verdict === false) continue;
      if (verdict === undefined) {
        const ok = patchTilesCleanly(scene, textureKey, frameName, qx * half, qy * half, half);
        fillCache.set(`${textureKey}|${name}`, ok);
        if (!ok) continue;
      }
      if (!texture.has(name)) texture.add(name, frame.sourceIndex, frame.cutX + qx * half, frame.cutY + qy * half, half, half);
      return name;
    }
  }
  return undefined;
}

/**
 * 천장 둘레 타일의 바깥 끝 1px 테두리 선을 무늬로 덮는다. 무늬가 여백까지 이어져도 그 선이 남아 맵 둘레에 사각 틀이 그려졌다.
 * 바깥 끝 줄만 무늬와 다르고 바로 안쪽 줄은 무늬와 같은 칸만 덮는다(벽 면·출구 바닥은 둘째 줄부터 무늬가 아니라 손대지 않는다).
 */
function coverEdgeOutlines(scene: SkirtScene, map: GameMap, textureKey: string, fill: string, size: number, tint: number | undefined): Phaser.GameObjects.TileSprite[] {
  const fillLuma = frameLuma(scene, textureKey, fill);
  if (fillLuma === undefined) return [];
  const covers: Phaser.GameObjects.TileSprite[] = [];
  const edges: { cells: { x: number; y: number }[]; side: "top" | "bottom" | "left" | "right" }[] = [
    { cells: Array.from({ length: map.width }, (_, x) => ({ x, y: 0 })), side: "top" },
    { cells: Array.from({ length: map.width }, (_, x) => ({ x, y: map.height - 1 })), side: "bottom" },
    { cells: Array.from({ length: map.height }, (_, y) => ({ x: 0, y })), side: "left" },
    { cells: Array.from({ length: map.height }, (_, y) => ({ x: map.width - 1, y })), side: "right" },
  ];
  for (const { cells, side } of edges) {
    for (const cell of cells) {
      const tile = map.lowerTiles[cell.y * map.width + cell.x] ?? -1;
      if (tile < 0 || !outlineOnly(scene, textureKey, tile, side, fillLuma)) continue;
      const x = cell.x * size + (side === "right" ? size - 1 : 0);
      const y = cell.y * size + (side === "bottom" ? size - 1 : 0);
      const vertical = side === "left" || side === "right";
      const cover = scene.add.tileSprite(x, y, vertical ? 1 : size, vertical ? size : 1, textureKey, fill);
      cover.setOrigin(0, 0);
      // 무늬 위상을 맵 격자에 맞춘다(덮개 원점이 칸 원점에서 1px 밀린 오른쪽·아래 끝).
      cover.tilePositionX = side === "right" ? size - 1 : 0;
      cover.tilePositionY = side === "bottom" ? size - 1 : 0;
      if (tint !== undefined) cover.setTint(tint);
      // 하층(0)·그림자(0.02) 위, 상층 「o」 타일(첫 줄 depth 1) 아래.
      cover.setDepth(0.5);
      covers.push(cover);
    }
  }
  return covers;
}

const outlineCache = new Map<string, boolean>();

function outlineOnly(scene: SkirtScene, textureKey: string, tile: number, side: "top" | "bottom" | "left" | "right", fillLuma: number): boolean {
  const key = `${textureKey}|${tile}|${side}`;
  const cached = outlineCache.get(key);
  if (cached !== undefined) return cached;
  const frameName = `tile_${tile}`;
  const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
  const frame = texture?.has(frameName) ? texture.get(frameName) : undefined;
  if (!frame) return false;
  const length = side === "top" || side === "bottom" ? frame.width : frame.height;
  const depth = side === "top" || side === "bottom" ? frame.height : frame.width;
  const lineLuma = (offset: number): number | undefined => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      const along = i;
      const across = side === "top" || side === "left" ? offset : depth - 1 - offset;
      const color = side === "top" || side === "bottom"
        ? pixelAt(scene, along, across, textureKey, frameName)
        : pixelAt(scene, across, along, textureKey, frameName);
      if (!color || color.alpha < 250) return undefined;
      sum += 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue;
    }
    return sum / length;
  };
  const outer = lineLuma(0), next = lineLuma(1), third = lineLuma(2);
  const near = (value: number | undefined) => value !== undefined && Math.abs(value - fillLuma) <= FILL_LINE_MAX_DEVIATION;
  const result = outer !== undefined && Math.abs(outer - fillLuma) > OUTLINE_MIN_DIFF && near(next) && near(third);
  outlineCache.set(key, result);
  return result;
}

function frameLuma(scene: SkirtScene, textureKey: string, frameName: string): number | undefined {
  const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
  const frame = texture?.has(frameName) ? texture.get(frameName) : undefined;
  if (!frame) return undefined;
  let sum = 0, n = 0;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const color = pixelAt(scene, x, y, textureKey, frameName);
      if (!color) continue;
      sum += 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue; n += 1;
    }
  }
  return n > 0 ? sum / n : undefined;
}

const fillCache = new Map<string, boolean>();
/** 무늬 조각 판정 상한 — 줄 평균이 조각 평균에서 벗어나도 되는 정도(0~255). 천장 체크무늬는 줄 평균이 같고, 어두운 1px 선 한 줄은 약 9 벗어난다(밀실 판 실측). */
const FILL_LINE_MAX_DEVIATION = 4;
/** 테두리 선으로 볼 최소 차이(줄 평균 대 무늬 평균). */
const OUTLINE_MIN_DIFF = 6;

function patchTilesCleanly(scene: SkirtScene, textureKey: string, frameName: string, ox: number, oy: number, size: number): boolean {
  const px: number[][] = [];
  for (let y = 0; y < size; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < size; x += 1) {
      const color = pixelAt(scene, ox + x, oy + y, textureKey, frameName);
      if (!color || color.alpha < 250) return false;
      row.push(0.299 * color.red + 0.587 * color.green + 0.114 * color.blue);
    }
    px.push(row);
  }
  const mean = px.flat().reduce((sum, value) => sum + value, 0) / (size * size);
  if (mean / 255 > BACKDROP_MAX_LUMA) return false;
  const rowMeans = px.map((row) => row.reduce((sum, value) => sum + value, 0) / size);
  const colMeans = Array.from({ length: size }, (_, x) => px.reduce((sum, row) => sum + row[x]!, 0) / size);
  if ([...rowMeans, ...colMeans].some((value) => Math.abs(value - mean) > FILL_LINE_MAX_DEVIATION)) return false;
  // 이어 붙인 자리(끝 열→첫 열)가 안쪽 이웃 열 차이보다 크게 튀지 않아야 한다.
  const columnDiff = (a: number, b: number) => px.reduce((sum, row) => sum + Math.abs(row[a]! - row[b]!), 0) / size;
  const rowDiff = (a: number, b: number) => px[a]!.reduce((sum, value, x) => sum + Math.abs(value - px[b]![x]!), 0) / size;
  let innerX = 0, innerY = 0;
  for (let i = 0; i + 1 < size; i += 1) { innerX += columnDiff(i, i + 1); innerY += rowDiff(i, i + 1); }
  innerX /= size - 1; innerY /= size - 1;
  return columnDiff(size - 1, 0) <= innerX * 1.5 + 6 && rowDiff(size - 1, 0) <= innerY * 1.5 + 6;
}

/** 방의 어둠 막을 무늬 판에 곱할 색(어둠이 없으면 undefined). backdropColor 와 같은 섞기를 흰색에 한 값이다. */
function darknessTint(scene: SkirtScene): number | undefined {
  const lighting = normalizeLightingState(scene.session?.lighting);
  if (!(lighting.ambient > 0)) return undefined;
  const darkness = effectiveDarkness(lighting.color, lighting.ambient);
  const mask = /^#([0-9a-f]{6})$/iu.exec(darkness.color);
  const m = mask ? Number.parseInt(mask[1]!, 16) : 0;
  const channel = (shift: number) => Math.round(255 * (1 - darkness.ambient) + ((m >> shift) & 255) * darkness.ambient);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** 맵 바깥 둘레 하층 타일의 평균색(어둠 막을 입힌 색). 밝으면 검정. */
function backdropColor(scene: SkirtScene, map: GameMap, textureKey: string): string {
  let r = 0, g = 0, b = 0, n = 0;
  const add = (x: number, y: number): void => {
    const tile = map.lowerTiles[y * map.width + x] ?? -1;
    if (tile < 0) return;
    const color = tileColor(scene, textureKey, tile);
    if (!color) return;
    r += color[0]; g += color[1]; b += color[2]; n += 1;
  };
  for (let x = 0; x < map.width; x += 1) { add(x, 0); if (map.height > 1) add(x, map.height - 1); }
  for (let y = 1; y < map.height - 1; y += 1) { add(0, y); if (map.width > 1) add(map.width - 1, y); }
  if (n === 0) return DEFAULT_BACKDROP;
  let rgb: [number, number, number] = [r / n, g / n, b / n];
  if ((0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > BACKDROP_MAX_LUMA) return DEFAULT_BACKDROP;
  // 방에 어둠 막이 있으면 여백도 같은 만큼 어둡게 — 어두운 방 둘레만 환하게 뜨지 않게.
  const lighting = normalizeLightingState(scene.session?.lighting);
  if (lighting.ambient > 0) {
    const darkness = effectiveDarkness(lighting.color, lighting.ambient);
    const mask = /^#([0-9a-f]{6})$/iu.exec(darkness.color);
    const m = mask ? Number.parseInt(mask[1]!, 16) : 0;
    const maskRgb = [(m >> 16) & 255, (m >> 8) & 255, m & 255];
    rgb = rgb.map((channel, i) => channel * (1 - darkness.ambient) + maskRgb[i]! * darkness.ambient) as [number, number, number];
  }
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** 타일 한 칸의 평균색(5×5 표본). 텍스처가 아직 없거나 투명하면 null. */
function tileColor(scene: SkirtScene, textureKey: string, tile: number): [number, number, number] | null {
  const key = `${textureKey}|${tile}`;
  if (tileColorCache.has(key)) return tileColorCache.get(key)!;
  let result: [number, number, number] | null = null;
  const frameName = `tile_${tile}`;
  const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
  const frame = texture?.has(frameName) ? texture.get(frameName) : undefined;
  if (frame) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = 0; sy < 5; sy += 1) {
      for (let sx = 0; sx < 5; sx += 1) {
        const px = Math.floor(((sx + 0.5) / 5) * frame.width);
        const py = Math.floor(((sy + 0.5) / 5) * frame.height);
        const color = pixelAt(scene, px, py, textureKey, frameName);
        if (!color || color.alpha < 128) continue;
        r += color.red; g += color.green; b += color.blue; n += 1;
      }
    }
    if (n > 0) result = [r / n, g / n, b / n];
  }
  if (frame) tileColorCache.set(key, result);
  return result;
}

const seamCache = new Map<string, boolean>();

/**
 * 타일을 axis 방향으로 이어 붙였을 때 이음매가 안 보이는가 — 양 끝 줄(가로면 왼·오른 열, 세로면 위·아래 행) 화소의 평균 차이가 작다.
 * 바닥 타일은 통과하고, 한쪽에만 테두리 선이 있는 벽 모서리 조각은 떨어진다.
 */
function tileSeamless(scene: SkirtScene, textureKey: string, tile: number, axis: "x" | "y"): boolean {
  const key = `${textureKey}|${tile}|${axis}`;
  const cached = seamCache.get(key);
  if (cached !== undefined) return cached;
  const frameName = `tile_${tile}`;
  const texture = scene.textures.exists(textureKey) ? scene.textures.get(textureKey) : undefined;
  const frame = texture?.has(frameName) ? texture.get(frameName) : undefined;
  if (!frame) return false;
  const samples = 8;
  let diff = 0, n = 0;
  for (let i = 0; i < samples; i += 1) {
    const along = Math.floor(((i + 0.5) / samples) * (axis === "x" ? frame.height : frame.width));
    const a = axis === "x" ? pixelAt(scene, 0, along, textureKey, frameName) : pixelAt(scene, along, 0, textureKey, frameName);
    const b = axis === "x" ? pixelAt(scene, frame.width - 1, along, textureKey, frameName) : pixelAt(scene, along, frame.height - 1, textureKey, frameName);
    if (!a || !b) continue;
    diff += (Math.abs(a.red - b.red) + Math.abs(a.green - b.green) + Math.abs(a.blue - b.blue)) / 3;
    n += 1;
  }
  const result = n > 0 && diff / n <= SEAM_MAX_DIFF;
  seamCache.set(key, result);
  return result;
}

/** 이음매 판정 상한(채널 평균 차이, 0~255). */
const SEAM_MAX_DIFF = 28;
