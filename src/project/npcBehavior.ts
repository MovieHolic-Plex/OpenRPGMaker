import { isEmoteKind } from './emotes';
import type { DetectionEncounter, NpcSight, ChaseAcrossMaps } from './types';

export function defaultChaseSight(): NpcSight {
  return { range: 8, lineOfSight: true, facing: 'any' };
}
export function defaultChasePursuit(): ChaseAcrossMaps {
  return { scope: 'map', doorDelayMs: 1200, searchMs: 4000, onLost: 'wait' };
}
export function defaultDetectionEncounter(): DetectionEncounter {
  return { sight: { range: 6, lineOfSight: true, facing: 'forward' }, emote: 'exclamation', emoteMs: 600, approachSpeed: 4 };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export function isNpcSight(value: unknown): value is NpcSight {
  return record(value) && integer(value.range, 0, 999) && typeof value.lineOfSight === 'boolean'
    && (value.facing === 'any' || value.facing === 'forward' || value.facing === 'cone')
    && (value.coneDegrees === undefined || (typeof value.coneDegrees === 'number' && value.coneDegrees >= 30 && value.coneDegrees <= 180))
    && (value.shape === undefined || value.shape === 'diamond' || value.shape === 'circle');
}

/** 시야 거리 안인가(칸 차이 dx·dy). circle 은 시야 등불과 같은 반지름 range + 0.5 원(@/project/types NpcSight.shape). */
export function withinSightRange(dx: number, dy: number, range: number, shape: NpcSight['shape']): boolean {
  if (shape === 'circle') return dx * dx + dy * dy <= (range + 0.5) * (range + 0.5);
  return Math.abs(dx) + Math.abs(dy) <= range;
}
export function isDetectionEncounter(value: unknown): value is DetectionEncounter {
  return record(value) && isNpcSight(value.sight) && (value.emote === null || isEmoteKind(value.emote))
    && integer(value.emoteMs, 0, 60000) && integer(value.approachSpeed, 1, 8);
}
export type DetectionEncounterCompletions = Record<string, Record<string, true>>;
export function isDetectionEncounterCompletions(value: unknown): value is DetectionEncounterCompletions {
  return record(value) && Object.values(value).every(pages => record(pages) && Object.values(pages).every(done => done === true));
}

export function completeDetectionEncounter(
  session: { detectionEncounterCompletions?: DetectionEncounterCompletions },
  eventId: string,
  pageId: string
): void {
  const receipts = session.detectionEncounterCompletions ?? {};
  const pages = Object.hasOwn(receipts, eventId) ? receipts[eventId] : {};
  session.detectionEncounterCompletions = {
    ...receipts, [eventId]: { ...pages, [pageId]: true },
  };
}
