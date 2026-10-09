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
  const width = Math.max(1, Math.round(context.viewportWidth));
  const height = Math.max(1, Math.round(context.viewportHeight));
  return {
    ambient: state.ambient,
    color: state.color ?? "#000000",
    width,
    height,
    // 화면과 겹치지 않는 광원은 마스크에 아무 픽셀도 바꾸지 않는다. 서명·그리기에서 빼야 화면 밖
    // 깜빡이는 광원 하나 때문에 16ms 마다 캔버스 전체를 다시 그리고 텍스처를 올리지 않는다.
    gradients: state.sources
      .map((source) => lightGradientParam(source, context))
      .filter((param): param is LightGradientParam => param !== null && gradientTouchesViewport(param, width, height)),
  };
}

/** 그라디언트가 칠하는 사각(drawLightingMask 의 fillRect)이 화면 [0,w]×[0,h] 과 겹치는가. */
function gradientTouchesViewport(param: LightGradientParam, width: number, height: number): boolean {
  const r = Math.max(0, param.radiusPx);
  return param.centerX + r > 0 && param.centerX - r < width && param.centerY + r > 0 && param.centerY - r < height;
}

export function lightingMaskSignature(params: LightingMaskParams): string {
  // 매 프레임 불린다. 중간 객체·JSON 없이 같은 정보를 이어 붙인다(값·정밀도는 예전과 같다).
  let signature = `${round(params.ambient)}|${params.color}|${params.width}x${params.height}`;
  for (const entry of params.gradients) {
    signature += `|${entry.id}:${round(entry.centerX)},${round(entry.centerY)},${round(entry.radiusPx)},${round(entry.intensity)},${entry.color ?? ""},${round(entry.flicker)}`;
  }
  return signature;
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
