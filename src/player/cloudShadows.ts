// player/cloudShadows.ts
// 맵 위를 흘러가는 구름 그림자의 순수 파라미터 모델. DOM·Phaser 없이 계산만 한다.
//
// 왜 순수 함수인가: 그림자는 매 프레임 움직이므로 «위치» 를 어디에도 저장하지 않는다.
// (경과 시간, 설정, 화면 사각) 만 주면 같은 그림자가 나온다 — 세이브/재현/테스트가 같은
// 계산을 공유하고, QA 는 픽셀이 아니라 이 값으로 «흐르는 방향» 을 판정할 수 있다.
//
// 좌표계는 **월드 px** 다. 구름은 카메라에 매달리지 않고 땅에 붙어 흐른다 — 카메라가
// 움직이면 그림자도 같이 밀려 지나간다. 무한히 이어지도록 seed 별 덩어리를 «주기(period)»
// 격자에 접어(modulo) 화면이 닿는 칸마다 복사본을 놓는다. 그래서 맵 크기와 무관하게
// 화면은 언제나 같은 밀도로 덮인다.

import type { MapCloudShadowSetting } from "@/project/types";

export type CloudShadowParams = {
  readonly enabled: boolean;
  /** 그림자 진하기 0.05~0.6. 개별 덩어리 알파의 상한이다. */
  readonly opacity: number;
  /** 흐르는 속도 — 월드 px/초. 0이면 제자리. */
  readonly speed: number;
  /** 흐르는 방향(도). 0=오른쪽, 90=아래. */
  readonly angleDeg: number;
  /** 덩어리 크기 배율. 커지면 주기도 함께 커져 화면 덮임 비율이 유지된다. */
  readonly scale: number;
};

/** 그림자를 계산할 화면(월드 사각). 카메라 worldView 를 그대로 넘긴다. */
export type CloudShadowView = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** 화면에 놓을 그림자 덩어리 하나(월드 px). */
export type CloudShadowBlob = {
  readonly x: number;
  readonly y: number;
  /** 타원 긴 반지름(월드 px). */
  readonly radius: number;
  /** 이 덩어리의 알파(opacity 이하). */
  readonly alpha: number;
  /** 긴 축의 회전(도). */
  readonly rotationDeg: number;
  /** 짧은 반지름 / 긴 반지름. */
  readonly squash: number;
  /** 어느 실루엣으로 그릴지 — `cloudShadowSilhouette` 의 변주 번호. */
  readonly variant: number;
};

/**
 * 실루엣을 이루는 로브 하나. 좌표는 «덩어리 한 변을 1 로 본» 정규화 값이다(0~1, 중심 0.5).
 * 그림 도구가 무엇이든(캔버스·셰이더) 같은 실루엣이 나오도록 모양은 여기서만 정한다.
 */
export type CloudShadowLobe = {
  readonly cx: number;
  readonly cy: number;
  /** 정규화 반지름 — 0.5 면 덩어리 한 변을 가득 채운다. */
  readonly radius: number;
};

export const CLOUD_SHADOW_OPACITY_RANGE = { min: 0.05, max: 0.6 } as const;
export const CLOUD_SHADOW_SPEED_RANGE = { min: 0, max: 160 } as const;
export const CLOUD_SHADOW_SCALE_RANGE = { min: 0.5, max: 2.5 } as const;

/** seed 하나가 만드는 덩어리 수. 화면 덮임 밀도는 이 값이 정한다. */
export const CLOUD_SHADOW_BLOB_COUNT = 12;

/**
 * 실루엣 변주 수. 원 하나로 그리면 «구름» 이 아니라 «동그란 얼룩» 으로 읽힌다(실측) —
 * 로브 여러 개의 합집합으로 윤곽을 울퉁불퉁하게 만들고, 변주를 몇 개 두어 같은 모양이
 * 화면에 겹쳐 보이지 않게 한다.
 */
export const CLOUD_SHADOW_SILHOUETTE_COUNT = 4;

/** 로브 개수 범위. 적으면 원에 가깝고 많으면 뭉개져 다시 원이 된다. */
const CLOUD_SHADOW_LOBE_COUNT = { min: 5, max: 7 } as const;

/**
 * 로브 중심에서 이 비율까지는 알파가 평평하다. 가장자리 전부가 반그림자면 «지나가는 그늘»
 * 이 아니라 «화면 밝기가 숨 쉬는 것» 으로 보인다(실측) — 코어를 평평하게 둬야 경계가 읽힌다.
 */
export const CLOUD_SHADOW_LOBE_CORE_FRACTION = 0.62;

/**
 * 덩어리별 속도 배율 범위. 12개가 정확히 같은 속도로 가면 «판 하나를 끌고 간다» 로 보인다.
 * 중앙값은 1 이라 설정한 속도·방향은 그대로 유지된다(QA 가 재는 값이 이 중앙값이다).
 */
export const CLOUD_SHADOW_SPEED_JITTER = { min: 0.88, max: 1.12 } as const;

/** 느린 크기 호흡 — 폭과 한 바퀴 주기(ms). 구름은 흘러가면서 늘어나고 줄어든다. */
export const CLOUD_SHADOW_BREATH = { amount: 0.09, periodMs: 21_000 } as const;

/** 체크만 했을 때의 값. 진하기 0.34 는 «안 보이면 기능이 없는 줄 안다» 와 «너무 어둡다» 사이의 실측값이다. */
export const CLOUD_SHADOW_DEFAULTS = { opacity: 0.34, speed: 26, angleDeg: 28, scale: 1 } as const;

export const NO_CLOUD_SHADOWS: CloudShadowParams = { enabled: false, ...CLOUD_SHADOW_DEFAULTS };

/** 화면 사각을 덮는 주기(월드 px). 배율이 커지면 주기도 커져 «화면을 덮는 비율» 이 유지된다. */
const CLOUD_SHADOW_PERIOD_FACTOR = 1.15;

/**
 * 덩어리 긴 반지름 / 주기. 이 값이 «하늘과 그늘의 비율» 을 정한다 — 12덩어리와 함께
 * 화면의 약 4할을 덮어, 덮힌 곳과 빈 곳이 섞여 구름처럼 읽힌다. 올리면 하늘이 사라진다.
 */
const CLOUD_SHADOW_RADIUS_FRACTION = { min: 0.045, max: 0.11 } as const;

export function normalizeCloudShadowParams(setting: MapCloudShadowSetting | undefined): CloudShadowParams {
  if (!setting) return NO_CLOUD_SHADOWS;
  return {
    enabled: setting.enabled === true,
    opacity: clampNumber(setting.opacity, CLOUD_SHADOW_DEFAULTS.opacity, CLOUD_SHADOW_OPACITY_RANGE.min, CLOUD_SHADOW_OPACITY_RANGE.max),
    speed: clampNumber(setting.speed, CLOUD_SHADOW_DEFAULTS.speed, CLOUD_SHADOW_SPEED_RANGE.min, CLOUD_SHADOW_SPEED_RANGE.max),
    angleDeg: normalizeAngle(setting.angleDeg),
    scale: clampNumber(setting.scale, CLOUD_SHADOW_DEFAULTS.scale, CLOUD_SHADOW_SCALE_RANGE.min, CLOUD_SHADOW_SCALE_RANGE.max),
  };
}

export function cloudShadowDrift(params: CloudShadowParams, elapsedMs: number): { readonly dx: number; readonly dy: number } {
  if (!params.enabled || params.speed <= 0 || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return { dx: 0, dy: 0 };
  const radians = (params.angleDeg * Math.PI) / 180;
  const travelled = params.speed * (elapsedMs / 1000);
  return { dx: round(travelled * Math.cos(radians)), dy: round(travelled * Math.sin(radians)) };
}

export function cloudShadowPeriod(view: CloudShadowView, scale: number): number {
  const span = Math.max(1, view.width, view.height);
  const multiplier = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return Math.max(1, Math.round(span * CLOUD_SHADOW_PERIOD_FACTOR * multiplier));
}

export function cloudShadowBlobs(
  params: CloudShadowParams,
  elapsedMs: number,
  view: CloudShadowView,
  seed = 0,
): readonly CloudShadowBlob[] {
  if (!params.enabled || params.opacity <= 0 || view.width <= 0 || view.height <= 0) return [];
  const period = cloudShadowPeriod(view, params.scale);
  const layout = cloudShadowLayout(seed);
  const anchors = cloudShadowAnchors(params, elapsedMs, period, seed);
  const blobs: CloudShadowBlob[] = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    const entry = layout[index]!;
    const radius = entry.radiusFraction * period * cloudShadowBreath(entry.breathPhase, elapsedMs);
    const firstX = Math.ceil((view.x - radius - anchor.x) / period);
    const lastX = Math.floor((view.x + view.width + radius - anchor.x) / period);
    const firstY = Math.ceil((view.y - radius - anchor.y) / period);
    const lastY = Math.floor((view.y + view.height + radius - anchor.y) / period);
    for (let tileX = firstX; tileX <= lastX; tileX += 1) {
      for (let tileY = firstY; tileY <= lastY; tileY += 1) {
        blobs.push({
          x: anchor.x + tileX * period,
          y: anchor.y + tileY * period,
          radius,
          alpha: round(params.opacity * entry.alphaFactor),
          rotationDeg: entry.rotationDeg,
          squash: entry.squash,
          variant: entry.variant,
        });
      }
    }
  }
  return blobs;
}

/**
 * 구름 «하나» 의 주기 안 위상 — 화면에 보이는 덩어리는 여기에 격자 복사본을 더한 것뿐이다.
 * 그래서 흐름은 이 위상들만 보면 정확히 판정되고, 화면 사각이 달라도 위상은 그대로다.
 */
export function cloudShadowAnchors(
  params: CloudShadowParams,
  elapsedMs: number,
  period: number,
  seed = 0,
): readonly { readonly x: number; readonly y: number }[] {
  if (!params.enabled || params.opacity <= 0 || !Number.isFinite(period) || period <= 0) return [];
  const drift = cloudShadowDrift(params, elapsedMs);
  // 덩어리마다 속도를 살짝 달리 준다 — 방향은 같고, 배율의 중앙값이 1 이라 설정값은 지켜진다.
  return cloudShadowLayout(seed).map((entry) => ({
    x: positiveModulo(entry.u * period + drift.dx * entry.speedFactor, period),
    y: positiveModulo(entry.v * period + drift.dy * entry.speedFactor, period),
  }));
}

/**
 * 호흡 배율 — 덩어리마다 위상이 달라 같은 순간에도 어떤 구름은 늘어나고 어떤 구름은 줄어들어 있다.
 * 시간만으로 결정되므로 위치와 마찬가지로 저장할 것이 없다.
 */
export function cloudShadowBreath(phase: number, elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return round(1 + CLOUD_SHADOW_BREATH.amount * Math.sin(phase * Math.PI * 2));
  }
  const turns = elapsedMs / CLOUD_SHADOW_BREATH.periodMs + phase;
  return round(1 + CLOUD_SHADOW_BREATH.amount * Math.sin(turns * Math.PI * 2));
}

/** 시드 하나가 만드는 덩어리 «모양» — 주기 격자 안의 정규화 좌표다. */
type CloudShadowLayoutEntry = {
  readonly u: number;
  readonly v: number;
  readonly radiusFraction: number;
  readonly alphaFactor: number;
  readonly rotationDeg: number;
  readonly squash: number;
  readonly variant: number;
  /** 이 덩어리만의 속도 배율. */
  readonly speedFactor: number;
  /** 크기 호흡의 시작 위상(0~1). */
  readonly breathPhase: number;
};

/**
 * 변주 번호 하나가 그리는 구름 실루엣 — 큰 몸통 하나에 위성 로브를 붙인 합집합이다.
 * 위성은 몸통 가장자리에 걸치도록 놓아 윤곽만 울퉁불퉁해지고 가운데는 비지 않는다.
 */
export function cloudShadowSilhouette(variant: number): readonly CloudShadowLobe[] {
  const random = mulberry32(hashSeed(Math.abs(Math.trunc(variant)) * 2654435761 + 17));
  const bodyRadius = lerp(0.24, 0.29, random());
  const lobes: CloudShadowLobe[] = [{ cx: 0.5, cy: 0.5, radius: bodyRadius }];
  const count = Math.round(lerp(CLOUD_SHADOW_LOBE_COUNT.min, CLOUD_SHADOW_LOBE_COUNT.max, random()));
  const startAngle = random() * Math.PI * 2;
  for (let index = 0; index < count; index += 1) {
    // 각도는 고르게 돌리되 흔들어 놓는다 — 정확히 등간격이면 꽃잎 모양이 된다.
    const angle = startAngle + ((index + lerp(-0.35, 0.35, random())) / count) * Math.PI * 2;
    const radius = lerp(0.11, 0.2, random());
    const distance = bodyRadius * lerp(0.55, 0.95, random());
    // 가로로 눌러 놓는다: 바람에 끌린 구름은 진행 방향으로 늘어난다.
    const cx = 0.5 + Math.cos(angle) * distance * 1.15;
    const cy = 0.5 + Math.sin(angle) * distance * 0.78;
    lobes.push({
      cx: clampUnit(cx, radius),
      cy: clampUnit(cy, radius),
      radius,
    });
  }
  return lobes;
}

/** 로브가 덩어리 상자를 벗어나면 가장자리가 잘려 직선이 생긴다 — 안쪽으로 접어 둔다. */
function clampUnit(value: number, radius: number): number {
  return round(Math.max(radius, Math.min(1 - radius, value)));
}

/**
 * 시드에서 덩어리 배치를 만든다. 값은 정수 연산 PRNG 라 실행·플랫폼이 달라도 같다 —
 * 같은 맵에 들어갈 때마다 같은 구름이 보여야 한다(진입할 때마다 모양이 바뀌면 눈에 띈다).
 */
function cloudShadowLayout(seed: number): readonly CloudShadowLayoutEntry[] {
  const random = mulberry32(hashSeed(seed));
  const entries: CloudShadowLayoutEntry[] = [];
  for (let index = 0; index < CLOUD_SHADOW_BLOB_COUNT; index += 1) {
    const radiusFraction = lerp(CLOUD_SHADOW_RADIUS_FRACTION.min, CLOUD_SHADOW_RADIUS_FRACTION.max, random());
    entries.push({
      u: random(),
      v: random(),
      radiusFraction,
      alphaFactor: lerp(0.55, 1, random()),
      rotationDeg: random() * 360,
      squash: lerp(0.62, 1, random()),
      variant: Math.floor(random() * CLOUD_SHADOW_SILHOUETTE_COUNT) % CLOUD_SHADOW_SILHOUETTE_COUNT,
      speedFactor: round(lerp(CLOUD_SHADOW_SPEED_JITTER.min, CLOUD_SHADOW_SPEED_JITTER.max, index / Math.max(1, CLOUD_SHADOW_BLOB_COUNT - 1))),
      breathPhase: random(),
    });
  }
  return entries;
}

/** 맵마다 다른 구름이 보이도록 맵 id 를 시드로 접는다(정수 전용 — 해시가 플랫폼 의존이 아니다). */
export function cloudShadowSeedForMap(mapId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < mapId.length; index += 1) {
    hash = Math.imul(hash ^ mapId.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return CLOUD_SHADOW_DEFAULTS.angleDeg;
  return positiveModulo(value, 360);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function hashSeed(seed: number): number {
  return Math.imul((Number.isFinite(seed) ? Math.trunc(seed) : 0) ^ 0x9e3779b9, 2654435761) >>> 0;
}

/** mulberry32 — 32비트 정수 연산만 쓰는 결정적 PRNG. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1) >>> 0;
    value = (value ^ (value + Math.imul(value ^ (value >>> 7), value | 61))) >>> 0;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
