// pixelfx 효과 지정(PixelFxSpec)의 정규화. 효과 목록과 대조하지 않는다 — 형식만 본다.
// 목록 대조(없는 효과 거절·비슷한 이름 제안)는 편집기·조수 쪽 pixelfx/catalog 가 한다. 런타임은 못 찾은 효과를 그리지 않는다.
import type { EventPixelFx, PixelFxSpec } from "@/project/types";

const EFFECT_ID = /^[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const PIXEL_FX_PALETTE_MAX = 12;
export const PIXEL_FX_LAYERS = ["auto", "back", "front"] as const;

export function isPixelFxEffectIdFormat(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && EFFECT_ID.test(value);
}

const num = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;

/** 형식이 맞는 부분만 남긴다. effectId 가 틀리면 통째로 undefined. 기본값은 저장하지 않는다(옛 JSON 바이트 유지). */
export function normalizePixelFxSpec(raw: unknown): PixelFxSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (!isPixelFxEffectIdFormat(r.effectId)) return undefined;
  const out: PixelFxSpec = { effectId: r.effectId };
  if (Array.isArray(r.palette)) {
    const palette = r.palette.filter((c): c is string => typeof c === "string" && HEX.test(c)).slice(0, PIXEL_FX_PALETTE_MAX).map((c) => c.toLowerCase());
    if (palette.length >= 2) out.palette = palette;
  }
  if (r.flip === true || r.flip === false) out.flip = r.flip;
  const angle = num(r.angle, -360, 360);
  if (angle) out.angle = Math.round(angle);
  const seed = num(r.seed, 0, 1_000_000);
  if (seed !== undefined) out.seed = Math.round(seed);
  const scale = num(r.scale, 1, 4);
  if (scale !== undefined && Math.round(scale) !== 1) out.scale = Math.round(scale);
  const light = num(r.light, 0, 2);
  if (light !== undefined && light !== 1) out.light = Math.round(light * 100) / 100;
  const speed = num(r.speed, 0.25, 4);
  if (speed !== undefined && speed !== 1) out.speed = Math.round(speed * 100) / 100;
  const ox = num(r.offsetX, -64, 64);
  if (ox) out.offsetX = Math.round(ox);
  const oy = num(r.offsetY, -64, 64);
  if (oy) out.offsetY = Math.round(oy);
  return out;
}

export function normalizeEventPixelFx(raw: unknown): EventPixelFx | undefined {
  const spec = normalizePixelFxSpec(raw);
  if (!spec) return undefined;
  const layer = (raw as Record<string, unknown>).layer;
  return (PIXEL_FX_LAYERS as readonly unknown[]).includes(layer) && layer !== "auto"
    ? { ...spec, layer: layer as EventPixelFx["layer"] }
    : spec;
}

/** 같은 그림이 나오는 지정끼리 같은 열쇠(필드 반복 효과의 프레임 캐시 공유). */
export function pixelFxRenderKey(spec: PixelFxSpec): string {
  return [spec.effectId, (spec.palette ?? []).join(","), spec.flip ? 1 : 0, spec.angle ?? 0, spec.seed ?? "", spec.light ?? 1].join("|");
}

/** 전투 애니메이션 레코드 id 를 효과에서 짓는다: anim_pfx_<분류>_<이름>[_<꼬리>]. */
export function pixelFxAnimationId(effectId: string, suffix?: string): string {
  const base = `anim_pfx_${effectId.replace(/[/-]/g, "_")}`;
  const tail = suffix?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return tail ? `${base}_${tail}` : base;
}
