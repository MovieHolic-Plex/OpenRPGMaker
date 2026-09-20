import { resolveMapWeather } from "@/player/weather/weatherModel";
import type Phaser from "phaser";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { StepResult } from "@/player/interpreter";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  advanceWeatherTransition,
  fogOpacity,
  isWeatherActive,
  normalizeWeatherParams,
  parseWeather,
  stormFlashOpacity,
  weatherParticleCount,
  weatherToRuntimeString,
  type WeatherParams,
  type WeatherTransition,
} from "@/player/weather/weatherModel";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

const WEATHER_DEPTH = 800_000;
const WEATHER_FIXED_STEP_MS = 16;
const MAX_PARTICLES = 96;

export type WeatherRenderPlan = {
  readonly active: boolean;
  readonly kind: WeatherParams["kind"];
  readonly particleCount: number;
  readonly fogOpacity: number;
  readonly stormFlashOpacity: number;
};

/** Pure render contract shared by Phaser drawing and focused tests. */
export function weatherRenderPlan(
  params: WeatherParams,
  timeMs: number,
  maxParticles = MAX_PARTICLES,
): WeatherRenderPlan {
  return {
    active: isWeatherActive(params),
    kind: params.kind,
    particleCount: weatherParticleCount(params, maxParticles),
    fogOpacity: fogOpacity(params),
    stormFlashOpacity: stormFlashOpacity(params, timeMs),
  };
}

export function installWeatherLayer(scene: PlaySceneContext): void {
  if (scene.weatherLayer && scene.weatherGraphics) return;
  const layer = scene.add.container(0, 0);
  layer.setDepth(WEATHER_DEPTH);
  layer.setScrollFactor(0);
  const graphics = scene.add.graphics();
  graphics.setScrollFactor(0);
  layer.add(graphics);
  scene.weatherLayer = layer;
  scene.weatherGraphics = graphics;
  scene.weatherClockMs = 0;
  scene.weatherFixedAccumulatorMs = 0;
  scene.weatherDisplayed = parseWeather(scene.session.m2Runtime?.screen.weather);
  scene.weatherTargetSignature = weatherSignature(scene.weatherDisplayed);
  scene.weatherTransition = null;
}

export function updateWeather(scene: PlaySceneContext, deltaMs: number): void {
  installWeatherLayer(scene);
  advanceWeatherClock(scene, deltaMs);
  if (scene.weatherTransition) {
    const next = advanceWeatherTransition(scene.weatherTransition, Math.max(0, deltaMs));
    scene.weatherDisplayed = next.params;
    if (next.done) scene.weatherTransition = null;
  }
  syncWeatherLayer(scene);
}

export function applyWeatherStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "setWeather" }>
): void {
  installWeatherLayer(scene);
  const target = normalizeWeatherParams({ kind: step.weather, intensity: step.intensity });
  ensureM2Runtime(scene.session).screen.weather = weatherToRuntimeString(target);
  const transitionMs = Math.max(0, Math.round(step.transitionMs));
  scene.weatherTargetSignature = weatherSignature(target);
  if (transitionMs <= 0) {
    scene.weatherDisplayed = target;
    scene.weatherTransition = null;
    syncWeatherLayer(scene);
    return;
  }
  scene.weatherTransition = {
    from: scene.weatherDisplayed ?? parseWeather(undefined),
    to: target,
    durationMs: transitionMs,
    elapsedMs: 0,
  } satisfies WeatherTransition;
  syncWeatherLayer(scene);
}

export function syncWeatherLayer(scene: PlaySceneContext): void {
  installWeatherLayer(scene);
  const target = parseWeather(scene.session.m2Runtime?.screen.weather);
  const targetSignature = weatherSignature(target);
  if (targetSignature !== scene.weatherTargetSignature && !scene.weatherTransition) {
    scene.weatherDisplayed = target;
    scene.weatherTargetSignature = targetSignature;
  }
  renderWeather(scene, resolveMapWeather(scene.weatherDisplayed ?? target, scene.map.climate));
}

export function weatherKindFromSession(session: PlaySessionLike): WeatherParams["kind"] {
  return parseWeather(session.m2Runtime?.screen.weather).kind;
}

export function deterministicStormFlashOpacity(params: WeatherParams, timeMs: number): number {
  return stormFlashOpacity(params, timeMs);
}

function advanceWeatherClock(scene: PlaySceneContext, deltaMs: number): void {
  scene.weatherFixedAccumulatorMs = (scene.weatherFixedAccumulatorMs ?? 0) + Math.max(0, deltaMs);
  while (scene.weatherFixedAccumulatorMs >= WEATHER_FIXED_STEP_MS) {
    scene.weatherFixedAccumulatorMs -= WEATHER_FIXED_STEP_MS;
    scene.weatherClockMs = (scene.weatherClockMs ?? 0) + WEATHER_FIXED_STEP_MS;
  }
}

function renderWeather(scene: PlaySceneContext, params: WeatherParams): void {
  const graphics = scene.weatherGraphics;
  const layer = scene.weatherLayer;
  if (!graphics || !layer) return;
  const plan = weatherRenderPlan(params, scene.weatherClockMs ?? 0);
  graphics.clear();
  layer.setVisible(plan.active);
  if (!plan.active) return;
  const width = scene.cameras.main.width || PLAY_RESOLUTION.width;
  const height = scene.cameras.main.height || PLAY_RESOLUTION.height;
  if (plan.kind === "fog") {
    renderFog(graphics, params, width, height, scene.weatherClockMs ?? 0);
    return;
  }
  renderPrecipitation(graphics, params, width, height, scene.weatherClockMs ?? 0);
  if (plan.stormFlashOpacity > 0) {
    graphics.fillStyle(0xffffff, plan.stormFlashOpacity);
    graphics.fillRect(0, 0, width, height);
  }
}

function renderPrecipitation(
  graphics: Phaser.GameObjects.Graphics,
  params: WeatherParams,
  width: number,
  height: number,
  timeMs: number
): void {
  const count = weatherParticleCount(params, MAX_PARTICLES);
  const rainLike = params.kind === "rain" || params.kind === "storm";
  const speed = rainLike ? 0.46 : 0.14;
  const color = rainLike ? 0xaed0ff : 0xffffff;
  const alpha = rainLike ? 0.78 : 0.86;
  graphics.lineStyle(rainLike ? 2 : 1, color, alpha);
  graphics.fillStyle(color, alpha);
  for (let index = 0; index < count; index += 1) {
    const x = positiveModulo(index * 37 + Math.floor(timeMs * 0.03), width + 32) - 16;
    const y = positiveModulo(index * 53 + Math.floor(timeMs * speed), height + 48) - 24;
    if (rainLike) {
      graphics.lineBetween(x, y, x + 4, y + 14);
    } else {
      graphics.fillCircle(x + Math.sin((timeMs + index * 91) / 500) * 6, y, 2.4);
    }
  }
}

function renderFog(
  graphics: Phaser.GameObjects.Graphics,
  params: WeatherParams,
  width: number,
  height: number,
  timeMs: number
): void {
  const opacity = fogOpacity(params);
  graphics.fillStyle(0xcfd5dd, opacity);
  graphics.fillRect(0, 0, width, height);
  const offset = positiveModulo(Math.floor(timeMs * 0.018), width);
  graphics.fillStyle(0xf0f3f7, Math.min(0.28, opacity * 0.55));
  for (let band = -1; band < 4; band += 1) {
    const x = band * 120 - offset;
    graphics.fillRoundedRect(x, height * 0.18 + band * 18, width * 0.75, 32, 16);
  }
}

function weatherSignature(params: WeatherParams): string {
  return `${params.kind}:${params.intensity}`;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
