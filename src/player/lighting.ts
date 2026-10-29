import type { LightSource, LightingState } from "@/project/types";
import {
  deterministicFlickerFactor,
  lightConeAngle,
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
  /** 부채꼴 빛이면 [시작각, 끝각](라디안) — 그 사이만 칠한다. */
  readonly arc?: readonly [number, number];
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
    signature += `|${entry.id}:${round(entry.centerX)},${round(entry.centerY)},${round(entry.radiusPx)},${round(entry.intensity)},${entry.color ?? ""},${round(entry.flicker)}${entry.arc ? `,${round(entry.arc[0])}~${round(entry.arc[1])}` : ""}`;
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
    fillLight(context, light);
  }
  context.restore();

  // 빛 색 — 어둠만 걷어 내면 가로등·창 불빛이 «덜 어두운 자리»로만 보이고 따뜻한 불빛으로 읽히지 않았다(첫사랑 밤거리, VQA r22).
  // 색을 준 광원은 걷어 낸 자리에 그 색을 옅게 얹는다. 어두운 장면일수록(ambient) 진하다. 흰빛에 가까우면 거의 티가 안 난다.
  context.save();
  context.globalCompositeOperation = "source-over";
  for (const light of params.gradients) {
    const rgb = light.color ? hexRgb(light.color) : null;
    if (!rgb || light.radiusPx <= 0 || light.intensity <= 0) continue;
    const alpha = clamp01(light.intensity) * LIGHT_TINT_STRENGTH * params.ambient;
    const gradient = context.createRadialGradient(light.centerX, light.centerY, 0, light.centerX, light.centerY, light.radiusPx);
    gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
    gradient.addColorStop(0.6, `rgba(${rgb},${alpha * 0.45})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = gradient;
    fillLight(context, light);
  }
  context.restore();
}

const LIGHT_TINT_STRENGTH = 0.4;

/** 둥근 빛은 사각을, 부채꼴 빛(경비 등불 시야)은 그 부채꼴만 칠한다 — 바닥에 시야가 그대로 보인다. */
function fillLight(context: CanvasRenderingContext2D, light: LightGradientParam): void {
  if (!light.arc) {
    context.fillRect(light.centerX - light.radiusPx, light.centerY - light.radiusPx, light.radiusPx * 2, light.radiusPx * 2);
    return;
  }
  context.beginPath();
  context.moveTo(light.centerX, light.centerY);
  context.arc(light.centerX, light.centerY, light.radiusPx, light.arc[0], light.arc[1]);
  context.closePath();
  context.fill();
}

function hexRgb(color: string): string | null {
  const m = /^#([0-9a-f]{6})$/iu.exec(color.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
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
    ...(source.cone ? { arc: coneArc(source.cone.degrees, position.facing ?? source.cone.facing) } : {}),
  };
}

function coneArc(degrees: number, facing: "up" | "down" | "left" | "right" | undefined): readonly [number, number] {
  const mid = lightConeAngle(facing);
  const half = (clamp(20, 180, degrees) / 2) * Math.PI / 180;
  return [mid - half, mid + half];
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
