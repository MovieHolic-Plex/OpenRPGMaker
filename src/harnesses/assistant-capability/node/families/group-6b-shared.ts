import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, fail, mapOf, pass, sameExcept, withoutEvent, type JudgeInput, type Verdict } from '../matrixNativeSpec';
import { attempt, distinct } from './group-4-shared';

export { attempt, distinct };

/** Every command of the event (all pages + top-level), descending into any nested branch list. */
export function deepCommands(event: any): any[] {
  const out: any[] = [];
  const visit = (node: any) => {
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.kind === 'string') out.push(node);
    for (const value of Object.values(node)) if (value && typeof value === 'object') visit(value);
  };
  for (const page of event?.pages ?? []) visit(page.commands);
  visit(event?.commands);
  return out;
}

export const commandsOfKind = (event: any, ...kinds: string[]): any[] => deepCommands(event).filter(command => kinds.includes(command.kind));

export const eventsOn = (project: Project, mapId = MAP): any[] => mapOf(project, mapId)?.events ?? [];
export const newEventsOn = (before: Project, after: Project, mapId = MAP): any[] => {
  const known = new Set(eventsOn(before, mapId).map(event => event.id));
  return eventsOn(after, mapId).filter(event => !known.has(event.id));
};
export const eventIn = (project: Project, id: string, mapId = MAP): any => eventsOn(project, mapId).find(event => event.id === id);

export const rows = (project: Project, key: string): any[] => ((project as any).database?.[key] ?? []) as any[];
export const newRows = (before: Project, after: Project, key: string): any[] => {
  const known = new Set(rows(before, key).map(row => row.id));
  return rows(after, key).filter(row => !known.has(row.id));
};
/** Existing rows of a database collection are byte-identical afterwards. */
export const keepsRows = (before: Project, after: Project, key: string): string | undefined => {
  for (const old of rows(before, key)) {
    const now = rows(after, key).find(row => row.id === old.id);
    if (!now || !isDeepStrictEqual(now, old)) return `기존 ${key} ${old.id} 가 바뀌었다`;
  }
  return undefined;
};
export const withoutRows = (key: string, ids: string[]) => (doc: any) => { doc.database[key] = (doc.database[key] ?? []).filter((row: any) => !ids.includes(row.id)); };

/** Switches/variables only ever grow when an authoring tool wires a flag; the old ones must survive untouched. */
export const growsOnly = (before: Project, after: Project, key: 'switches' | 'variables'): boolean => {
  const old = ((before as any)[key] ?? []) as any[];
  const now = ((after as any)[key] ?? []) as any[];
  return old.every(row => now.some(other => isDeepStrictEqual(other, row)));
};
export const withoutFlags = (doc: any) => { delete doc.switches; delete doc.variables; if (doc.session) { delete doc.session.switches; delete doc.session.variables; } };

/** Skill id → name, for judging "level N learns <name>" without pinning an id. */
export const skillNameOf = (project: Project, id: string): string => String(rows(project, 'skills').find(row => row.id === id)?.name ?? '');

export type Contract = { label: string; check: (input: JudgeInput) => Verdict };
export const fine = (note: string): Verdict => pass(note);
export { fail, pass, sameExcept, withoutEvent, clone, mapOf, MAP };
