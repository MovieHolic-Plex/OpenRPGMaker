// player/titleParticles.ts
// 타이틀 파티클 — 순수 결정론 모델 + canvas rAF 렌더러.
//
// 계약:
//  - 좌표/불투명도는 시각 t(ms)와 인덱스의 **순수 함수**다. Math.random 을 쓰지 않아
//    같은 (preset, density, t) 입력은 항상 같은 프레임을 만든다(테스트 가능).
//  - 눈/비 개수는 기존 날씨 순수 모델(weatherParticleCount, playSceneWeather 관례
//    MAX_PARTICLES=96)을 재사용하고, 좌표 공식도 playSceneWeather.renderPrecipitation 과
//    동일 눈금을 쓴다. 반딧불(fireflies)만 신규 순수 모델이다.
//  - fakeDom 은 canvas 2D 컨텍스트를 제공하지 않는다(getContext → null). 렌더러는 그
//    계약을 그대로 지켜 컨텍스트가 없으면 그리지 않고 rAF 도 시작하지 않는다.
//  - prefers-reduced-motion: reduce 면 t=0 정지 프레임만 그리고 애니메이션하지 않는다.
//  - rAF 는 canvas 가 DOM 에서 분리되면 다음 프레임에 스스로 해제된다(타이틀 이탈 teardown).

import { weatherParticleCount } from "@/player/weather/weatherModel";
import type { TitleParticlePreset, TitleParticleSettings } from "@/project/types";

/** 날씨 오버레이 관례(playSceneWeather MAX_PARTICLES=96) 준용 상한. */
export const TITLE_PARTICLE_MAX = 96;
/** 반딧불은 과밀하면 벌레떼처럼 보인다 — 별도 낮은 상한. */
export const TITLE_FIREFLY_MAX = 32;
export const DEFAULT_TITLE_PARTICLE_DENSITY = 50;
export const TITLE_PARTICLE_STAGE = { width: 320, height: 240 } as const;

export type TitleParticlePoint = {
  readonly x: number;
  readonly y: number;
  /** 비는 획 길이 절반, 눈/반딧불은 반지름으로 쓰는 크기 눈금. */
  readonly size: number;
  readonly opacity: number;
};

/** density 0..100 → 파티클 개수. 눈/비는 날씨 모델 계약 재사용, 반딧불은 자체 상한. */
export function titleParticleCount(preset: TitleParticlePreset, density: number | undefined): number {
  const raw = typeof density === "number" && Number.isFinite(density) ? density : DEFAULT_TITLE_PARTICLE_DENSITY;
  const intensity = Math.max(0, Math.min(1, raw / 100));
  if (intensity <= 0) return 0;
  if (preset === "fireflies") return Math.max(1, Math.round(TITLE_FIREFLY_MAX * intensity));
  return weatherParticleCount({ kind: preset, intensity }, TITLE_PARTICLE_MAX);
}

/** 시각 t 의 전체 파티클 좌표. 같은 입력 → 같은 출력(결정론). */
export function titleParticlePositions(
  settings: TitleParticleSettings,
  timeMs: number,
  width = TITLE_PARTICLE_STAGE.width,
  height = TITLE_PARTICLE_STAGE.height,
): TitleParticlePoint[] {
  const count = titleParticleCount(settings.preset, settings.density);
  const points: TitleParticlePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push(titleParticleAt(settings.preset, index, timeMs, width, height));
  }
  return points;
}

function titleParticleAt(
  preset: TitleParticlePreset,
  index: number,
  timeMs: number,
  width: number,
  height: number,
): TitleParticlePoint {
  if (preset === "fireflies") return fireflyAt(index, timeMs, width, height);
  // 눈/비 좌표 눈금은 playSceneWeather.renderPrecipitation 과 동일(37/53 스트라이드, 0.03 횡류).
  const speed = preset === "rain" ? 0.46 : 0.14;
  const x = positiveModulo(index * 37 + Math.floor(timeMs * 0.03), width + 32) - 16;
  const y = positiveModulo(index * 53 + Math.floor(timeMs * speed), height + 48) - 24;
  if (preset === "rain") {
    return { x: round3(x), y: round3(y), size: 7, opacity: 0.78 };
  }
  const drift = Math.sin((timeMs + index * 91) / 500) * 6;
  return { x: round3(x + drift), y: round3(y), size: 2.4, opacity: 0.86 };
}

// 반딧불 순수 모델: 느린 사인 궤적 + 주기 점멸. RNG 없이 index 위상만으로 흩뿌린다.
function fireflyAt(index: number, timeMs: number, width: number, height: number): TitleParticlePoint {
  const x = positiveModulo(index * 97 + Math.sin((timeMs + index * 233) / 2600) * 38 + Math.floor(timeMs * 0.005), width);
  const y = positiveModulo(index * 59 + Math.cos((timeMs + index * 151) / 2100) * 24, height);
  const pulse = (Math.sin((timeMs + index * 313) / 700) + 1) / 2;
  const opacity = 0.2 + pulse * 0.7;
  const size = 1.5 + ((index * 7) % 3) * 0.5;
  return { x: round3(x), y: round3(y), size, opacity: round3(opacity) };
}

/**
 * 파티클 canvas 생성 + rAF 구동. 반환된 canvas 는 설정 서명이 같은 재렌더에서
 * 그대로 옮겨(move) 붙일 수 있고, rAF 는 canvas 참조를 통해 계속 동작한다.
 */
export function createTitleParticlesCanvas(settings: TitleParticleSettings): HTMLCanvasElement {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "rm-title-particles";
  canvas.width = TITLE_PARTICLE_STAGE.width;
  canvas.height = TITLE_PARTICLE_STAGE.height;
  canvas.dataset.testid = "title-particles";
  canvas.dataset.titleParticlePreset = settings.preset;
  if (settings.density !== undefined) canvas.dataset.titleParticleDensity = String(settings.density);
  startTitleParticles(canvas, settings);
  return canvas;
}

const activeParticleFrames = new WeakMap<HTMLCanvasElement, number>();

/** 명시적 해제(안전망). 평상시엔 canvas 분리 시 rAF 가 자체 해제된다. */
export function stopTitleParticles(canvas: HTMLCanvasElement): void {
  const frame = activeParticleFrames.get(canvas);
  if (frame === undefined) return;
  activeParticleFrames.delete(canvas);
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
}

function startTitleParticles(canvas: HTMLCanvasElement, settings: TitleParticleSettings): void {
  // fakeDom/미지원 환경: getContext 가 null 을 돌려준다 — 계약대로 조용히 그리지 않는다.
  const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!context) return;
  drawTitleParticles(context, settings, 0);
  if (prefersReducedMotion()) return; // 정지 프레임만 — 파티클 애니메이션 정지.
  if (typeof requestAnimationFrame !== "function") return;
  const startedAt = nowMs();
  const tick = (): void => {
    // 타이틀 이탈(노드 제거) 시 다음 프레임에 자체 해제 — player teardown 훅이 따로 필요 없다.
    if (!canvas.isConnected) {
      activeParticleFrames.delete(canvas);
      return;
    }
    drawTitleParticles(context, settings, nowMs() - startedAt);
    activeParticleFrames.set(canvas, requestAnimationFrame(tick));
  };
  activeParticleFrames.set(canvas, requestAnimationFrame(tick));
}

function drawTitleParticles(
  context: CanvasRenderingContext2D,
  settings: TitleParticleSettings,
  timeMs: number,
): void {
  const { width, height } = TITLE_PARTICLE_STAGE;
  context.clearRect(0, 0, width, height);
  for (const point of titleParticlePositions(settings, timeMs, width, height)) {
    if (settings.preset === "rain") {
      context.strokeStyle = `rgba(174, 208, 255, ${point.opacity})`;
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(point.x + 4, point.y + point.size * 2);
      context.stroke();
      continue;
    }
    const color = settings.preset === "fireflies" ? "255, 226, 130" : "255, 255, 255";
    context.fillStyle = `rgba(${color}, ${point.opacity})`;
    context.beginPath();
    context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
    context.fill();
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
