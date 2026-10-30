import type Phaser from "phaser";
import { store } from "@/project/store";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { layerTileAt } from "@/project/mapLayers";
import { tilesetTextureKey } from "@/editor/tilesetImage";
import { isAlwaysAboveCharacterUpperTile, MAP_UPPER_LAYER_DEPTH, starRestsOnSolidFurniture } from "@/player/characterDepth";
import type { GameMap, TilesetDef } from "@/project/types";

/**
 * 주인공이 ★ 기물(지구본 윗부분·책장 위 칸·나무 수관처럼 늘 캐릭터 위에 그려지는 위층 칸) 뒤로 들어가 몸이 거의 가려지면
 * 반투명 실루엣을 그 위에 겹쳐 그린다.
 *
 * 왜: 3/4 깊이 규칙은 맞게 돌고 있었다 — 위층 ★ 칸은 원래 캐릭터 위에 그린다(RM2K3 ★). 그런데 책장과 지구본 사이 한 칸처럼
 * 북쪽이 막힌 ★ 칸에 들어가면 머리만 남고 몸이 사라져 판정자가 「가구 안에 박혔다」로 읽었다
 * (2026-10-29 vm4 terra/escape 10-afterload, vm5 flash/escape 08-a1b, depth-overlap 시나리오로 재현: 지구본 윗칸 ★ 이 주인공 몸 칸을 덮음).
 * 충돌 규칙을 바꾸면 처마 밑 길·숲 가장자리처럼 일부러 뒤로 지나가는 곳이 막히므로 그림만 고친다.
 *
 * 몸 칸(주인공 발 칸)의 ★ 칸 불투명 화소 비율이 0.35 이상이거나, 몸·머리 칸(그 위 칸)을 6:4 로 더해 0.45 이상이면 실루엣을 켠다 — 꽃·풀 같은 작은 ★ 는 켜지 않는다.
 * 계산은 주인공 칸이 바뀔 때만, 칸 그림의 불투명 비율은 텍스처·칸 번호마다 한 번만 읽는다.
 */
const GHOST_ALPHA = 0.5;
const COVER_THRESHOLD = 0.45;
/** 몸 칸 하나만 이만큼 덮여도 켠다 — 지구본 공처럼 칸의 절반쯤 차는 ★ 그림이 몸통을 통째로 가린다. */
const BODY_THRESHOLD = 0.35;
const BODY_WEIGHT = 0.6;
const HEAD_WEIGHT = 0.4;

type GhostScene = {
  readonly map?: GameMap;
  readonly player?: Phaser.GameObjects.Sprite;
  readonly tileX: number;
  readonly tileY: number;
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly textures: Phaser.Textures.TextureManager;
  resolveTilesetTexture?(tileset: TilesetDef): string;
};

type GhostState = { sprite: Phaser.GameObjects.Sprite | null; cellKey: string; map: GameMap | undefined; covered: boolean };
const states = new WeakMap<object, GhostState>();
const opacityCache = new Map<string, number>();
let scratch: CanvasRenderingContext2D | null = null;

export function syncPlayerOcclusionGhost(scene: GhostScene): void {
  const player = scene.player;
  const map = scene.map;
  let state = states.get(scene);
  if (!state) { state = { sprite: null, cellKey: "", map: undefined, covered: false }; states.set(scene, state); }
  if (!player || !map || !player.active) { hide(state); return; }
  const cellKey = `${scene.tileX},${scene.tileY}`;
  if (state.map !== map || state.cellKey !== cellKey) {
    state.map = map;
    state.cellKey = cellKey;
    const cover = playerCoverage(scene, map, scene.tileX, scene.tileY);
    state.covered = cover.body >= BODY_THRESHOLD || cover.weighted >= COVER_THRESHOLD;
    // 런타임 QA(depth-overlap 시나리오)가 읽는다.
    (scene as { playerOcclusion?: unknown }).playerOcclusion = { cell: cellKey, ...cover, ghost: state.covered };
  }
  if (!state.covered || !player.visible || player.alpha < 0.05) { hide(state); return; }
  let ghost = state.sprite;
  if (!ghost || !ghost.active) {
    ghost = scene.add.sprite(player.x, player.y, player.texture.key, player.frame.name);
    ghost.setName("player-occlusion-ghost");
    state.sprite = ghost;
  }
  if (ghost.texture.key !== player.texture.key || ghost.frame.name !== player.frame.name) ghost.setTexture(player.texture.key, player.frame.name);
  ghost.setPosition(player.x, player.y);
  ghost.setOrigin(player.originX, player.originY);
  ghost.setScale(player.scaleX, player.scaleY);
  ghost.setFlip(player.flipX, player.flipY);
  // ★ 위층 그릇(250k) 바로 위, 「캐릭터 위」 이벤트(300k)·조명 막 아래.
  ghost.setDepth(MAP_UPPER_LAYER_DEPTH + 0.5);
  ghost.setAlpha(GHOST_ALPHA * player.alpha);
  ghost.setVisible(true);
}

export function destroyPlayerOcclusionGhost(scene: object): void {
  const state = states.get(scene);
  state?.sprite?.destroy();
  states.delete(scene);
}

function hide(state: GhostState): void {
  if (state.sprite?.active && state.sprite.visible) state.sprite.setVisible(false);
}

/** 몸 칸·머리 칸을 덮는 ★ 칸의 불투명 비율(0~1)과 가중 합. */
export function playerCoverage(scene: GhostScene, map: GameMap, x: number, y: number): { body: number; head: number; weighted: number } {
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return { body: 0, head: 0, weighted: 0 };
  const key = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  const body = cellCover(scene, map, tileset, key, x, y), head = cellCover(scene, map, tileset, key, x, y - 1);
  return { body: Math.round(body * 100) / 100, head: Math.round(head * 100) / 100, weighted: Math.round((BODY_WEIGHT * body + HEAD_WEIGHT * head) * 100) / 100 };
}

function cellCover(scene: GhostScene, map: GameMap, tileset: TilesetDef, key: string, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 0;
  // 막힌 가구 위 ★ 는 줄 정렬이라 사람을 덮지 않는다(playSceneMapRuntime.placeMapTileImage) — 실루엣도 띄우지 않는다.
  if (starRestsOnSolidFurniture(map, tileset, x, y)) return 0;
  const index = y * map.width + x;
  let best = 0;
  for (const tile of [map.upperTiles[index], ...tileStackAt(map, "upper", index), layerTileAt(map, 4, index)]) {
    if (typeof tile !== "number" || tile < 0 || !isAlwaysAboveCharacterUpperTile(tileset, tile)) continue;
    best = Math.max(best, tileOpacity(scene.textures, key, tile));
  }
  return best;
}

function tileOpacity(textures: Phaser.Textures.TextureManager, key: string, tile: number): number {
  const cacheKey = `${key}#${tile}`;
  const cached = opacityCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let value = 0;
  try {
    const frame = textures.exists(key) ? textures.getFrame(key, `tile_${tile}`) : null;
    const image = frame?.source?.image as CanvasImageSource | undefined;
    if (frame && image && frame.name === `tile_${tile}`) {
      const w = frame.cutWidth, h = frame.cutHeight;
      scratch ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      if (scratch && w > 0 && h > 0) {
        scratch.canvas.width = w; scratch.canvas.height = h;
        scratch.clearRect(0, 0, w, h);
        scratch.drawImage(image, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
        const data = scratch.getImageData(0, 0, w, h).data;
        let opaque = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]! >= 128) opaque++;
        value = opaque / (w * h);
      }
    }
  } catch { value = 0; }
  opacityCache.set(cacheKey, value);
  return value;
}
