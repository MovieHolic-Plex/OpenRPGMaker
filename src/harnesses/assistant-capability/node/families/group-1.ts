import { isDeepStrictEqual } from 'node:util';
import { autotileGroupsForTileset } from '../../../../project/defaults/autotileGroups';
import type { Project } from '../../../../project/types';
import {
  MAP, changedCells, eventEdit, eventOf, fail, inside, mapOf, pass, runOn,
  sameExcept, speakerless, tileAt, withoutTiles,
} from '../matrixNativeSpec';
import { rectArg, strArg, type Family, type FamilyOutcome } from './types';

const DIRT_MATERIAL = '버들항 모랫길';

const cellsIn = (rect: { x: number; y: number; w: number; h: number }) =>
  Array.from({ length: rect.w * rect.h }, (_, index) => ({ x: rect.x + (index % rect.w), y: rect.y + Math.floor(index / rect.w) }));

/**
 * "흙" is a family of walkable dirt grounds, not one material: the fixture's 모랫길(sand) and 농장 흙길(farm_lane)
 * both answer it, while 길 포석(paving), 물 and 경작지(tilled field) do not. A live run painted 농장 흙길 and was
 * rejected by a check that only knew 모랫길 — the prompt names the ground, not the material.
 */
const DIRT_TAGS = new Set(['sand', 'farm_lane']);
const DIRT_LABEL = /흙길|모랫길/iu;
const tileTags = (project: Project, tile: number): string[] => {
  const meta = (project as any).tilesets[(project as any).maps[MAP].tilesetId]?.tileMeta?.[tile];
  return Array.isArray(meta?.tags) ? meta.tags.map(String) : [];
};
const isDirtTile = (project: Project, tile: number): boolean => {
  if (tile < 0) return false;
  const tags = tileTags(project, tile);
  if (tags.some(tag => DIRT_TAGS.has(tag))) return true;
  const meta = (project as any).tilesets[(project as any).maps[MAP].tilesetId]?.tileMeta?.[tile];
  return DIRT_LABEL.test(String(meta?.label ?? ''));
};
const isSandTile = (project: Project, tile: number): boolean => tile >= 0 && tileTags(project, tile).includes('sand');

const groupTile = (project: Project, groupId: string): number => {
  const tileset = (project as any).tilesets[(project as any).maps[MAP].tilesetId];
  const group = autotileGroupsForTileset(tileset).find(entry => entry.id === groupId);
  if (!group) throw new Error(`fixture 에 ${groupId} 오토타일 그룹이 없다`);
  return group.memberTileIds[0]!;
};
const stonePaving = (project: Project) => groupTile(project, 'beodeul_road_autotile');
const farmland = (project: Project) => groupTile(project, 'farmland');

const fill = (project: Project, rect: { x: number; y: number; w: number; h: number }) =>
  runOn(project, 'fill_region', { mapId: MAP, x: rect.x, y: rect.y, w: rect.w, h: rect.h, layer: 'lower', material: DIRT_MATERIAL });

const paintDirt: Family = {
  id: 'paint-dirt',
  area: 'tiles',
  mode: 'write',
  title: '선택 영역의 바닥을 흙으로',
  variants: [
    { key: 'selection-plain', prompt: '선택 영역의 바닥을 흙으로 바꿔줘.', args: { rect: { x: 12, y: 13, w: 4, h: 2 } }, setup: { select: { x: 12, y: 13, w: 4, h: 2 } } },
    { key: 'rect-polite', prompt: '선택한 4×2 영역의 바닥을 흙길로 바꿔 주세요.', args: { rect: { x: 8, y: 12, w: 4, h: 2 } }, setup: { select: { x: 8, y: 12, w: 4, h: 2 } } },
    { key: 'terse-3x2', prompt: '여기 3×2, 흙으로.', args: { rect: { x: 16, y: 12, w: 3, h: 2 } }, setup: { select: { x: 16, y: 12, w: 3, h: 2 } } },
    { key: 'scope-explained', prompt: '선택한 3×3 영역의 지면을 전부 흙으로 만들어 주세요. 영역 밖 칸은 그대로 두세요.', args: { rect: { x: 18, y: 12, w: 3, h: 3 } }, setup: { select: { x: 18, y: 12, w: 3, h: 3 } } },
    { key: 'other-area', prompt: '선택 영역 바닥을 모랫길로 깔아줘. 다른 칸은 건드리지 마.', args: { rect: { x: 12, y: 5, w: 4, h: 2 }, accept: 'sand' }, setup: { select: { x: 12, y: 5, w: 4, h: 2 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `선택 영역 ${rect.w}×${rect.h}`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    if (!cells.every(cell => inside(rect, cell.x, cell.y))) return fail(`${label}: 영역 밖 칸이 바뀌었다`);
    const repainted = cellsIn(rect).filter(cell => tileAt(input.before, 'lowerTiles', cell.x, cell.y) !== tileAt(input.after, 'lowerTiles', cell.x, cell.y));
    if (repainted.length !== rect.w * rect.h) return fail(`${label}: ${rect.w * rect.h - repainted.length}칸이 바닥으로 바뀌지 않았다`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    const accept = args.accept === 'sand' ? isSandTile : isDirtTile;
    const foreign = repainted.filter(cell => !accept(input.before, tileAt(input.after, 'lowerTiles', cell.x, cell.y)));
    if (foreign.length) return fail(`${label}: ${args.accept === 'sand' ? '모랫길' : '흙'}이 아닌 타일 ${foreign.length}칸 (예: ${foreign[0]!.x},${foreign[0]!.y})`);
    return pass(`${label} ${repainted.length}칸만 흙으로`);
  },
  reference(project, args) {
    return fill(project, rectArg(args));
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const shifted = fill(project, { ...rect, x: rect.x - 2 });
    const partial = fill(project, { ...rect, h: 1 });
    const sideEffect = runOn(fill(project, rect), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: stonePaving(project), cells: [{ x: 1, y: 17 }],
    });
    const cleared = runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: -1, cells: cellsIn(rect) });
    const paved = runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: stonePaving(project), cells: cellsIn(rect) });
    const tilled = runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: farmland(project), cells: cellsIn(rect) });
    return [shifted, partial, sideEffect, cleared, paved, tilled];
  },
};

const renamed = (project: Project, eventId: string, name: string): Project => {
  const before = eventOf(project, eventId);
  if (!before) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
  const oldName = before.name ?? before.pages?.[0]?.name;
  let next = runOn(project, 'upsert_event', { mapId: MAP, event: { id: eventId, name } });
  (before.pages ?? []).forEach((page: any, pageIndex: number) => {
    if (!(page.commands ?? []).some((command: any) => command.kind === 'text' && command.speaker === oldName)) return;
    const commands = page.commands.map((command: any) => (command.kind === 'text' && command.speaker === oldName ? { ...command, speaker: name } : command));
    next = runOn(next, 'patch_event_page', { mapId: MAP, eventId, pageIndex, set: { commands } });
  });
  return next;
};

const renameNpc: Family = {
  id: 'rename-npc',
  area: 'npc',
  mode: 'write',
  title: 'NPC 이름 변경(대사 화자 포함)',
  variants: [
    { key: 'villager-polite', prompt: '이 NPC 이름을 하린으로 바꿔 주세요.', args: { eventId: 'ev_utility_npc', name: '하린' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-short', prompt: '여관 주인 이름을 마사로.', args: { eventId: 'ev_ember_inn', name: '마사' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-casual', prompt: '얘 이름 미루로 바꿔줘.', args: { eventId: 'ev_ember_child', name: '미루' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트의 표시 이름을 데릭으로 바꾸고, 대사창에 뜨는 화자 이름도 전부 데릭으로 맞춰 주세요.', args: { eventId: 'ev_ember_guard', name: '데릭' }, setup: { event: 'ev_ember_guard' } },
    { key: 'cutscene-rename', prompt: '장면 연출 이벤트 이름을 「오프닝 연출」로 바꿔 주세요.', args: { eventId: 'ev_test_cutscene', name: '오프닝 연출' }, setup: { event: 'ev_test_cutscene' } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const want = strArg(args, 'name');
    const label = `${eventId} → ${want}`;
    return eventEdit(input, eventId, (before, after) => {
      const shown = after.name ?? after.pages?.[0]?.name;
      if (after.name !== want && after.pages?.[0]?.name !== want) return fail(`${label}: 이름이 「${shown}」 그대로다`);
      const oldName = before.name ?? before.pages?.[0]?.name;
      const texts = (after.pages ?? []).flatMap((page: any) => page.commands ?? []).filter((command: any) => command.kind === 'text');
      const stale = texts.filter((command: any) => command.speaker && command.speaker === oldName);
      if (stale.length) return fail(`${label}: 대사 ${stale.length}개의 화자가 옛 이름(「${oldName}」) 그대로다`);
      // Renaming may also relabel pages: a page name that became the new name is part of the rename (measured: DeepSeek renames every page label).
      const strip = (event: any, reference: any) => (event.pages ?? []).map((page: any, index: number) => ({
        ...page,
        name: page.name === want ? reference.pages?.[index]?.name : page.name,
        commands: (page.commands ?? []).map(speakerless),
      }));
      if (!isDeepStrictEqual(strip(after, before), strip(before, before))) return fail(`${label}: 화자 표시 밖의 명령·페이지가 바뀌었다`);
      return pass(`${label}: 이름 변경, 대사 화자 갱신`);
    });
  },
  reference(project, args) {
    return renamed(project, strArg(args, 'eventId'), strArg(args, 'name'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const want = strArg(args, 'name');
    const target = eventOf(project, eventId);
    const oldName = target.name ?? target.pages?.[0]?.name;
    const speaksUnderOldName = (target.pages ?? []).some((page: any) => (page.commands ?? []).some((command: any) => command.kind === 'text' && command.speaker === oldName));
    const other = (mapOf(project).events as any[]).find(event => event.id !== eventId);
    const otherTarget = runOn(project, 'upsert_event', { mapId: MAP, event: { id: other.id, name: want } });
    const full = renamed(project, eventId, want);
    const pageIndex = Math.max(0, (eventOf(full, eventId).pages ?? []).length - 1);
    const commands = eventOf(full, eventId).pages[pageIndex].commands as any[];
    const damaged = runOn(full, 'patch_event_page', { mapId: MAP, eventId, pageIndex, set: { commands: [{ ...commands[0], ...(commands[0].kind === 'text' ? { body: `${commands[0].body ?? ''} (수정)` } : {}) }, ...commands.slice(1)] } });
    const firstPage = eventOf(full, eventId).pages[0];
    const relabelledWrong = runOn(full, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { name: `${want} (임시)`, commands: firstPage.commands } });
    const wrongs: FamilyOutcome[] = [otherTarget, renamed(project, eventId, `${want}님`), damaged, relabelledWrong];
    // The name players see is the speaker; a rename that skips it is the failure visual review caught, but only when a line speaks under the old name.
    if (speaksUnderOldName) wrongs.push(runOn(project, 'upsert_event', { mapId: MAP, event: { id: eventId, name: want } }));
    else wrongs.push(runOn(otherTarget, 'upsert_event', { mapId: MAP, event: { id: eventId, name: want } }));
    return wrongs;
  },
};

export const GROUP_1: readonly Family[] = [paintDirt, renameNpc];
