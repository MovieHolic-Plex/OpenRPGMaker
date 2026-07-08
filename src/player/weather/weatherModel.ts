// player/weather/weatherModel.ts
// 날씨 효과의 순수 파라미터 모델. Set Weather Effects 명령이 세션에 기록한
// 문자열(runtime.screen.weather)을 종류 + 강도로 해석한다. DOM 오버레이는
// 이 결과로 파티클 개수/애니메이션을 구성한다.

import type { WeatherKind } from "@/project/types";

export type { WeatherKind } from "@/project/types";

export type WeatherParams = {
  readonly kind: WeatherKind;
  // 강도 0~1 (0 = 없음, 1 = 최대).
  readonly intensity: number;
};

export const NO_WEATHER: WeatherParams = { kind: "none", intensity: 0 };

const KIND_ALIASES: Record<string, WeatherKind> = {
  none: "none",
  off: "none",
  clear: "none",
  rain: "rain",
  비: "rain",
  storm: "storm",
  thunder: "storm",
  thunderstorm: "storm",
  폭풍: "storm",
  snow: "snow",
  눈: "snow",
  fog: "fog",
  mist: "fog",
  안개: "fog",
};

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// RM2K3 날씨 강도는 대략 0~10 눈금. 0~10 을 0~1 로 정규화하되,
// 이미 0~1 범위 소수(<=1)면 그대로 강도로 취급한다.
function normalizeStrength(raw: number): number {
  if (!Number.isFinite(raw)) return 0.5;
  if (raw <= 0) return 0;
  if (raw <= 1) return clampIntensity(raw);
  return clampIntensity(raw / 10);
}

// 날씨 문자열 파싱. 지원 형식:
//   "rain" / "snow,8" / "fog 0.4" / "비,5" / "none"
// 종류만 있고 강도가 없으면 기본 강도 0.5.
export function parseWeather(value: string | undefined): WeatherParams {
  if (value === undefined) return NO_WEATHER;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return NO_WEATHER;
  const tokens = trimmed.split(/[\s,:;]+/).filter((token) => token.length > 0);
  let kind: WeatherKind = "none";
  let strength: number | undefined;
  for (const token of tokens) {
    const alias = KIND_ALIASES[token];
    if (alias !== undefined) {
      kind = alias;
      continue;
    }
    const parsed = Number(token);
    if (Number.isFinite(parsed)) strength = parsed;
  }
  if (kind === "none") return NO_WEATHER;
  const intensity = strength === undefined ? 0.5 : normalizeStrength(strength);
  return normalizeWeatherParams({ kind, intensity });
}

export function normalizeWeatherParams(params: { readonly kind: WeatherKind; readonly intensity?: number }): WeatherParams {
  if (params.kind === "none") return NO_WEATHER;
  const intensity = clampIntensity(params.intensity ?? 0.5);
  if (intensity <= 0) return NO_WEATHER;
  return { kind: params.kind, intensity };
}

export function weatherToRuntimeString(params: WeatherParams): string {
  if (!isWeatherActive(params)) return "none";
  return `${params.kind},${round(params.intensity)}`;
}

export function isWeatherActive(params: WeatherParams): boolean {
  return params.kind !== "none" && params.intensity > 0;
}

// 강도 → 파티클 개수. maxParticles 는 최대(강도 1). rain/snow 용.
export function weatherParticleCount(params: WeatherParams, maxParticles: number): number {
  if (!isWeatherActive(params)) return 0;
  if (params.kind === "fog") return 0; // 안개는 파티클 대신 그라디언트 레이어.
  const max = Math.max(0, Math.floor(maxParticles));
  return Math.max(1, Math.round(max * params.intensity));
}

// 안개 불투명도(0~1). 강도에 비례하되 과하지 않게 상한 0.6.
export function fogOpacity(params: WeatherParams): number {
  if (params.kind !== "fog" || params.intensity <= 0) return 0;
  return round(Math.min(0.6, 0.15 + params.intensity * 0.45));
}

export type WeatherTransition = {
  readonly from: WeatherParams;
  readonly to: WeatherParams;
  readonly durationMs: number;
  elapsedMs: number;
};

export function advanceWeatherTransition(transition: WeatherTransition, deltaMs: number): { readonly params: WeatherParams; readonly done: boolean } {
  transition.elapsedMs = Math.min(transition.durationMs, transition.elapsedMs + Math.max(0, deltaMs));
  const t = transition.durationMs <= 0 ? 1 : transition.elapsedMs / transition.durationMs;
  const intensity = transition.from.intensity + (transition.to.intensity - transition.from.intensity) * t;
  const kind = t >= 1 ? transition.to.kind : transition.to.kind === "none" ? transition.from.kind : transition.to.kind;
  const params = normalizeWeatherParams({ kind, intensity });
  return { params, done: t >= 1 };
}

// 폭풍 번개는 RNG 없이 고정 주기 펄스로 계산한다. 같은 timeMs/intensity 입력은 항상
// 같은 opacity를 돌려줘 scene_test와 실제 런타임이 동일하게 재현된다.
export function stormFlashOpacity(params: WeatherParams, timeMs: number): number {
  if (params.kind !== "storm" || params.intensity <= 0) return 0;
  const phase = positiveModulo(Math.floor(timeMs), 2400);
  const first = pulse(phase, 120, 90);
  const second = pulse(phase, 290, 55);
  return round(Math.min(0.85, Math.max(first, second) * (0.35 + params.intensity * 0.65)));
}

function pulse(value: number, center: number, halfWidth: number): number {
  const distance = Math.abs(value - center);
  if (distance >= halfWidth) return 0;
  return 1 - distance / halfWidth;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
