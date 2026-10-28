// 작은 맵의 바깥 여백 처리(2026-10-28).
//
// 작은 방을 화면에 채워도(playSceneCamera.smallMapFillZoom) 위아래·좌우에 반 칸 이상 여백이 남는다. 예전에는 그 여백이 순검정이라
//  1) 실내 칩셋의 천장(어두운 체크무늬) 띠가 방 둘레에서 검은 화면과 이어지지 않고 「마감 안 한 맵 바깥」처럼 보였고,
//  2) 맵 가장자리로 나가는 출구 통로가 검은 공간에서 일자로 끊겨 「덜 그린 맵」처럼 보였다(적대 VQA, standin escape·romance).
// 그래서 여백이 보이는 맵에서만
//  - 카메라 배경색을 맵 바깥 둘레(하층 타일)의 평균색으로 맞추고(어두운 색일 때만 — 밝은 들판이면 검정 유지),
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
  camera.setBackgroundColor(backdropColor(scene, map, textureKey));
  const container = scene.add.container(0, 0);
  container.setDepth(MAP_BACKGROUND_LAYER_DEPTH + 2);
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
        const color = scene.textures.getPixel(px, py, textureKey, frameName);
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
    const a = axis === "x" ? scene.textures.getPixel(0, along, textureKey, frameName) : scene.textures.getPixel(along, 0, textureKey, frameName);
    const b = axis === "x" ? scene.textures.getPixel(frame.width - 1, along, textureKey, frameName) : scene.textures.getPixel(along, frame.height - 1, textureKey, frameName);
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
