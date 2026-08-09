import type { LightSource, LightingState } from "@/project/types";
import {
  deterministicFlickerFactor,
  lightSourceIntensity,
  normalizeLightingState,
  type LightAnchorResolver,
} from "@/project/lightingRules";

export type LightingMaskContext = {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly tileSize: number;
  readonly cameraX: number;
  readonly cameraY: number;
  readonly zoom: number;
  readonly timeMs: number;
  readonly resolveAnchor: LightAnchorResolver;
};

export type LightGradientParam = {
  readonly id: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusPx: number;
  readonly intensity: number;
  readonly color?: string;
  readonly flicker: number;
};

export type LightingMaskParams = {
  readonly ambient: number;
  readonly color: string;
  readonly width: number;
  readonly height: number;
  readonly gradients: readonly LightGradientParam[];
};

export function lightingGradientParams(
  lighting: LightingState | undefined,
  context: LightingMaskContext
): LightingMaskParams {
  const state = normalizeLightingState(lighting);
  return {
    ambient: state.ambient,
    color: state.color ?? "#000000",
    width: Math.max(1, Math.round(context.viewportWidth)),
    height: Math.max(1, Math.round(context.viewportHeight)),
    gradients: state.sources
      .map((source) => lightGradientParam(source, context))
      .filter((param): param is LightGradientParam => param !== null),
  };
}

export function lightingMaskSignature(params: LightingMaskParams): string {
  return JSON.stringify({
    ambient: round(params.ambient),
    color: params.color,
    width: params.width,
    height: params.height,
    gradients: params.gradients.map((entry) => ({
      id: entry.id,
      x: round(entry.centerX),
      y: round(entry.centerY),
      r: round(entry.radiusPx),
      i: round(entry.intensity),
      color: entry.color,
      flicker: round(entry.flicker),
    })),
  });
}

export function drawLightingMask(canvas: HTMLCanvasElement, params: LightingMaskParams): void {
  if (canvas.width !== params.width) canvas.width = params.width;
  if (canvas.height !== params.height) canvas.height = params.height;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, params.width, params.height);
  if (params.ambient <= 0) return;

  context.save();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = params.ambient;
  context.fillStyle = params.color;
  context.fillRect(0, 0, params.width, params.height);
  context.restore();

  // 현재 범위는 원형 반경 기반 마스크만 지원한다. 벽/시야선 차폐는 Phase 6a 범위 밖이다.
  context.save();
  context.globalCompositeOperation = "destination-out";
  for (const light of params.gradients) {
    if (light.radiusPx <= 0 || light.intensity <= 0) continue;
    const gradient = context.createRadialGradient(
      light.centerX,
      light.centerY,
      0,
      light.centerX,
      light.centerY,
      light.radiusPx
    );
    const alpha = clamp01(light.intensity);
    gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gradient.addColorStop(0.7, `rgba(0,0,0,${alpha * 0.65})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(
      light.centerX - light.radiusPx,
      light.centerY - light.radiusPx,
      light.radiusPx * 2,
      light.radiusPx * 2
    );
  }
  context.restore();
}

function lightGradientParam(source: LightSource, context: LightingMaskContext): LightGradientParam | null {
  const position = context.resolveAnchor(source.at, source);
  if (!position) return null;
  const zoom = Number.isFinite(context.zoom) && context.zoom > 0 ? context.zoom : 1;
  const centerX = ((position.x + 0.5) * context.tileSize - context.cameraX) * zoom;
  const centerY = ((position.y + 0.5) * context.tileSize - context.cameraY) * zoom;
  return {
    id: source.id,
    centerX,
    centerY,
    radiusPx: source.radius * context.tileSize * zoom,
    intensity: lightSourceIntensity(source, context.timeMs),
    color: source.color,
    flicker: source.flicker ? deterministicFlickerFactor(source.id, context.timeMs) : 1,
  };
}

function clamp01(value: number): number {
  return clamp(0, 1, Number.isFinite(value) ? value : 0);
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
