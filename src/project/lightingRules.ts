import type { GameMap, LightSource, LightSourceAnchor, LightingState } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

export const DEFAULT_LIGHTING_STATE: LightingState = {
  ambient: 0,
  sources: [],
};

export const LIGHTING_FIXED_STEP_MS = 16;

export type LightTilePosition = {
  readonly x: number;
  readonly y: number;
};

export type LightAnchorResolver = (
  anchor: LightSourceAnchor,
  source: LightSource
) => LightTilePosition | undefined;

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
  const sources =
    request.all === true
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

export function interpolateLightingAmbient(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number
): number {
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
    ambient: interpolateLightingAmbient(
      transition.fromAmbient,
      transition.toAmbient,
      transition.elapsedMs,
      transition.durationMs
    ),
    color: done ? transition.toColor : transition.fromColor ?? transition.toColor,
    done,
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

export function deterministicFlickerFactor(sourceId: string, timeMs: number): number {
  const step = Math.max(0, Math.floor(timeMs / LIGHTING_FIXED_STEP_MS));
  const phase = step + (stableHash(sourceId) % 41);
  const sine = Math.sin(phase * 0.43) * 0.08;
  const stepDrop = phase % 17 === 0 || phase % 29 === 0 ? -0.18 : 0;
  return clamp(0.65, 1, 0.9 + sine + stepDrop);
}

export function lightSourceIntensity(source: LightSource, timeMs: number): number {
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
