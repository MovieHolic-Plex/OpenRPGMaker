import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { resolvePostFx } from "@/project/postFx";
import { interactivePropById, interactivePropGlowColor } from "@/project/interactiveProps";
import { ensureLightingState } from "@/project/lightingRules";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { isEmptySpriteLook, normalizeSpriteLook } from "@/project/eventCommands/cinematicStaging";

/**
 * 캐릭터 광원 물듦 (`spriteRimLight`):
 * 주인공이 모닥불·촛대·수정구·동적 광원 3.5칸 이내에 서면 스프라이트에 은은한 광원색 림 틴트가 스며든다.
 * (탑뷰 맵 시야를 가리지 않도록 전경 패럴랙스는 두지 않는다.)
 */

type RimState = {
  lastRimTint: number;
  hadPlayerLook: boolean;
};

const states = new WeakMap<object, RimState>();

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

function syncHeroRimLight(scene: PlaySceneContext, state: RimState, enabled: boolean): void {
  const player = scene.player;
  if (!player || typeof player.setTint !== "function") return;
  const rawPlayerLook = scene.session?.m2Runtime?.screen?.spriteLooks?.player;
  const playerLook = rawPlayerLook ? normalizeSpriteLook(rawPlayerLook) : undefined;
  const hasLook = !isEmptySpriteLook(playerLook);
  // 저작된 명시적 tint(spriteLook.tint)는 최우선으로 보존하고, 끝나는 즉시 림 틴트를 복구할 수 있게 캐시를 비운다.
  if (playerLook?.tint) {
    state.lastRimTint = 0xffffff;
    state.hadPlayerLook = true;
    return;
  }
  const tintClearedByStaging = hasLook || state.hadPlayerLook;
  state.hadPlayerLook = hasLook;

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
  if (nextTint === 0xffffff) {
    if (state.lastRimTint !== 0xffffff) {
      player.clearTint();
      state.lastRimTint = 0xffffff;
    }
  } else if (
    nextTint !== state.lastRimTint
    || tintClearedByStaging
    || (typeof player.tintTopLeft === "number" && player.tintTopLeft !== nextTint)
  ) {
    player.setTint(nextTint);
    state.lastRimTint = nextTint;
  }
}

export function updateForegroundAndRimLight(scene: PlaySceneContext): void {
  let state = states.get(scene);
  if (!state) {
    state = { lastRimTint: 0xffffff, hadPlayerLook: false };
    states.set(scene, state);
    const cleanup = (): void => {
      states.delete(scene);
    };
    scene.events?.once?.("shutdown", cleanup);
    scene.events?.once?.("destroy", cleanup);
  }
  const project = store.getCurrent();
  const resolved = resolvePostFx(scene.map?.postFx, project?.system?.postFx);
  syncHeroRimLight(scene, state, resolved.spriteRimLight && (resolved.active || (scene.session?.lighting?.ambient ?? 0) > 0.1));
}
