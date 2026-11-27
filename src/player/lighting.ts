import type { LightSource, LightingState } from "@/project/types";
import {
  deterministicFlickerFactor,
  effectiveDarkness,
  lightConeAngle,
  lightingBlend,
  lightFalloffCurve,
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
  /**
   * 맵 밖 여백에도 그림이 그려지는 맵(map.background.showInEmptyCells — 하늘탑의 구름 등)이면 어둠 막·비네트를 화면 전체에 칠한다.
   * 맵 사각으로만 칠하면 여백의 하늘만 밝게 남아 맵 경계에 세로 이음새가 생겼다(폴른 스타 하늘탑 3층, 2026-11-10 fs-vqa-today).
   * 빛 색 얹기는 그대로 맵 사각 안이다(벽 너머 빛 쐐기 방지).
   */
  readonly darkMargin?: boolean;
  /**
   * 화면 네 변 바깥으로 더 그릴 폭(화면 px). 카메라가 흔들리면 화면 고정 층도 같이 밀려, 화면 크기에 딱 맞춘 어둠 막은
   * 밀린 만큼 가장자리가 비어 낮 밝기의 띠가 드러났다(2026-11-14 QA minor 16). 흔들리는 동안 그만큼 넓게 그린다.
   * 빛·맵 사각은 같은 세계 좌표로 계산해 한쪽으로 bleed 만큼 옮긴다 — 막은 세계에 붙어 같이 흔들린다.
   */
  readonly bleed?: number;
  /**
   * 2D 타일 벽면 레이캐스트 차폐 콜백(Darkwood식 손전등·방 조명 벽 차단).
   * true 를 돌려주는 칸(벽·기둥·집)에서 빛이 멈추고 뒤쪽은 그림자로 남는다. 생략하면 기존 원형/부채꼴과 같다.
   */
  readonly isOpaqueTile?: (tileX: number, tileY: number) => boolean;
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
  /** 가장자리가 또렷한 빛(시야 등불) — LightSource.edge. */
  readonly edge?: "hard";
  /** 벽면 레이캐스트로 잘린 가시 다각형(화면 캔버스 px 좌표). 있으면 fillLight 가 이 다각형으로 빛을 자른다. */
  readonly poly?: readonly (readonly [number, number])[];
  /** 다각형 서명 해시 — 플레이어나 빛이 벽 모서리를 지나갈 때 마스크를 다시 그리도록 감지. */
  readonly polyHash?: number;
};

export type LightingMaskParams = {
  readonly ambient: number;
  readonly color: string;
  /** "multiply" 면 오버레이를 곱하기로 얹는다(playSceneLighting). 마스크 그림은 두 방식이 같다. */
  readonly blend: "over" | "multiply";
  /** 가장자리 어둠(0~1). 0 이면 그리지 않는다. */
  readonly vignette: number;
  readonly width: number;
  readonly height: number;
  /** 어둠 막을 칠할 화면 사각(캔버스 px). 없으면 화면 전체. */
  readonly clip?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** true 면 어둠 막·비네트는 clip 없이 화면 전체, 빛 색만 clip 안(LightingMaskContext.darkMargin). */
  readonly darkMargin?: boolean;
  /** width·height 에 이미 들어 있는 네 변 여유(px) — LightingMaskContext.bleed. 화면은 (bleed, bleed) 에서 시작한다. */
  readonly bleed?: number;
  readonly gradients: readonly LightGradientParam[];
};

export function lightingGradientParams(
  lighting: LightingState | undefined,
  context: LightingMaskContext
): LightingMaskParams {
  const state = normalizeLightingState(lighting);
  const bleed = Math.max(0, Math.round(context.bleed ?? 0));
  const width = Math.max(1, Math.round(context.viewportWidth)) + bleed * 2;
  const height = Math.max(1, Math.round(context.viewportHeight)) + bleed * 2;
  // 밝은 색 어둠 막은 같은 색상의 어두운 색조로 낮춘다(effectiveDarkness) — 방 전체가 안개 낀 듯 뭉개지지 않게.
  const blend = lightingBlend(state);
  const darkness = effectiveDarkness(state.color, state.ambient, blend);
  const sources = [...state.sources];
  // 짙은 어둠에 플레이어를 따라가는 빛이 없으면 플레이어 둘레만 살짝 걷어 내 주인공이 어둠에 묻히지 않게 한다.
  if (darkness.ambient >= PLAYER_PRESENCE_LIGHT.minAmbient && !sources.some((source) => source.at === "player")) {
    sources.push({ id: PLAYER_PRESENCE_LIGHT.id, at: "player", radius: PLAYER_PRESENCE_LIGHT.radius, intensity: PLAYER_PRESENCE_LIGHT.intensity });
  }
  return {
    ambient: darkness.ambient,
    color: darkness.color,
    blend,
    vignette: state.vignette ?? 0,
    width,
    height,
    ...(context.mapBounds ? { clip: mapClip(context, width, height, bleed) } : {}),
    ...(context.darkMargin ? { darkMargin: true } : {}),
    ...(bleed > 0 ? { bleed } : {}),
    // 화면과 겹치지 않는 광원은 마스크에 아무 픽셀도 바꾸지 않는다. 서명·그리기에서 빼야 화면 밖
    // 깜빡이는 광원 하나 때문에 16ms 마다 캔버스 전체를 다시 그리고 텍스처를 올리지 않는다.
    gradients: sources
      .map((source) => lightGradientParam(source, context, bleed))
      .filter((param): param is LightGradientParam => param !== null && gradientTouchesViewport(param, width, height)),
  };
}

/** 맵 세계 사각을 화면(캔버스 px)으로 옮겨 화면 안으로 자른다. 정수로 맞춰 가장자리에 반 픽셀 띠가 남지 않게 한다. */
function mapClip(context: LightingMaskContext, width: number, height: number, bleed = 0): NonNullable<LightingMaskParams["clip"]> {
  const bounds = context.mapBounds!;
  const zoom = Number.isFinite(context.zoom) && context.zoom > 0 ? context.zoom : 1;
  const left = Math.max(0, Math.round((bounds.x - context.cameraX) * zoom) + bleed);
  const top = Math.max(0, Math.round((bounds.y - context.cameraY) * zoom) + bleed);
  const right = Math.min(width, Math.round((bounds.x + bounds.width - context.cameraX) * zoom) + bleed);
  const bottom = Math.min(height, Math.round((bounds.y + bounds.height - context.cameraY) * zoom) + bleed);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** 그라디언트가 칠하는 사각(drawLightingMask 의 fillRect)이 화면 [0,w]×[0,h] 과 겹치는가. */
function gradientTouchesViewport(param: LightGradientParam, width: number, height: number): boolean {
  const r = Math.max(0, param.radiusPx);
  return param.centerX + r > 0 && param.centerX - r < width && param.centerY + r > 0 && param.centerY - r < height;
}

export function lightingMaskSignature(params: LightingMaskParams): string {
  // 매 프레임 불린다. 화면 좌표·반지름은 0.5px, 깜빡임은 0.02 단위로 양자화해 카메라 러프 미세 떨림에 의한 매 프레임 풀-캔버스 재그리기·GPU 업로드를 막는다.
  let signature = `${round(params.ambient)}|${params.color}|${params.blend}|${round(params.vignette)}|${params.width}x${params.height}`;
  if (params.clip) signature += `|c${params.clip.x},${params.clip.y},${params.clip.width},${params.clip.height}`;
  if (params.darkMargin) signature += "|m";
  for (const entry of params.gradients) {
    signature += `|${entry.id}:${roundHalf(entry.centerX)},${roundHalf(entry.centerY)},${roundHalf(entry.radiusPx)},${round(entry.intensity)},${entry.color ?? ""},${roundFlicker(entry.flicker)}${entry.arc ? `,${round(entry.arc[0])}~${round(entry.arc[1])}` : ""}${entry.edge ? ",h" : ""}${entry.polyHash !== undefined ? `,p${entry.polyHash}` : ""}`;
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
  const darkClip = params.darkMargin ? undefined : clip;
  if (darkClip) context.fillRect(darkClip.x, darkClip.y, darkClip.width, darkClip.height);
  else context.fillRect(0, 0, params.width, params.height);
  context.restore();
  if (params.vignette > 0) drawVignette(context, params, darkClip);

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
    // 빛은 가운데서 바깥으로 꾸준히 사위어야 한다. 예전 곡선(0.7 까지 65% 유지 후 급락)은 반지름 끝까지 거의 다 걷어 내
    // 흰 눈·얼음 위에서 등불마다 테두리 선명한 하얀 원판이 떴다(폴른 스타 서리나루 해 질 녘·밤, 2026-10-31).
    for (const [at, k] of lightFalloffCurve(light.edge)) gradient.addColorStop(at, `rgba(0,0,0,${alpha * k})`);
    context.fillStyle = gradient;
    fillLight(context, light);
  }
  context.restore();

  // 빛 색 — 어둠만 걷어 내면 가로등·창 불빛이 «덜 어두운 자리»로만 보이고 따뜻한 불빛으로 읽히지 않았다(첫사랑 밤거리, VQA r22).
  // 색을 준 광원은 걷어 낸 자리에 그 색을 옅게 얹는다. 어두운 장면일수록(ambient) 진하다. 흰빛에 가까우면 거의 티가 안 난다.
  // 어둠과 같은 맵 사각 안에만 — 자르지 않으면 맵 가장자리 경비 등불(부채꼴)의 색이 맵 밖 검은 빈칸까지 번져
  // 벽 너머 허공에 빛 쐐기가 떴다(폴른 스타 제2막 막사, 처음 하는 사람 검수 2026-10-31).
  context.save();
  context.globalCompositeOperation = "source-over";
  if (clip) {
    context.beginPath();
    context.rect(clip.x, clip.y, clip.width, clip.height);
    context.clip();
  }
  for (const light of params.gradients) {
    const rgb = light.color ? hexRgb(light.color) : null;
    if (!rgb || light.radiusPx <= 0 || light.intensity <= 0) continue;
    const alpha = clamp01(light.intensity) * LIGHT_TINT_STRENGTH * params.ambient;
    const gradient = context.createRadialGradient(light.centerX, light.centerY, 0, light.centerX, light.centerY, light.radiusPx);
    // 색은 걷어 낸 만큼 같은 곡선으로 얹는다 — 걷힌 자리가 맨바닥(흰 눈)으로 비치지 않고 그 불빛 색으로 물든다.
    for (const [at, k] of lightFalloffCurve(light.edge)) gradient.addColorStop(at, `rgba(${rgb},${alpha * k})`);
    context.fillStyle = gradient;
    fillLight(context, light);
  }
  context.restore();
}

/**
 * 빛 색을 얹는 세기(어둠 × 광원 세기에 곱한다). 0.4 는 걷어 낸 자리의 맨바닥이 그대로 비쳐, 밝은 바닥(눈·얼음·흰 돌) 위
 * 따뜻한 등불이 흰 원으로 읽혔다(2026-10-31). 걷어 낸 양의 대부분을 불빛 색이 다시 채운다.
 */
const LIGHT_TINT_STRENGTH = 0.8;

/**
 * 가장자리 어둠 — 화면 가운데는 그대로, 바깥으로 갈수록 검정을 덧칠한다(타원). 어둠 막 다음·광원 걷어 내기 전에 그려
 * 등불·모닥불 둘레는 가장자리여도 걷힌다. 곱하기 막이면 그 자리 색에 (1−비네트)를 곱하는 셈이다.
 * 밤 장면이 화면 끝까지 같은 밝기의 판으로 깔려 「색만 입힌 낮」으로 읽혔다(폴른 스타 서리나루 밤, 2026-11-03).
 */
function drawVignette(context: CanvasRenderingContext2D, params: LightingMaskParams, clip: LightingMaskParams["clip"]): void {
  // 비네트는 화면 크기로 그린다 — 여유(bleed) 바깥은 가장 짙은 끝 값으로 이어진다.
  const bleed = params.bleed ?? 0;
  const w = params.width - bleed * 2, h = params.height - bleed * 2;
  const cx = w / 2;
  context.save();
  context.globalCompositeOperation = "source-over";
  if (clip) {
    context.beginPath();
    context.rect(clip.x, clip.y, clip.width, clip.height);
    context.clip();
  }
  // 가로로 긴 화면에 맞춘 타원 — 세로를 h/w 로 눌러 원을 그린다. 눌린 좌표에서 화면 네 귀퉁이는 가운데서 cx·√2 다.
  context.translate(bleed + cx, bleed + h / 2);
  context.scale(1, h / w);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, cx * Math.SQRT2);
  const v = clamp01(params.vignette);
  for (const [at, k] of VIGNETTE_CURVE) gradient.addColorStop(at, `rgba(0,0,0,${v * k})`);
  context.fillStyle = gradient;
  context.fillRect(-cx - bleed, -(h / 2 + bleed) * (w / h), w + bleed * 2, (h + bleed * 2) * (w / h));
  context.restore();
}

/** 비네트 곡선 [가운데에서의 거리 비율, 세기] — 화면 가운데 절반은 비워 둔다. */
const VIGNETTE_CURVE: readonly (readonly [number, number])[] = [[0, 0], [0.42, 0], [0.7, 0.45], [0.9, 0.85], [1, 1]];

/** 둥근 빛은 사각을, 부채꼴 빛(경비 등불 시야)은 부채꼴을, 벽 차폐 다각형이 있으면 그 가시 다각형만 칠한다. */
function fillLight(context: CanvasRenderingContext2D, light: LightGradientParam): void {
  if (light.poly && light.poly.length >= 3) {
    context.beginPath();
    if (light.arc) {
      context.moveTo(light.centerX, light.centerY);
      for (const [px, py] of light.poly) context.lineTo(px, py);
    } else {
      context.moveTo(light.poly[0]![0], light.poly[0]![1]);
      for (let i = 1; i < light.poly.length; i += 1) context.lineTo(light.poly[i]![0], light.poly[i]![1]);
    }
    context.closePath();
    context.fill();
    return;
  }
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

/** 2D 타일 격자 DDA 레이캐스트 — 빛이 불투명 벽 타일에서 정확히 멈추고 모서리 뒤는 그림자로 남긴다. */
function castLightRayTiles(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  isOpaque: (tx: number, ty: number) => boolean,
): number {
  const startTx = Math.floor(ox);
  const startTy = Math.floor(oy);
  let tx = startTx;
  let ty = startTy;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : 1e9;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : 1e9;
  let tMaxX = stepX > 0 ? (tx + 1 - ox) * tDeltaX : stepX < 0 ? (ox - tx) * tDeltaX : 1e9;
  let tMaxY = stepY > 0 ? (ty + 1 - oy) * tDeltaY : stepY < 0 ? (oy - ty) * tDeltaY : 1e9;
  let dist = 0;

  for (let iter = 0; iter < 48; iter += 1) {
    if (tMaxX < tMaxY) {
      dist = tMaxX;
      tMaxX += tDeltaX;
      tx += stepX;
    } else {
      dist = tMaxY;
      tMaxY += tDeltaY;
      ty += stepY;
    }
    if (dist >= maxDist) return maxDist;
    if (isOpaque(tx, ty)) {
      // 벽 앞면을 살짝(0.22칸) 비춰 줘서 벽 자체가 새까맣게 잘리지 않고 자연스럽게 닿아 보인다.
      return Math.min(maxDist, dist + 0.22);
    }
  }
  return maxDist;
}

function normalizeAngleToSpan(angle: number, startAngle: number): number {
  const twoPi = Math.PI * 2;
  let rel = (angle - startAngle) % twoPi;
  if (rel < 0) rel += twoPi;
  return startAngle + rel;
}

function buildVisibilityPoly(
  ox: number,
  oy: number,
  radiusTiles: number,
  arc: readonly [number, number] | undefined,
  context: LightingMaskContext,
  zoom: number,
  bleed: number,
): { readonly poly: readonly (readonly [number, number])[]; readonly hash: number } | null {
  const isOpaque = context.isOpaqueTile;
  if (!isOpaque || radiusTiles <= 0.5) return null;
  const startAngle = arc ? arc[0] : 0;
  const span = arc ? arc[1] - arc[0] : Math.PI * 2;
  const baseCount = arc ? 40 : 56;
  const angles: number[] = [];

  for (let i = 0; i < baseCount; i += 1) {
    const frac = arc ? i / Math.max(1, baseCount - 1) : i / baseCount;
    angles.push(startAngle + span * frac);
  }

  // 모서리 브리징(벽 모퉁이 너머 빛 샘)을 막기 위해 반경 내 모든 불투명 벽 타일의 4꼭짓점 양옆(±eps)에 레이를 추가한다.
  const radCeil = Math.ceil(radiusTiles);
  const otx = Math.floor(ox);
  const oty = Math.floor(oy);
  const r2 = (radiusTiles + 1.5) * (radiusTiles + 1.5);
  const cornerEps = 0.0015;
  const seenCorner = new Set<number>();

  for (let ty = oty - radCeil; ty <= oty + radCeil; ty += 1) {
    for (let tx = otx - radCeil; tx <= otx + radCeil; tx += 1) {
      if (tx === otx && ty === oty) continue;
      if (!isOpaque(tx, ty)) continue;
      const cx0 = tx + 0.5 - ox;
      const cy0 = ty + 0.5 - oy;
      if (cx0 * cx0 + cy0 * cy0 > r2) continue;
      const corners: readonly (readonly [number, number])[] = [
        [tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1],
      ];
      for (const [kx, ky] of corners) {
        const key = (kx + 2048) * 4096 + (ky + 2048);
        if (seenCorner.has(key)) continue;
        seenCorner.add(key);
        const raw = Math.atan2(ky - oy, kx - ox);
        for (const delta of [-cornerEps, cornerEps]) {
          const a = normalizeAngleToSpan(raw + delta, startAngle);
          if (a >= startAngle && a <= startAngle + span) angles.push(a);
        }
      }
    }
  }

  angles.sort((a, b) => a - b);

  const poly: Array<readonly [number, number]> = [];
  let hash = 2166136261 >>> 0;
  let hitAnyWall = false;
  let prevAngle = -1e9;

  for (const angle of angles) {
    if (angle - prevAngle < 0.0004) continue;
    prevAngle = angle;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const hitDist = castLightRayTiles(ox, oy, dx, dy, radiusTiles, isOpaque);
    if (hitDist < radiusTiles - 0.01) hitAnyWall = true;
    const wx = (ox + dx * hitDist) * context.tileSize;
    const wy = (oy + dy * hitDist) * context.tileSize;
    const sx = (wx - context.cameraX) * zoom + bleed;
    const sy = (wy - context.cameraY) * zoom + bleed;
    poly.push([sx, sy]);
    hash = Math.imul(hash ^ Math.round(hitDist * 20), 16777619) >>> 0;
  }
  return hitAnyWall ? { poly, hash } : null;
}

function hexRgb(color: string): string | null {
  const m = /^#([0-9a-f]{6})$/iu.exec(color.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function lightGradientParam(source: LightSource, context: LightingMaskContext, bleed = 0): LightGradientParam | null {
  const position = context.resolveAnchor(source.at, source);
  if (!position) return null;
  const zoom = Number.isFinite(context.zoom) && context.zoom > 0 ? context.zoom : 1;
  const ox = position.x + 0.5;
  const oy = position.y + 0.5;
  const centerX = (ox * context.tileSize - context.cameraX) * zoom + bleed;
  const centerY = (oy * context.tileSize - context.cameraY) * zoom + bleed;
  const arc = source.cone ? coneArc(source.cone.degrees, position.facing ?? source.cone.facing) : undefined;
  const shouldOcclude = Boolean(context.isOpaqueTile)
    && source.id !== PLAYER_PRESENCE_LIGHT.id
    && (Boolean(arc) || source.radius >= 2.2);
  const vis = shouldOcclude ? buildVisibilityPoly(ox, oy, source.radius, arc, context, zoom, bleed) : null;
  return {
    id: source.id,
    centerX,
    centerY,
    radiusPx: source.radius * context.tileSize * zoom,
    // 빛을 든 몸이 흐려지면(이벤트 불투명도) 빛도 같이 — 몸 없이 등불만 남지 않는다.
    intensity: lightSourceIntensity(source, context.timeMs) * clamp01(position.fade ?? 1),
    color: source.color,
    flicker: source.flicker ? deterministicFlickerFactor(source.id, context.timeMs) : 1,
    ...(arc ? { arc } : {}),
    ...(source.edge === "hard" ? { edge: "hard" as const } : {}),
    ...(vis ? { poly: vis.poly, polyHash: vis.hash } : {}),
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

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function roundFlicker(value: number): number {
  return Math.round(value * 50) / 50;
}
