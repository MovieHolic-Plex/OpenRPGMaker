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
    && (value.facing === 'any' || value.facing === 'forward');
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
