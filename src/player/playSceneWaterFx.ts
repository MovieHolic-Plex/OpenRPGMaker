import type Phaser from "phaser";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { GameMap, Project } from "@/project/types";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { isWaterTagged } from "@/project/vehicles";
import { tileCategoriesForTile } from "@/project/tilesetPalette";
import { resolvePostFx, type PostFxPresetId } from "@/project/postFx";
import { MAP_LOWER_LAYER_DEPTH } from "@/player/characterDepth";

/**
 * 옥토패스 트래블러 2풍 수면 윤슬(Shimmer) + 물가 캐릭터 Y반전 반사 렌더러.
 *
 * - `terrainDesign.waterDepth` 뿐 아니라 일반 칩셋의 water 태그·물 오토타일까지 모두 감지한다.
 * - ① 윤슬: 카메라에 보이는 물 타일 위에서 프리셋 색감에 맞춘 미세한 가로 빛결이 천천히 반짝인다.
 * - ② 물가 반사: 주인공 발 바로 아래(1~2칸 남쪽)에 물이 있으면 현재 스프라이트·프레임을
 *      Y축 반전(`setFlipY(true)`) + 수면 틴트 + 미세한 물결 흔들림으로 수면 위에 은은히 비춘다.
 */

type WaterFxState = {
  mapId: string;
  waterMask: Uint8Array;
  width: number;
  height: number;
  hasAnyWater: boolean;
  shimmerGraphics: Phaser.GameObjects.Graphics | null;
  reflectionSprite: Phaser.GameObjects.Sprite | null;
  lastDrawMs: number;
};

const states = new WeakMap<object, WaterFxState>();

function buildWaterMask(project: Project, map: GameMap): { mask: Uint8Array; hasAnyWater: boolean } {
  const total = map.width * map.height;
  const mask = new Uint8Array(total);
  const depths = map.terrainDesign?.waterDepth;
  const tileset = project.tilesets[map.tilesetId];
  let hasAnyWater = false;

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = y * map.width + x;
      let isWater = (depths?.[idx] ?? 0) > 0 || isWaterTagged(project, map, x, y);
      if (!isWater && tileset) {
        const lowerTile = map.lowerTiles[idx] ?? 0;
        if (lowerTile > 0 && tileCategoriesForTile(tileset, lowerTile).includes("water")) {
          isWater = true;
        }
      }
      if (isWater) {
        mask[idx] = 1;
        hasAnyWater = true;
      }
    }
  }
  return { mask, hasAnyWater };
}

function shimmerTintForPreset(preset: PostFxPresetId): { color: number; alpha: number; reflectTint: number } {
  switch (preset) {
    case "hd2d-warm":
    case "eastern-ink":
      return { color: 0xffe4a8, alpha: 0.42, reflectTint: 0xd8c8a8 };
    case "dawn-mist":
      return { color: 0xffd8f0, alpha: 0.38, reflectTint: 0xc8b8e0 };
    case "gothic-horror":
    case "dungeon-torch":
      return { color: 0x8fb8d8, alpha: 0.24, reflectTint: 0x7090b4 };
    case "cyber-neon":
      return { color: 0x78f0ff, alpha: 0.44, reflectTint: 0x80c8ff };
    case "cataclysm-fire":
      return { color: 0xff9a52, alpha: 0.46, reflectTint: 0xd88868 };
    case "arctic-blizzard":
      return { color: 0xd8f4ff, alpha: 0.34, reflectTint: 0xa8cce0 };
    default:
      return { color: 0xe6f8ff, alpha: 0.34, reflectTint: 0xa8d0e8 };
  }
}

function cleanupState(state: WaterFxState): void {
  state.shimmerGraphics?.destroy();
  state.reflectionSprite?.destroy();
  state.shimmerGraphics = null;
  state.reflectionSprite = null;
}

export function updateWaterFx(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  const map = scene.map;
  if (!project || !map) return;

  const resolved = resolvePostFx(map.postFx, project.system?.postFx);
  let state = states.get(scene);
  if (!state) {
    const built = buildWaterMask(project, map);
    state = {
      mapId: map.id,
      waterMask: built.mask,
      width: map.width,
      height: map.height,
      hasAnyWater: built.hasAnyWater,
      shimmerGraphics: null,
      reflectionSprite: null,
      lastDrawMs: -1,
    };
    states.set(scene, state);
    const cleanup = (): void => {
      if (state) cleanupState(state);
      states.delete(scene);
    };
    scene.events?.once?.("shutdown", cleanup);
    scene.events?.once?.("destroy", cleanup);
  } else if (state.mapId !== map.id || state.width !== map.width || state.height !== map.height) {
    const built = buildWaterMask(project, map);
    state.mapId = map.id;
    state.waterMask = built.mask;
    state.width = map.width;
    state.height = map.height;
    state.hasAnyWater = built.hasAnyWater;
  }

  if (!resolved.waterReflections || !state.hasAnyWater) {
    if (state.shimmerGraphics) state.shimmerGraphics.setVisible(false);
    if (state.reflectionSprite) state.reflectionSprite.setVisible(false);
    return;
  }

  const size = mapTileSize(map);
  const now = scene.time?.now ?? 0;
  const tone = shimmerTintForPreset(resolved.preset);

  // ① 수면 윤슬 (Specular Shimmer) — 약 12fps(80ms)로 반짝여 도트 감성 유지 & CPU 절약
  if (!state.shimmerGraphics && typeof scene.add?.graphics === "function") {
    state.shimmerGraphics = scene.add.graphics().setDepth(MAP_LOWER_LAYER_DEPTH + 1.5);
  }
  const g = state.shimmerGraphics;
  if (g) {
    g.setVisible(true);
    if (now - state.lastDrawMs >= 80 || state.lastDrawMs < 0) {
      state.lastDrawMs = now;
      g.clear();
      const cam = scene.cameras?.main;
      const view = cam?.worldView;
      const x0 = view ? Math.max(0, Math.floor(view.x / size) - 1) : 0;
      const y0 = view ? Math.max(0, Math.floor(view.y / size) - 1) : 0;
      const x1 = view ? Math.min(map.width - 1, Math.ceil((view.x + view.width) / size) + 1) : map.width - 1;
      const y1 = view ? Math.min(map.height - 1, Math.ceil((view.y + view.height) / size) + 1) : map.height - 1;
      const t = now * 0.0022;

      for (let ty = y0; ty <= y1; ty += 1) {
        const rowOff = ty * map.width;
        for (let tx = x0; tx <= x1; tx += 1) {
          if (!state.waterMask[rowOff + tx]) continue;
          const phase = Math.sin(t + tx * 1.73 + ty * 2.91);
          if (phase < 0.35) continue;
          const glintAlpha = ((phase - 0.35) / 0.65) * tone.alpha;
          const gx = tx * size + 2 + ((tx * 7 + ty * 11) % Math.max(4, size - 6));
          const gy = ty * size + 3 + ((tx * 13 + ty * 5) % Math.max(4, size - 5));
          const gw = phase > 0.78 ? 4 : 2;
          g.fillStyle(tone.color, glintAlpha);
          g.fillRect(Math.round(gx), Math.round(gy), gw, 1);
        }
      }
    }
  }

  // ② 물가 캐릭터 Y반전 반사 (주인공 바로 아래 1~2칸에 물 타일이 있을 때만)
  const player = scene.player;
  if (!player || player.visible === false || !player.texture?.key) {
    state.reflectionSprite?.setVisible(false);
    return;
  }
  const ptx = Math.floor(player.x / size);
  const pty = Math.floor((player.y - 2) / size);
  const waterAt = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && state!.waterMask[y * map.width + x] === 1;
  const hasWaterBelow = waterAt(ptx, pty + 1) || waterAt(ptx, pty + 2);

  if (!hasWaterBelow) {
    state.reflectionSprite?.setVisible(false);
    return;
  }

  if (!state.reflectionSprite && typeof scene.add?.sprite === "function") {
    state.reflectionSprite = scene.add
      .sprite(player.x, player.y, player.texture.key, player.frame?.name)
      .setDepth(MAP_LOWER_LAYER_DEPTH + 1.8)
      .setFlipY(true);
  }
  const ref = state.reflectionSprite;
  if (ref) {
    if (ref.texture.key !== player.texture.key || ref.frame?.name !== player.frame?.name) {
      ref.setTexture(player.texture.key, player.frame?.name);
    }
    const rippleX = Math.sin(now * 0.0055) * 1.1;
    const waterOffsetY = waterAt(ptx, pty + 1) ? 2 : size * 0.65;
    ref
      .setOrigin(player.originX, 1 - player.originY)
      .setPosition(player.x + rippleX, player.y + waterOffsetY)
      .setScale(player.scaleX, player.scaleY * 0.82)
      .setFlipX(player.flipX)
      .setFlipY(true)
      .setTint(tone.reflectTint)
      .setAlpha(0.28 * (player.alpha ?? 1))
      .setVisible(true);
  }
}
