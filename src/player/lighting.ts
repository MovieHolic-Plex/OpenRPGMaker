import type { GameMap, LightSource, LightSourceAnchor, LightingState } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

export const DEFAULT_LIGHTING_STATE: LightingState = {
  ambient: 0,
  sources: [],
};

export const LIGHTING_FIXED_STEP_MS = 16;

export type LightTilePosition = {
  readonly x: number;
  readonly y: number;
};

export type LightAnchorResolver = (anchor: LightSourceAnchor, source: LightSource) => LightTilePosition | undefined;

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

export type LightingAmbientTransition = {
  readonly fromAmbient: number;
  readonly toAmbient: number;
  readonly fromColor?: string;
  readonly toColor?: string;
  readonly durationMs: number;
  elapsedMs: number;
};

export function ensureLightingState(session: PlaySessionLike): LightingState {
  const current = session.lighting;
  if (!current) {
    session.lighting = structuredClone(DEFAULT_LIGHTING_STATE);
    return session.lighting;
  }
  session.lighting = normalizeLightingState(current);
  return session.lighting;
}

export function applyMapDefaultLighting(session: PlaySessionLike, map: GameMap): void {
  if (!map.defaultLighting) {
    ensureLightingState(session);
    return;
  }
  session.lighting = normalizeLightingState(map.defaultLighting);
}

export function setSessionLighting(
  session: PlaySessionLike,
  next: Pick<LightingState, "ambient" | "color">
): LightingState {
  const current = ensureLightingState(session);
  session.lighting = normalizeLightingState({
    ambient: next.ambient,
    color: next.color,
    sources: current.sources,
  });
  return session.lighting;
}

export function addSessionLight(session: PlaySessionLike, source: LightSource): LightingState {
  const current = ensureLightingState(session);
  const normalized = normalizeLightSource(source);
  session.lighting = normalizeLightingState({
    ...current,
    sources: [...current.sources.filter((entry) => entry.id !== normalized.id), normalized],
  });
  return session.lighting;
}

export function removeSessionLight(
  session: PlaySessionLike,
  request: { readonly id?: string; readonly all?: boolean }
): LightingState {
  const current = ensureLightingState(session);
  const sources = request.all === true
    ? []
    : current.sources.filter((entry) => entry.id !== (request.id ?? ""));
  session.lighting = normalizeLightingState({ ...current, sources });
  return session.lighting;
}

export function normalizeLightingState(value: LightingState | undefined): LightingState {
  if (!value) return structuredClone(DEFAULT_LIGHTING_STATE);
  return {
    ambient: clamp01(value.ambient),
    ...(typeof value.color === "string" && value.color.trim() ? { color: value.color.trim() } : {}),
    sources: Array.isArray(value.sources) ? value.sources.map(normalizeLightSource) : [],
  };
}

export function normalizeLightSource(value: LightSource): LightSource {
  return {
    id: value.id.trim() || "light",
    at: normalizeLightAnchor(value.at),
    radius: Math.max(0, finiteOr(value.radius, 0)),
    ...(value.intensity !== undefined ? { intensity: clamp01(value.intensity) } : {}),
    ...(typeof value.color === "string" && value.color.trim() ? { color: value.color.trim() } : {}),
    ...(value.flicker === true ? { flicker: true } : {}),
  };
}

export function interpolateLightingAmbient(from: number, to: number, elapsedMs: number, durationMs: number): number {
  const start = clamp01(from);
  const end = clamp01(to);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return end;
  const progress = clamp01(Math.max(0, elapsedMs) / durationMs);
  return start + (end - start) * progress;
}

export function advanceLightingAmbientTransition(
  transition: LightingAmbientTransition,
  deltaMs: number
): { readonly ambient: number; readonly color?: string; readonly done: boolean } {
  transition.elapsedMs = Math.min(transition.durationMs, transition.elapsedMs + Math.max(0, deltaMs));
  const done = transition.elapsedMs >= transition.durationMs;
  return {
    ambient: interpolateLightingAmbient(transition.fromAmbient, transition.toAmbient, transition.elapsedMs, transition.durationMs),
    color: done ? transition.toColor : transition.fromColor ?? transition.toColor,
    done,
  };
}

export function lightingGradientParams(
  lighting: LightingState | undefined,
  context: LightingMaskContext
): LightingMaskParams {
  const state = normalizeLightingState(lighting);
  return {
    ambient: state.ambient,
    color: state.color ?? "#000000",
    width: Math.max(1, Math.round(context.viewportWidth)),
    height: Math.max(1, Math.round(context.viewportHeight)),
    gradients: state.sources
      .map((source) => lightGradientParam(source, context))
      .filter((param): param is LightGradientParam => param !== null),
  };
}

export function lightAtTile(
  lighting: LightingState | undefined,
  x: number,
  y: number,
  resolveAnchor: LightAnchorResolver,
  timeMs = 0
): boolean {
  const state = normalizeLightingState(lighting);
  for (const source of state.sources) {
    const position = resolveAnchor(source.at, source);
    if (!position) continue;
    const intensity = lightSourceIntensity(source, timeMs);
    if (intensity <= 0) continue;
    const dx = position.x - x;
    const dy = position.y - y;
    if (Math.sqrt(dx * dx + dy * dy) <= source.radius) return true;
  }
  return false;
}

export function lightingMaskSignature(params: LightingMaskParams): string {
  return JSON.stringify({
    ambient: round(params.ambient),
    color: params.color,
    width: params.width,
    height: params.height,
    gradients: params.gradients.map((entry) => ({
      id: entry.id,
      x: round(entry.centerX),
      y: round(entry.centerY),
      r: round(entry.radiusPx),
      i: round(entry.intensity),
      color: entry.color,
      flicker: round(entry.flicker),
    })),
  });
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

export function deterministicFlickerFactor(sourceId: string, timeMs: number): number {
  const step = Math.max(0, Math.floor(timeMs / LIGHTING_FIXED_STEP_MS));
  const phase = step + (stableHash(sourceId) % 41);
  const sine = Math.sin(phase * 0.43) * 0.08;
  const stepDrop = phase % 17 === 0 || phase % 29 === 0 ? -0.18 : 0;
  return clamp(0.65, 1, 0.9 + sine + stepDrop);
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

function lightSourceIntensity(source: LightSource, timeMs: number): number {
  const base = source.intensity === undefined ? 1 : clamp01(source.intensity);
  const flicker = source.flicker ? deterministicFlickerFactor(source.id, timeMs) : 1;
  return clamp01(base * flicker);
}

function normalizeLightAnchor(value: LightSourceAnchor): LightSourceAnchor {
  if (value === "player") return "player";
  if ("eventId" in value) return { eventId: String(value.eventId) };
  return { x: Math.trunc(finiteOr(value.x, 0)), y: Math.trunc(finiteOr(value.y, 0)) };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
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
