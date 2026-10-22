import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { runTool } from '../../../../editor/tools/toolRunner';
import { MAP, clone, fail, mapOf, runOn, sameExcept, type Verdict } from '../matrixNativeSpec';
import type { FamilyOutcome } from './types';

export const DOOR = 'ev_test_door';
export const HOUSE = 'ev_house_door';
export const SOUTH = 'ev_south_gate';
export const HAMLET = 'map_hamlet';
export const PLAZA = 'map_plaza';
export const FIELD = 'map_field';
export const WORLD = 'map_world';

export const commandsOfEvent = (event: any): any[] =>
  (event?.pages ?? []).flatMap((page: any) => page.commands ?? []).concat(event?.commands ?? []);

export const transfersOfEvent = (event: any): any[] =>
  commandsOfEvent(event).filter((command: any) => command.kind === 'transfer');

export const eventOn = (project: Project, mapId: string, eventId: string): any =>
  (mapOf(project, mapId)?.events ?? []).find((event: any) => event.id === eventId);

export const gatesTo = (project: Project, mapId: string, target: string): Array<{ event: any; command: any }> =>
  (mapOf(project, mapId)?.events ?? []).flatMap((event: any) =>
    transfersOfEvent(event).filter((command: any) => command.mapId === target).map((command: any) => ({ event, command })));

export const pageWithTransfer = (event: any): number =>
  (event?.pages ?? []).findIndex((page: any) => (page.commands ?? []).some((command: any) => command.kind === 'transfer'));

export function walkableIn(project: Project, mapId: string, x: number, y: number): boolean {
  const map = mapOf(project, mapId);
  if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const context: any = { project: clone(project), currentMapId: mapId, assistantRun: false };
  const result: any = runTool(context, 'get_map_region', { mapId, x, y, w: 1, h: 1 });
  const grid: string[] = result.data?.grid ?? [];
  return (grid[0] ?? '')[0] !== '#';
}

export const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** create_transfer_pair 의 awayFrom 과 같은 규칙: 착지에서 문을 등진 방향. 방향이 없으면 런타임은 retain 이다. */
export function facingAway(gate: { x: number; y: number }, landing: { x: number; y: number }): string {
  const dx = landing.x - gate.x, dy = landing.y - gate.y;
  if (Math.abs(dy) >= Math.abs(dx) && dy !== 0) return dy > 0 ? 'down' : 'up';
  if (dx !== 0) return dx > 0 ? 'right' : 'left';
  return 'down';
}

export const facesGate = (command: any, gate: { x: number; y: number }): boolean => {
  if (!command.direction || command.direction === 'retain') return false;
  return command.direction !== facingAway(gate, { x: command.x, y: command.y });
};

export function eventEditOn(input: { before: Project; after: Project }, mapId: string, eventId: string, check: (before: any, after: any) => Verdict): Verdict {
  const blank = (doc: any) => {
    const map = doc.maps[mapId];
    if (map) map.events = (map.events ?? []).filter((event: any) => event.id !== eventId);
  };
  if (!sameExcept(input.before, input.after, blank)) return fail(`${eventId} 밖의 내용이 바뀌었다`);
  const before = eventOn(input.before, mapId, eventId), after = eventOn(input.after, mapId, eventId);
  if (!before || !after) return fail(`${eventId} 이벤트가 사라졌다`);
  return check(before, after);
}

export function hamletGate(): any {
  return {
    id: 'ev_hamlet_gate', name: '안동 어귀', x: 10, y: 12, trigger: { kind: 'action' },
    pages: [{
      id: 'ev_hamlet_gate_page', name: '안동 어귀', conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' },
      priority: 'below', overlapForbidden: false, movement: { type: 'fixed', speed: 3, frequency: 3 },
      commands: [{ kind: 'text', body: '낡은 나무문이 굳게 닫혀 있다.' }],
    }],
  };
}

export function withHamlet(project: Project): Project {
  const created = runOn(project, 'create_map', { name: '조용한 안동', width: 20, height: 14, id: HAMLET });
  return runOn(created, 'upsert_event', { mapId: HAMLET, event: hamletGate() });
}

export function attempt(build: () => Project): Project | undefined {  try {
    return build();
  } catch {
    return undefined;
  }
}

/** 오답은 정답과 같은 문서면 오답이 아니다 — 도구가 요청을 무시한 경우(예: create_transfer_pair 의 bidirectional:false)를 걸러 낸다. */
export function distinct(reference: Project, outcomes: Array<Project | undefined>): FamilyOutcome[] {
  const seen: Project[] = [reference];
  const kept: FamilyOutcome[] = [];
  for (const outcome of outcomes) {
    if (!outcome) continue;
    if (seen.some(entry => isDeepStrictEqual(entry, outcome))) continue;
    seen.push(outcome);
    kept.push(outcome);
  }
  return kept;
}
