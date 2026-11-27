import type Phaser from "phaser";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { resolvePostFx, type ForegroundParallaxMode } from "@/project/postFx";
import { interactivePropById, interactivePropGlowColor } from "@/project/interactiveProps";
import { ensureLightingState } from "@/project/lightingRules";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";

/**
 * 옥토패스 2풍 입체감 레이어 2종:
 * 1. 전경 실루엣 패럴랙스 (`foreground: foliage | cave-arch | pillars`):
 *    카메라 앞 `1.16×` 속도로 스쳐 지나가는 어두운 보케 나뭇가지·동굴 천장·저택 기둥 실루엣.
 * 2. 캐릭터 광원 물듦 (`spriteRimLight`):
 *    주인공이 모닥불·촛대·수정구·동적 광원 3칸 이내에 서면 스프라이트에 은은한 광원색 틴트가 스며든다.
 */

const FG_DEPTH = 795_000;
const FG_TEX_PREFIX = "__oprn_fg_parallax_";

type ForegroundState = {
  mode: ForegroundParallaxMode;
  topSprite: Phaser.GameObjects.TileSprite | null;
  botSprite: Phaser.GameObjects.TileSprite | null;
  lastRimTint: number;
};

const states = new WeakMap<object, ForegroundState>();

function ensureForegroundTexture(
  scene: PlaySceneContext,
  mode: Exclude<ForegroundParallaxMode, "none">,
  edge: "top" | "bottom",
): string | null {
  const key = `${FG_TEX_PREFIX}${mode}_${edge}`;
  if (scene.textures.exists(key)) return key;
  const w = 256;
  const h = 44;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);

  if (mode === "foliage") {
    const blobs: ReadonlyArray<readonly [number, number, number, number, number]> = edge === "top"
      ? [
        [24, 4, 42, 22, 0.72], [72, 2, 34, 18, 0.64], [128, 6, 46, 20, 0.74],
        [184, 3, 38, 17, 0.66], [234, 5, 40, 21, 0.72], [96, 12, 24, 12, 0.44], [206, 11, 22, 11, 0.42],
      ]
      : [
        [18, 42, 46, 22, 0.78], [76, 44, 36, 18, 0.68], [142, 41, 48, 20, 0.76],
        [204, 43, 40, 19, 0.72], [248, 42, 34, 18, 0.70],
      ];
    for (const [cx, cy, rx, ry, alpha] of blobs) {
      const grad = ctx.createRadialGradient(cx, cy, rx * 0.25, cx, cy, rx);
      grad.addColorStop(0, `rgba(10, 12, 18, ${alpha})`);
      grad.addColorStop(0.75, `rgba(14, 18, 22, ${alpha * 0.65})`);
      grad.addColorStop(1, "rgba(10, 12, 18, 0)");
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (mode === "cave-arch") {
    // 들쭉날쭉한 어두운 동굴 천장/바닥 바위 실루엣
    ctx.fillStyle = "rgba(8, 9, 14, 0.86)";
    ctx.beginPath();
    if (edge === "top") {
      ctx.moveTo(0, 0);
      const pts = [[0, 20], [32, 30], [66, 14], [108, 26], [148, 12], [188, 32], [222, 16], [256, 20]];
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(w, 0);
    } else {
      ctx.moveTo(0, h);
      const pts = [[0, 28], [40, 18], [86, 30], [134, 20], [176, 32], [218, 17], [256, 28]];
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(w, h);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // pillars: 저택·성문 아치/기둥 실루엣 (넓은 간격으로 스쳐 지나감)
    for (const px of [12, 140]) {
      const pw = 24;
      const grad = ctx.createLinearGradient(px, 0, px + pw, 0);
      grad.addColorStop(0, "rgba(6, 7, 12, 0)");
      grad.addColorStop(0.25, "rgba(6, 7, 12, 0.78)");
      grad.addColorStop(0.75, "rgba(6, 7, 12, 0.78)");
      grad.addColorStop(1, "rgba(6, 7, 12, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(px, 0, pw, h);
    }
  }
  tex.refresh();
  return key;
}

function destroyForegroundSprites(state: ForegroundState): void {
  state.topSprite?.destroy();
  state.botSprite?.destroy();
  state.topSprite = null;
  state.botSprite = null;
  state.mode = "none";
}

function syncForegroundLayer(scene: PlaySceneContext, state: ForegroundState, mode: ForegroundParallaxMode): void {
  if (mode === "none") {
    if (state.mode !== "none") destroyForegroundSprites(state);
    return;
  }
  const camera = scene.cameras?.main;
  if (!camera) return;
  const w = Math.max(64, camera.width || 640);
  const h = Math.max(64, camera.height || 360);

  if (state.mode !== mode) {
    destroyForegroundSprites(state);
    const topKey = ensureForegroundTexture(scene, mode, "top");
    const botKey = ensureForegroundTexture(scene, mode, "bottom");
    if (topKey && typeof scene.add?.tileSprite === "function") {
      state.topSprite = scene.add.tileSprite(0, 0, w, 44, topKey).setOrigin(0, 0).setScrollFactor(0).setDepth(FG_DEPTH);
    }
    if (botKey && typeof scene.add?.tileSprite === "function") {
      state.botSprite = scene.add.tileSprite(0, h - 44, w, 44, botKey).setOrigin(0, 0).setScrollFactor(0).setDepth(FG_DEPTH);
    }
    state.mode = mode;
  }

  // 전경은 카메라보다 1.16배 빠르게 흘러가 입체 디오라마 깊이감을 만든다.
  const scrollX = (camera.scrollX ?? 0) * 1.16;
  if (state.topSprite) {
    if (state.topSprite.width !== w) state.topSprite.setSize(w, 44);
    state.topSprite.tilePositionX = scrollX;
  }
  if (state.botSprite) {
    if (state.botSprite.width !== w) state.botSprite.setSize(w, 44);
    state.botSprite.setPosition(0, h - 44);
    state.botSprite.tilePositionX = scrollX * 1.08 + 64;
  }
}

function hexStringToInt(hex: string | undefined): number | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? Number.parseInt(m[1]!, 16) : null;
}

function blendWhiteToColor(color: number, weight: number): number {
  const w = Math.max(0, Math.min(0.42, weight));
  const r = Math.round(255 * (1 - w) + ((color >> 16) & 0xff) * w);
  const g = Math.round(255 * (1 - w) + ((color >> 8) & 0xff) * w);
  const b = Math.round(255 * (1 - w) + (color & 0xff) * w);
  return (r << 16) | (g << 8) | b;
}

/** 주인공이 발광 상호작용 기물·조명 근처에 있을 때 스프라이트에 은은한 광원색 림 틴트를 입힌다. */
function syncHeroRimLight(scene: PlaySceneContext, state: ForegroundState, enabled: boolean): void {
  const player = scene.player;
  if (!player || typeof player.setTint !== "function") return;
  if (!enabled) {
    if (state.lastRimTint !== 0xffffff) {
      player.clearTint();
      state.lastRimTint = 0xffffff;
    }
    return;
  }

  const px = scene.tileX;
  const py = scene.tileY;
  let bestWeight = 0;
  let bestColor = 0xffffff;

  // 1. 맵 위 발광 상호작용 기물(모닥불·화로·촛대·수정구 등)
  const project = store.getCurrent();
  if (project && scene.map) {
    const views = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions);
    for (const v of views) {
      const propId = v.page?.interaction?.kind === "container" ? v.page.interaction.propId : undefined;
      if (!propId) continue;
      const prop = interactivePropById(propId, project);
      if (!prop) continue;
      const glow = interactivePropGlowColor(prop);
      if (glow === null) continue;
      const dist = Math.hypot(v.x - px, v.y - py);
      if (dist > 3.5) continue;
      const w = (1 - dist / 3.5) * 0.36;
      if (w > bestWeight) {
        bestWeight = w;
        bestColor = glow;
      }
    }
  }

  // 2. 동적 조명 포인트 광원
  const lighting = ensureLightingState(scene.session);
  for (const src of lighting.sources) {
    if (typeof src.at === "string" || !("x" in src.at)) continue;
    const col = hexStringToInt(src.color) ?? 0xffb86c;
    const radius = Math.max(2, src.radius || 3.5);
    const dist = Math.hypot(src.at.x - px, src.at.y - py);
    if (dist > radius) continue;
    const w = (1 - dist / radius) * 0.32 * (src.intensity ?? 1);
    if (w > bestWeight) {
      bestWeight = w;
      bestColor = col;
    }
  }

  const nextTint = bestWeight > 0.03 ? blendWhiteToColor(bestColor, bestWeight) : 0xffffff;
  if (nextTint !== state.lastRimTint) {
    if (nextTint === 0xffffff) player.clearTint();
    else player.setTint(nextTint);
    state.lastRimTint = nextTint;
  }
}

export function updateForegroundAndRimLight(scene: PlaySceneContext): void {
  let state = states.get(scene);
  if (!state) {
    state = { mode: "none", topSprite: null, botSprite: null, lastRimTint: 0xffffff };
    states.set(scene, state);
    const cleanup = (): void => {
      if (state) destroyForegroundSprites(state);
      states.delete(scene);
    };
    scene.events?.once?.("shutdown", cleanup);
    scene.events?.once?.("destroy", cleanup);
  }
  const project = store.getCurrent();
  const resolved = resolvePostFx(scene.map?.postFx, project?.system?.postFx);
  syncForegroundLayer(scene, state, resolved.foreground);
  syncHeroRimLight(scene, state, resolved.spriteRimLight && (resolved.active || (scene.session?.lighting?.ambient ?? 0) > 0.1));
}
