// player/weather/weatherOverlay.ts
// 날씨(비/눈/안개) DOM 오버레이. 순수 모델(weatherModel)이 산출한 종류/강도로
// 파티클 개수를 정하고, 실제 낙하 애니메이션은 CSS(runtime/weather.css)가 담당한다.
// 안개는 파티클 대신 반투명 그라디언트 레이어로 표현한다.

import {
  fogOpacity,
  isWeatherActive,
  parseWeather,
  weatherParticleCount,
  type WeatherParams,
} from "@/player/weather/weatherModel";

const WEATHER_TESTID = "runtime-weather-overlay";
// 강도 1일 때 최대 파티클 수(성능/시각 균형).
const MAX_PARTICLES = 80;

// 세션의 weather 문자열을 host 오버레이에 반영한다. 없음이면 제거.
export function syncWeatherOverlay(host: HTMLElement, weatherValue: string | undefined): void {
  const params = parseWeather(weatherValue);
  if (!isWeatherActive(params)) {
    removeWeatherOverlay(host);
    return;
  }
  const overlay = upsertOverlay(host);
  overlay.dataset.kind = params.kind;
  overlay.dataset.intensity = String(round(params.intensity));
  if (params.kind === "fog") {
    renderFog(overlay, params);
  } else {
    renderParticles(overlay, params);
  }
}

export function removeWeatherOverlay(host: HTMLElement): void {
  findOverlay(host)?.remove();
}

function findOverlay(host: HTMLElement): HTMLElement | null {
  const found = host.querySelector(`[data-testid='${WEATHER_TESTID}']`);
  return found instanceof HTMLElement ? found : null;
}

function upsertOverlay(host: HTMLElement): HTMLElement {
  const existing = findOverlay(host);
  if (existing) return existing;
  const overlay = document.createElement("div");
  overlay.className = "runtime-weather-overlay";
  overlay.dataset.testid = WEATHER_TESTID;
  host.append(overlay);
  return overlay;
}

function clearChildren(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderParticles(overlay: HTMLElement, params: WeatherParams): void {
  const count = weatherParticleCount(params, MAX_PARTICLES);
  const current = overlay.childNodes.length;
  if (overlay.dataset.rendered !== `${params.kind}:${count}`) {
    clearChildren(overlay);
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = `weather-particle weather-particle-${params.kind}`;
      // 위치/지연을 결정론적으로 분산(랜덤 미사용: 저장/재현 안정성).
      particle.style.left = `${round((i * 37) % 100)}%`;
      particle.style.setProperty("--weather-delay", `${round((i % 20) * 0.15)}s`);
      particle.style.setProperty("--weather-duration", `${round(params.kind === "snow" ? 3.2 : 1.1)}s`);
      overlay.append(particle);
    }
    overlay.dataset.rendered = `${params.kind}:${count}`;
    overlay.style.opacity = "1";
    overlay.style.background = "";
    return;
  }
  void current;
}

function renderFog(overlay: HTMLElement, params: WeatherParams): void {
  clearChildren(overlay);
  overlay.dataset.rendered = "fog";
  overlay.style.background =
    "linear-gradient(180deg, rgba(210,214,222,0.9) 0%, rgba(190,196,206,0.7) 100%)";
  overlay.style.opacity = String(fogOpacity(params));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
