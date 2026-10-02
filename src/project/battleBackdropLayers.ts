import { normalizeBlendMode } from "@/project/blendMode";
import type { BattleBackdropLayer } from "@/project/types";

/**
 * 전투 배경 겹(TroopRecord.backdropLayers) — 배경 위에 깔리는 안개·구름·비·눈·불티·별·빛줄기, 또는 저자 그림 한 장.
 *
 * 왜 따로 두는가: 배경 움직임(backdropAnimation)은 배경 그림 **한 장**을 움직이고, 도트 측면 스킨(기본 retro2003)에서는
 * 지형 겹 배경이 그 그림을 덮어 아예 보이지 않는다. 겹은 배경 노드 맨 위(front=false) 또는 배틀러 앞(front=true)에
 * 따로 놓이므로 어느 스킨에서나 보인다. FF6 의 흐르는 구름층·크로노 트리거의 앞 덤불이 이 자리다.
 *
 * 프리셋은 그림 파일 없이 런타임이 CSS 그라디언트로 그린다(battleBackdropLayersDom.ts). 저장은 기본값을 뺀 값만.
 */
export const BATTLE_BACKDROP_LAYER_PRESETS = ["fog", "clouds", "mist", "rain", "snow", "embers", "stars", "lightRays"] as const;
export type BattleBackdropLayerPreset = (typeof BATTLE_BACKDROP_LAYER_PRESETS)[number];

export const BATTLE_BACKDROP_LAYER_LABELS: Record<BattleBackdropLayerPreset, string> = {
  fog: "안개",
  clouds: "흐르는 구름",
  mist: "땅안개",
  rain: "비",
  snow: "눈",
  embers: "불티",
  stars: "별",
  lightRays: "빛줄기",
};

/** 프리셋 기본값 — 저자가 값을 주지 않으면 이것으로 그린다. */
export const BATTLE_BACKDROP_LAYER_DEFAULTS: Record<
  BattleBackdropLayerPreset,
  { readonly scrollX: number; readonly scrollY: number; readonly opacity: number; readonly blendMode?: "add" | "screen" | "multiply" }
> = {
  fog: { scrollX: 14, scrollY: 0, opacity: 55 },
  clouds: { scrollX: 22, scrollY: 0, opacity: 70 },
  mist: { scrollX: 10, scrollY: 0, opacity: 60 },
  rain: { scrollX: -180, scrollY: 900, opacity: 55 },
  snow: { scrollX: 18, scrollY: 60, opacity: 85 },
  embers: { scrollX: 8, scrollY: -50, opacity: 85, blendMode: "add" },
  stars: { scrollX: 4, scrollY: 0, opacity: 90, blendMode: "screen" },
  lightRays: { scrollX: 6, scrollY: 0, opacity: 60, blendMode: "screen" },
};

export const BATTLE_BACKDROP_LAYER_LIMIT = 4;
const SCROLL_LIMIT = 1200;

export function isBattleBackdropLayerPreset(value: unknown): value is BattleBackdropLayerPreset {
  return typeof value === "string" && (BATTLE_BACKDROP_LAYER_PRESETS as readonly string[]).includes(value);
}

function finite(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** 프리셋도 그림도 없는 겹은 버린다. 최대 4겹. 남는 게 없으면 undefined(옛 JSON 바이트 유지). */
export function normalizeBattleBackdropLayers(value: unknown): BattleBackdropLayer[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const layers: BattleBackdropLayer[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const preset = isBattleBackdropLayerPreset(entry.preset) ? entry.preset : undefined;
    const resourceId = typeof entry.resourceId === "string" && entry.resourceId.trim() ? entry.resourceId.trim() : undefined;
    if (!preset && !resourceId) continue;
    const scrollX = finite(entry.scrollX, -SCROLL_LIMIT, SCROLL_LIMIT);
    const scrollY = finite(entry.scrollY, -SCROLL_LIMIT, SCROLL_LIMIT);
    const opacity = finite(entry.opacity, 0, 100);
    const blendMode = normalizeBlendMode(entry.blendMode);
    layers.push({
      ...(preset ? { preset } : {}),
      ...(resourceId ? { resourceId } : {}),
      ...(entry.front === true ? { front: true } : {}),
      ...(scrollX !== undefined ? { scrollX } : {}),
      ...(scrollY !== undefined ? { scrollY } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(blendMode ? { blendMode } : {}),
    });
    if (layers.length >= BATTLE_BACKDROP_LAYER_LIMIT) break;
  }
  return layers.length > 0 ? layers : undefined;
}

/** 그릴 값 — 저자 값이 먼저, 없으면 프리셋 기본값, 그림 겹은 정지·불투명·보통. */
export function resolvedBattleBackdropLayer(layer: BattleBackdropLayer): {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly opacity: number;
  readonly blendMode: "normal" | "add" | "screen" | "multiply";
} {
  const defaults = layer.preset && !layer.resourceId ? BATTLE_BACKDROP_LAYER_DEFAULTS[layer.preset] : undefined;
  return {
    scrollX: layer.scrollX ?? defaults?.scrollX ?? 0,
    scrollY: layer.scrollY ?? defaults?.scrollY ?? 0,
    opacity: layer.opacity ?? defaults?.opacity ?? 100,
    blendMode: layer.blendMode ?? defaults?.blendMode ?? "normal",
  };
}
