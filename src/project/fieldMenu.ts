import type { Project } from './types';

export const FIELD_MENU_COMMANDS = ['items','skills','equipment','monsters','save','load','status','row','formation','monster-dex','region-map','campaign-progress','trainer-card','battle-reports','quests','relationships','gallery','life-ledger','options','wait','to-title'] as const;
export type FieldMenuCommand = typeof FIELD_MENU_COMMANDS[number];
/** Metadata extension survives older host normalizers. Runtime reads this authored contract directly. */
export type AuthoredFieldMenu = { version: 1; entries: { command: FieldMenuCommand; label: string }[] };
export function validateFieldMenu(value: unknown): asserts value is AuthoredFieldMenu {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('fieldMenu: object required');
  const menu = value as AuthoredFieldMenu;
  if (Object.keys(menu).some(k => !['version','entries'].includes(k)) || menu.version !== 1 || !Array.isArray(menu.entries) || menu.entries.length < 1 || menu.entries.length > 12) throw Error('fieldMenu: version1 and 1..12 entries required');
  const seen = new Set<string>();
  for (const [i,row] of menu.entries.entries()) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(k => !['command','label'].includes(k)) || !FIELD_MENU_COMMANDS.includes(row.command) || seen.has(row.command)) throw Error('fieldMenu: invalid or duplicate command');
    if (typeof row.label !== 'string' || !row.label.trim() || row.label !== row.label.trim() || [...row.label].length > 12 || /[\r\n\u0000-\u001f]/.test(row.label)) throw Error('fieldMenu: label1..12 characters required');
    if (row.command === 'to-title' && i !== menu.entries.length - 1) throw Error('fieldMenu: title return must be last');
    seen.add(row.command);
  }
}
export function fieldMenu(project: Project): AuthoredFieldMenu | undefined { return project.meta.oprnFieldMenu; }
export function collectorFieldMenu(): AuthoredFieldMenu { return { version:1, entries: [
  {command:'monster-dex',label:'도감'}, {command:'monsters',label:'동료'}, {command:'items',label:'가방'},
  {command:'trainer-card',label:'원정 수첩'}, {command:'region-map',label:'지도'}, {command:'campaign-progress',label:'배지'},
  {command:'save',label:'저장'}, {command:'options',label:'설정'},
] }; }
