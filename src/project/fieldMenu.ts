import type { Project } from './types';
import { usesRelationshipMenu } from './relationshipMenu';

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
/** 저작한 메뉴가 우선이다. 없을 때 관계 중심(연애) 게임이면 호감도 중심 기본 메뉴를 쓴다 — 전투 능력치 메뉴가 연애 게임에 나오지 않게(2026-10-16). */
export function fieldMenu(project: Project): AuthoredFieldMenu | undefined { return project.meta.oprnFieldMenu ?? (usesRelationshipMenu(project) ? romanceFieldMenu() : undefined); }
export function collectorFieldMenu(): AuthoredFieldMenu { return { version:1, entries: [
  {command:'monster-dex',label:'도감'}, {command:'monsters',label:'동료'}, {command:'items',label:'가방'},
  {command:'trainer-card',label:'원정 수첩'}, {command:'region-map',label:'지도'}, {command:'campaign-progress',label:'배지'},
  {command:'save',label:'저장'}, {command:'options',label:'설정'},
] }; }
/** 연애 게임의 ESC 메뉴 — 전투 능력치(상태·스킬·장비·진형) 없이 호감도·일정·소지품·저장·설정만(2026-10-16). */
export function romanceFieldMenu(): AuthoredFieldMenu { return { version:1, entries: [
  {command:'relationships',label:'호감도'}, {command:'quests',label:'일정'}, {command:'items',label:'소지품'},
  {command:'save',label:'저장'}, {command:'load',label:'불러오기'}, {command:'options',label:'설정'}, {command:'to-title',label:'타이틀로'},
] }; }
