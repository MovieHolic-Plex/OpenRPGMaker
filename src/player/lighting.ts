import type { LightSource, LightingState } from "@/project/types";
import {
  deterministicFlickerFactor,
  effectiveDarkness,
  lightSourceIntensity,
  normalizeLightingState,
  PLAYER_PRESENCE_LIGHT,
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
  /**
   * 맵이 차지하는 세계 사각(px). 주면 어둠 막을 그 안에만 칠한다 — 작은 방 바깥의 빈 여백까지 막이 덮여
   * 화면 전체가 베이지·회색 판처럼 보였다(2026-10-28). 생략하면 화면 전체(예전과 같다).
   */
  readonly mapBounds?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
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
  /** 어둠 막을 칠할 화면 사각(캔버스 px). 없으면 화면 전체. */
  readonly clip?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly gradients: readonly LightGradientParam[];
};

export function lightingGradientParams(
  lighting: LightingState | undefined,
  context: LightingMaskContext
): LightingMaskParams {
  const state = normalizeLightingState(lighting);
  const width = Math.max(1, Math.round(context.viewportWidth));
  const height = Math.max(1, Math.round(context.viewportHeight));
  // 밝은 색 어둠 막은 같은 색상의 어두운 색조로 낮춘다(effectiveDarkness) — 방 전체가 안개 낀 듯 뭉개지지 않게.
  const darkness = effectiveDarkness(state.color, state.ambient);
  const sources = [...state.sources];
  // 짙은 어둠에 플레이어를 따라가는 빛이 없으면 플레이어 둘레만 살짝 걷어 내 주인공이 어둠에 묻히지 않게 한다.
  if (darkness.ambient >= PLAYER_PRESENCE_LIGHT.minAmbient && !sources.some((source) => source.at === "player")) {
    sources.push({ id: PLAYER_PRESENCE_LIGHT.id, at: "player", radius: PLAYER_PRESENCE_LIGHT.radius, intensity: PLAYER_PRESENCE_LIGHT.intensity });
  }
  return {
    ambient: darkness.ambient,
    color: darkness.color,
    width,
    height,
    ...(context.mapBounds ? { clip: mapClip(context, width, height) } : {}),
    // 화면과 겹치지 않는 광원은 마스크에 아무 픽셀도 바꾸지 않는다. 서명·그리기에서 빼야 화면 밖
    // 깜빡이는 광원 하나 때문에 16ms 마다 캔버스 전체를 다시 그리고 텍스처를 올리지 않는다.
    gradients: sources
      .map((source) => lightGradientParam(source, context))
      .filter((param): param is LightGradientParam => param !== null && gradientTouchesViewport(param, width, height)),
  };
}

/** 맵 세계 사각을 화면(캔버스 px)으로 옮겨 화면 안으로 자른다. 정수로 맞춰 가장자리에 반 픽셀 띠가 남지 않게 한다. */
function mapClip(context: LightingMaskContext, width: number, height: number): NonNullable<LightingMaskParams["clip"]> {
  const bounds = context.mapBounds!;
  const zoom = Number.isFinite(context.zoom) && context.zoom > 0 ? context.zoom : 1;
  const left = Math.max(0, Math.round((bounds.x - context.cameraX) * zoom));
  const top = Math.max(0, Math.round((bounds.y - context.cameraY) * zoom));
  const right = Math.min(width, Math.round((bounds.x + bounds.width - context.cameraX) * zoom));
  const bottom = Math.min(height, Math.round((bounds.y + bounds.height - context.cameraY) * zoom));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** 그라디언트가 칠하는 사각(drawLightingMask 의 fillRect)이 화면 [0,w]×[0,h] 과 겹치는가. */
function gradientTouchesViewport(param: LightGradientParam, width: number, height: number): boolean {
  const r = Math.max(0, param.radiusPx);
  return param.centerX + r > 0 && param.centerX - r < width && param.centerY + r > 0 && param.centerY - r < height;
}

export function lightingMaskSignature(params: LightingMaskParams): string {
  // 매 프레임 불린다. 중간 객체·JSON 없이 같은 정보를 이어 붙인다(값·정밀도는 예전과 같다).
  let signature = `${round(params.ambient)}|${params.color}|${params.width}x${params.height}`;
  if (params.clip) signature += `|c${params.clip.x},${params.clip.y},${params.clip.width},${params.clip.height}`;
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
  const clip = params.clip;
  if (clip) context.fillRect(clip.x, clip.y, clip.width, clip.height);
  else context.fillRect(0, 0, params.width, params.height);
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
    context.fillRect(light.centerX - light.radiusPx, light.centerY - light.radiusPx, light.radiusPx * 2, light.radiusPx * 2);
  }
  context.restore();
}

const LIGHT_TINT_STRENGTH = 0.4;

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
