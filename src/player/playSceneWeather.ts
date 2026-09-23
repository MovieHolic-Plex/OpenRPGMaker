import { resolveMapWeather } from "@/player/weather/weatherModel";
import { syncAtmosphere } from "./playSceneAtmosphere";
import { getAudioEngine } from "@/player/audio";
import type Phaser from "phaser";
import { ensureFogTexture } from "@/player/weather/fogTexture";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import { runtimePixelDensity } from "@/player/runtimeViewScale";
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
const MAX_PARTICLES = 180;

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
  scene.weatherMistLayers = undefined;
  scene.events.once("shutdown", () => {
    getAudioEngine().weather.stop();
    scene.weatherLayer = undefined;
    scene.weatherGraphics = undefined;
    scene.weatherMistLayers = undefined;
  });
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
  const displayed = resolveMapWeather(scene.weatherDisplayed ?? target, scene.map.climate);
  const audio = getAudioEngine();
  audio.weather.update(displayed, scene.weatherClockMs ?? 0, audio.isUnlocked());
  renderWeather(scene, displayed);
  syncAtmosphere(scene);
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
  for (const mist of scene.weatherMistLayers ?? []) mist.setVisible(plan.active && plan.kind === "fog");
  if (!plan.active) return;
  const canvasWidth = scene.cameras.main.width || PLAY_RESOLUTION.width;
  const canvasHeight = scene.cameras.main.height || PLAY_RESOLUTION.height;
  // Cancel camera zoom for this screen-space effect, including zoom-out edges, and draw in
  // logical pixels so drops keep their size when the canvas runs at a higher pixel density.
  const zoom = scene.cameras.main.zoom || 1;
  const density = runtimePixelDensity(scene);
  const width = canvasWidth / density;
  const height = canvasHeight / density;
  layer.setPosition(canvasWidth / 2 * (1 - 1 / zoom), canvasHeight / 2 * (1 - 1 / zoom));
  layer.setScale(density / zoom);
  if (plan.kind === "fog") {
    renderFog(scene, params, width, height, scene.weatherClockMs ?? 0);
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
  const rain = params.kind === "rain" || params.kind === "storm";
  const storm = params.kind === "storm";
  const seconds = timeMs / 1000;
  // Index hashing breaks the diagonal grid of the old equally spaced particles.
  const sample = (index: number, salt: number) => {
    let value = Math.imul(index + salt, 1597334677);
    value = Math.imul(value ^ (value >>> 16), 2246822519);
    return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
  };
  for (let index = 0; index < count; index += 1) {
    const depth = sample(index, 11);
    const phase = sample(index, 71) * Math.PI * 2;
    const speed = rain ? 160 + depth * 230 : 10 + depth * 26;
    const wind = rain ? (storm ? 95 : 35) : 8;
    const sway = rain ? 0 : Math.sin(seconds * (0.5 + depth) + phase) * (5 + depth * 12);
    const x = positiveModulo(sample(index, 31) * (width + 48) + seconds * wind * (0.4 + depth) + sway, width + 48) - 24;
    const y = positiveModulo(sample(index, 53) * (height + 48) + seconds * speed, height + 48) - 24;
    const alpha = (0.15 + depth * 0.48) * Math.min(1, params.intensity * 4);
    if (rain) {
      const length = 4 + depth * (storm ? 17 : 11);
      const slant = length * wind / speed;
      // Soft trailing streak with a brighter, short leading edge.
      graphics.lineStyle(0.45 + depth * 0.7, 0xbad0de, alpha * 0.45);
      graphics.lineBetween(x, y, x + slant, y + length);
      graphics.lineStyle(0.4 + depth * 0.65, 0xddeaf1, alpha);
      graphics.lineBetween(x + slant * 0.65, y + length * 0.65, x + slant, y + length);
    } else {
      const radius = 0.45 + depth * 1.3;
      if (depth > 0.65) {
        graphics.fillStyle(0xe1edf6, alpha * 0.12);
        graphics.fillCircle(x, y, radius * 1.9);
      }
      graphics.fillStyle(0xf1f7fc, alpha);
      graphics.fillCircle(x, y, radius);
    }
  }
}

function renderFog(
  scene: PlaySceneContext,
  params: WeatherParams,
  width: number,
  height: number,
  timeMs: number
): void {
  if (!scene.weatherMistLayers) {
    const key = ensureFogTexture(scene.textures);
    scene.weatherMistLayers = [0, 1, 2].map(() => {
      const mist = scene.add.tileSprite(0, 0, width, height, key).setOrigin(0).setScrollFactor(0);
      scene.weatherLayer!.add(mist);
      return mist;
    });
  }
  scene.weatherMistLayers.forEach((mist, index) => {
    mist.setVisible(true);
    if (mist.width !== width || mist.height !== height) mist.setSize(width, height);
    // Broad distant haze + cross-drifting finer wisps. All layers are seamless and independently phased.
    mist.setTileScale([2.8, 1.65, 0.95][index]!, [1.9, 1.05, 0.7][index]!);
    mist.tilePositionX = timeMs * [0.003, -0.006, 0.01][index]! + index * 83;
    mist.tilePositionY = timeMs * [0.001, 0.002, -0.0015][index]! + index * 57;
    mist.setAlpha(params.intensity * [0.95, 0.8, 0.5][index]!);
  });
}

function weatherSignature(params: WeatherParams): string {
  return `${params.kind}:${params.intensity}`;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
