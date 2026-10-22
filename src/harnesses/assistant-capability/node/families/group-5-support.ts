import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { clone, fail, mapOf, pass, type Verdict } from '../matrixNativeSpec';

const MOOD_KINDS = new Set(['setLighting', 'addLight', 'removeLight', 'setWeather']);

const moodOnly = (event: any): boolean => {
  const commands = (event.pages ?? []).flatMap((page: any) => page.commands ?? []);
  return commands.length > 0 && commands.every((command: any) => MOOD_KINDS.has(command.kind));
};

/**
 * The editor's own mood scaffolding (`set_scene_mood` adds a mood trigger event) is part of a valid
 * answer, not a side effect, so blankers drop mood-only events on both sides; every other event must
 * survive untouched, which is what makes deleting an NPC fail.
 */
export function dropMoodEvents(doc: any, mapId: string): void {
  const map = doc.maps[mapId];
  if (!map) return;
  map.events = (map.events ?? []).filter((event: any) => !moodOnly(event));
}

export const mapField = (mapId: string, ...fields: string[]) => (doc: any) => {
  const map = doc.maps[mapId];
  if (!map) return;
  for (const field of fields) delete map[field];
};

export const systemField = (...fields: string[]) => (doc: any) => {
  if (!doc.system) return;
  for (const field of fields) delete doc.system[field];
};

export const hexLuminance = (color: unknown): number => {
  const hex = String(color ?? '#ffffff').replace('#', '');
  const full = hex.length === 3 ? [...hex].map(char => char + char).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return 1;
  return (0.299 * parseInt(full.slice(0, 2), 16) + 0.587 * parseInt(full.slice(2, 4), 16) + 0.114 * parseInt(full.slice(4, 6), 16)) / 255;
};

export const sameColor = (actual: unknown, want: string): boolean => {
  const normalize = (value: unknown) => {
    const hex = String(value ?? '').trim().replace('#', '').toLowerCase();
    return hex.length === 3 ? [...hex].map(char => char + char).join('') : hex;
  };
  return normalize(actual) === normalize(want);
};

export const ambientOf = (project: Project, mapId: string): number => {
  const value = mapOf(project, mapId)?.defaultLighting?.ambient;
  return typeof value === 'number' ? value : 1;
};

/**
 * Night means darker than it was and dark enough to read as night. When the prompt names a number that
 * number wins (a near miss fails); a vague "밤" accepts any clearly darker value, because no single
 * ambient is the right one and rejecting 0.35 for not being 0.3 would fail a correct answer.
 */
export function judgeDarkness(before: Project, after: Project, mapId: string, want: number | undefined, color: string | undefined): Verdict {
  const map = mapOf(after, mapId);
  if (!map) return fail(`${mapId} 맵이 사라졌다`);
  const light = map.defaultLighting;
  const ambient = light?.ambient;
  if (typeof ambient !== 'number') return fail(`${mapId} 에 맵 조명(defaultLighting)이 없다`);
  const was = ambientOf(before, mapId);
  if (!(ambient < was)) return fail(`${mapId} 밝기가 ${was} → ${ambient} 로 어두워지지 않았다`);
  if (want !== undefined) {
    if (Math.abs(ambient - want) > 0.02) return fail(`${mapId} ambient ${ambient} (요청 ${want})`);
  } else if (ambient > 0.5) return fail(`${mapId} ambient ${ambient} 는 밤이라 하기엔 밝다`);
  if (color !== undefined) {
    if (!sameColor(light?.color, color)) return fail(`${mapId} 색 ${light?.color} (요청 ${color})`);
  } else if (hexLuminance(light?.color) > 0.35) return fail(`${mapId} 색 ${light?.color} 가 밤색이 아니다`);
  return pass(`${mapId} ambient ${was} → ${ambient}, 색 ${light?.color ?? '(기본)'}`);
}

export function weatherOf(project: Project, mapId: string): string | undefined {
  const map = mapOf(project, mapId);
  const direct = (map as any).weather?.kind;
  if (typeof direct === 'string') return direct;
  for (const event of map.events ?? []) {
    for (const page of event.pages ?? []) for (const command of page.commands ?? []) {
      if (command.kind === 'setWeather') return String(command.weather);
    }
  }
  return undefined;
}

export const eventIds = (project: Project, mapId: string): string[] => (mapOf(project, mapId).events ?? []).map((event: any) => event.id);

export function eventsPreserved(before: Project, after: Project, mapId: string): boolean {
  const afterEvents = mapOf(after, mapId)?.events ?? [];
  return (mapOf(before, mapId)?.events ?? []).every((event: any) => afterEvents.some((next: any) => isDeepStrictEqual(next, event)));
}

export function tintColor(fields: Record<string, unknown> | undefined): { rgb: [number, number, number]; alpha?: number } | undefined {
  if (!fields) return undefined;
  const raw = [fields.value, fields.tintHex, fields.tint, fields.color]
    .filter(value => typeof value === 'string' && value.trim() !== '')
    .map(value => String(value).trim());
  for (const value of raw) {
    const hex = /^#?([0-9a-f]{6})$/i.exec(value);
    if (hex) {
      const full = hex[1]!;
      return { rgb: [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)] };
    }
    const numbers = (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (numbers.length >= 3) {
      const alpha = numbers.length >= 4 ? numbers[3]! : undefined;
      return { rgb: [numbers[0]!, numbers[1]!, numbers[2]!], ...(alpha !== undefined && alpha <= 1 ? { alpha } : {}) };
    }
  }
  return undefined;
}

export const closeColor = (actual: { rgb: [number, number, number]; alpha?: number }, want: { r: number; g: number; b: number; a?: number }): boolean => {
  const near = (left: number, right: number) => Math.abs(left - right) <= 12;
  const alphaOk = want.a === undefined || actual.alpha === undefined || Math.abs(actual.alpha - want.a) <= 0.1;
  return near(actual.rgb[0], want.r) && near(actual.rgb[1], want.g) && near(actual.rgb[2], want.b) && alphaOk;
};

export function addedCommands(before: any[], after: any[]): any[] {
  const remaining = [...before];
  const added: any[] = [];
  for (const command of after) {
    const at = remaining.findIndex(old => isDeepStrictEqual(old, command));
    if (at >= 0) remaining.splice(at, 1);
    else added.push(command);
  }
  return added;
}

export const cloneProject = clone;
