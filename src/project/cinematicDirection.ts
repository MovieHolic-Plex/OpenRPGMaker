import type { TitleEffect } from './types/database';
import { parseCinematicLayers, type CinematicLayer } from './cinematicLayers';

export type CinematicCameraFrame = [number, number, number]; // focus x/y 0..1, zoom 1..1.6
export type CinematicDirection = {
  layers?: CinematicLayer[];
  camera?: { from: CinematicCameraFrame; to: CinematicCameraFrame };
  transition?: { kind: 'cut' | 'dissolve' | 'fade' | 'flash'; durationMs: number };
  effects?: TitleEffect[];
  soundResourceId?: string;
  narrationDelayMs?: number;
};

/** Shared strict boundary for SQLite load, editor tools and forms. Never drops bad authored fields. */
export function parseCinematicDirection(value: unknown): CinematicDirection {
  const record = (raw: unknown, fields: readonly string[], label: string): Record<string, unknown> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`${label}: 객체가 필요합니다.`);
    for (const key of Object.keys(raw)) if (!fields.includes(key)) throw new TypeError(`${label}.${key}: 지원하지 않는 필드입니다.`);
    return raw as Record<string, unknown>;
  };
  const number = (raw: unknown, min: number, max: number, label: string): number => {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) throw new TypeError(`${label}: ${min}~${max} 숫자가 필요합니다.`);
    return raw;
  };
  const frame = (raw: unknown): CinematicCameraFrame => {
    if (!Array.isArray(raw) || raw.length !== 3) throw new TypeError('camera: [초점 x, 초점 y, 배율]이 필요합니다.');
    return [number(raw[0], 0, 1, 'camera.x'), number(raw[1], 0, 1, 'camera.y'), number(raw[2], 1, 1.6, 'camera.zoom')];
  };
  const point = (raw: unknown): [number, number] => {
    if (!Array.isArray(raw) || raw.length !== 2) throw new TypeError('effect: [x,y] 좌표가 필요합니다.');
    return [number(raw[0], 0, 1, 'effect.x'), number(raw[1], 0, 1, 'effect.y')];
  };
  const input = record(value, ['camera', 'transition', 'effects', 'soundResourceId', 'narrationDelayMs', 'layers'], 'direction');
  const out: CinematicDirection = {};
  if (input.layers !== undefined) out.layers = parseCinematicLayers(input.layers);
  if (input.camera !== undefined) {
    const camera = record(input.camera, ['from', 'to'], 'camera');
    out.camera = { from: frame(camera.from), to: frame(camera.to) };
  }
  if (input.transition !== undefined) {
    const transition = record(input.transition, ['kind', 'durationMs'], 'transition');
    if (!['cut', 'dissolve', 'fade', 'flash'].includes(String(transition.kind))) throw new TypeError('transition.kind: cut/dissolve/fade/flash가 필요합니다.');
    out.transition = { kind: transition.kind as NonNullable<CinematicDirection['transition']>['kind'], durationMs: number(transition.durationMs, 0, 1000, 'transition.durationMs') };
  }
  if (input.effects !== undefined) {
    if (!Array.isArray(input.effects) || input.effects.length > 4) throw new TypeError('effects: 효과는 최대 4개입니다.');
    out.effects = input.effects.map(raw => {
      const effect = record(raw, ['kind', 'intensity', 'color', 'source', 'toward', 'spread', 'speed', 'region'], 'effect');
      if (!['godRays', 'motes', 'mist', 'glow'].includes(String(effect.kind))) throw new TypeError('effect.kind: godRays/motes/mist/glow가 필요합니다.');
      const result: TitleEffect = { kind: effect.kind as TitleEffect['kind'] };
      if (effect.intensity !== undefined) result.intensity = number(effect.intensity, 0, 1.5, 'effect.intensity');
      if (effect.color !== undefined) {
        if (typeof effect.color !== 'string' || !/^#[0-9a-f]{6}$/iu.test(effect.color)) throw new TypeError('effect.color: #RRGGBB가 필요합니다.');
        result.color = effect.color;
      }
      if (effect.source !== undefined) result.source = point(effect.source);
      if (effect.toward !== undefined) result.toward = point(effect.toward);
      if (effect.spread !== undefined) result.spread = number(effect.spread, 0.01, 0.5, 'effect.spread');
      if (effect.speed !== undefined) result.speed = number(effect.speed, 0, 2, 'effect.speed');
      if (effect.region !== undefined) {
        if (!Array.isArray(effect.region) || effect.region.length < 3 || effect.region.length > 8) throw new TypeError('effect.region: 3~8개의 좌표가 필요합니다.');
        result.region = effect.region.map(point);
      }
      if (result.kind === 'glow' && !result.source) throw new TypeError('glow.source가 필요합니다.');
      if (result.kind === 'godRays' && (!result.source || !result.toward)) throw new TypeError('godRays.source/toward가 필요합니다.');
      if (result.kind === 'mist' && !result.region) throw new TypeError('mist.region이 필요합니다.');
      if (result.kind === 'motes' && !result.region && (!result.source || !result.toward)) throw new TypeError('motes.region 또는 source/toward가 필요합니다.');
      return result;
    });
  }
  if (input.soundResourceId !== undefined) {
    if (typeof input.soundResourceId !== 'string' || !input.soundResourceId.trim()) throw new TypeError('soundResourceId: 효과음 id가 필요합니다.');
    out.soundResourceId = input.soundResourceId.trim();
  }
  if (input.narrationDelayMs !== undefined) out.narrationDelayMs = number(input.narrationDelayMs, 0, 2000, 'narrationDelayMs');
  return out;
}
