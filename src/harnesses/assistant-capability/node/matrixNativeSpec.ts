import { isDeepStrictEqual } from 'node:util';
import { richProject } from './matrixTools';
import { CAPABILITY_MAP_ID, fixtureEvent } from './capabilityFixture';
import { runTool } from '../../../editor/tools/toolRunner';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { DEFAULT_TILESET_ID } from '../../../project/defaults/constants';
import type { Project } from '../../../project/types';

/**
 * Real-model verification of the 50 small commands.
 *
 * A scripted oracle (one canonical tool call, exact document equality) cannot
 * judge a live model: "여기에 나무 세 그루" has many valid placements, "이 NPC"
 * needs a referent, and a prompt about barrels needs barrels in the project.
 * This module therefore supplies, per command,
 *   - a project in which the prompt is satisfiable and unambiguous,
 *   - the editor state a person would have set before typing it (the selected
 *     region or event), and
 *   - a judge that checks the contract the prompt states and that everything
 *     else in the document is preserved.
 * Tool names are not part of the verdict: a different valid tool is not a failure.
 */

export const MAP = CAPABILITY_MAP_ID;
export type Rect = { x: number; y: number; w: number; h: number };
export type ToolRecord = { name?: string; ok?: boolean; args?: unknown; summary?: string };
/** `original` is the document before any prior turn of this command; `before` is the one the command itself started from. */
export type JudgeInput = { original: Project; before: Project; after: Project; tools: ToolRecord[]; answer: string };
export type Verdict = { ok: boolean; note: string };
export type Setup = { select?: Rect; event?: string; prior?: { prompt: string; select?: Rect } };

export const clone = <T>(value: T): T => structuredClone(value);
export const pass = (note: string): Verdict => ({ ok: true, note });
export const fail = (note: string): Verdict => ({ ok: false, note });

// ── fixture ────────────────────────────────────────────────────────────────

/** Regions the setups below refer to. Kept in one place so the fixture and the selections cannot drift apart. */
export const AREA = {
  trees: { x: 1, y: 1, w: 8, h: 4 } as Rect,      // seeded grove: clear / copy / mirror / blocked cells
  meadow: { x: 14, y: 2, w: 6, h: 5 } as Rect,    // empty grass: place trees / place well
  dirt: { x: 12, y: 13, w: 4, h: 2 } as Rect,     // plain grass the user wants turned to dirt
  barrels: { x: 2, y: 11, w: 5, h: 4 } as Rect,   // barrels + one crate that must survive
  trail: { x: 2, y: 15, w: 10, h: 2 } as Rect,    // room for a small forest path
};
export const inside = (rect: Rect, x: number, y: number) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

/** Fixture content built through the same tool path the assistant uses, so a family's reference is what the editor would hold. */
export function runOn(project: Project, tool: string, args: Record<string, unknown>): any {
  const context: any = { project, currentMapId: MAP, assistantRun: false };
  const result: any = runTool(context, tool, args);
  if (!result.ok) throw new Error(`native fixture: ${tool} failed: ${result.summary}`);
  return context.project;
}

function barrel(id: string, name: string, x: number, y: number): any {
  const base: any = clone(fixtureEvent('ev_ember_child'));
  base.id = id; base.name = name; base.x = x; base.y = y;
  base.pages = [clone(base.pages[0])];
  base.pages[0].id = `${id}_page`; base.pages[0].name = name;
  base.pages[0].commands = [{ kind: 'text', body: `${name}이다.` }];
  return base;
}

function plainDoor(id: string, name: string, x: number, y: number): any {
  const base = transferDoor(id, name, x, y, MAP, x, y);
  base.pages[0].commands = [{ kind: 'text', body: '문이 굳게 닫혀 있다.' }];
  base.trigger = { kind: 'action' }; base.pages[0].trigger = { kind: 'action' };
  return base;
}

function transferDoor(id: string, name: string, x: number, y: number, mapId: string, tx: number, ty: number): any {
  const base: any = clone(fixtureEvent('ev_ember_child'));
  base.id = id; base.name = name; base.x = x; base.y = y; base.trigger = { kind: 'playerTouch' };
  base.pages = [{ id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: 'playerTouch' }, priority: 'below', overlapForbidden: false, movement: { type: 'fixed', speed: 3, frequency: 3 },
    commands: [{ kind: 'transfer', mapId, x: tx, y: ty, fade: 'black' }] }];
  return base;
}

/** A small village in which every one of the 50 prompts has a single sensible reading. */
export function nativeProject(): Project {
  let project: any = richProject();
  project.meta.title = '작은 명령 50개 자연어 검증';
  if (project.system.opening) project.system.opening.enabled = false;
  const map = project.maps[MAP];
  // richProject scatters empty/odd cells to exercise tools; here the ground is plain grass.
  const ground = map.lowerTiles.find((tile: number) => tile >= 0 && tile === map.lowerTiles[map.lowerTiles.length - 1]) ?? map.lowerTiles[map.lowerTiles.length - 1];
  map.lowerTiles = map.lowerTiles.map((tile: number) => (tile === -1 || tile === 240 ? ground : tile));
  const byId = (id: string) => map.events.find((event: any) => event.id === id);
  // Keep every authored NPC on the map and give the ones the prompts refer to a name a person would see.
  byId('ev_ember_guard').x = 22; byId('ev_ember_guard').y = 12;
  byId('ev_utility_npc').name = '마을 주민';
  // A real NPC's lines are spoken under its own name; a mismatched placeholder speaker invites the assistant to "fix" it unasked.
  for (const page of byId('ev_utility_npc').pages ?? []) for (const command of page.commands) if (command.kind === 'text') command.speaker = '마을 주민';
  byId('ev_test_shop').name = '잡화점 주인';
  byId('ev_test_cutscene').name = '장면 연출';
  const shopPage = byId('ev_test_shop').pages[0];
  const shopCommand = shopPage.commands.find((command: any) => command.kind === 'shop');
  shopCommand.itemIds = ['item_herb', 'item_potion'];
  shopCommand.stock = [{ itemId: 'item_herb', seasons: ['spring'] }, { itemId: 'item_potion', seasons: ['spring'] }];
  // Entrances: the east door and a south gate, both valid transfers.
  map.events = map.events.filter((event: any) => event.id !== 'ev_test_door');
  map.events.push(transferDoor('ev_test_door', '마을 문', 20, 8, 'map_plaza', 2, 2));
  map.events.push(transferDoor('ev_south_gate', '남쪽 출입구', 12, 17, 'map_field', 12, 1));
  // A house door that leads nowhere yet (the user wants it connected to the plaza).
  map.events.push(plainDoor('ev_house_door', '집 문', 7, 6));
  // The east door and the plaza's way back are misaligned: both land the player facing down.
  for (const command of byId('ev_test_door').pages[0].commands) if (command.kind === 'transfer') command.direction = 'down';
  project.maps.map_plaza.events.push(transferDoor('ev_plaza_back', '마을로 가는 문', 1, 2, MAP, 19, 8));
  for (const command of project.maps.map_plaza.events[0].pages[0].commands) if (command.kind === 'transfer') command.direction = 'down';
  // A world map the village is not yet attached to.
  const world = createBlankMap('월드맵', 24, 18, DEFAULT_TILESET_ID); world.id = 'map_world';
  project.maps.map_world = world; project.mapTree.children?.push({ mapId: 'map_world', children: [] });
  // Barrels (and a crate that must survive) in the barrel area, one barrel far away.
  map.events.push(barrel('ev_barrel_a', '통', 3, 12), barrel('ev_barrel_b', '통', 4, 13), barrel('ev_crate', '상자', 5, 12), barrel('ev_barrel_far', '통', 21, 15));
  // Grove, road and a descriptionless item, built with the real tools so the content is what the editor would hold.
  project = runOn(project, 'place_props', { mapId: MAP, area: AREA.trees, material: '버들항 · 나무·덤불', count: 7, seed: 1 });
  for (const [x, y] of [[11, 17], [13, 17], [12, 16]]) project = runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: 534, cells: [{ x, y }] });
  project = runOn(project, 'fill_region', { mapId: MAP, x: 2, y: 10, w: 20, h: 1, layer: 'lower', material: '버들항 모랫길' });
  for (const item of project.database.items) if (!item.description) item.description = `${item.name ?? item.id}`;
  const keyless = project.database.items.find((item: any) => item.id === 'item_old_key');
  if (keyless) keyless.description = '';
  return project;
}

/** The fixture is deterministic but expensive (a 30k-tile bundled tileset); the self-check builds it once and clones per family. */
let pristine: Project | null = null;
export function cachedNativeProject(): Project {
  pristine ??= nativeProject();
  return clone(pristine);
}

// ── editor state a person would have set before typing the prompt ──────────

const NPC = 'ev_utility_npc', DOOR = 'ev_test_door', SHOP = 'ev_test_shop', CUT = 'ev_test_cutscene';
export function setupFor(id: string): Setup {
  switch (id) {
    case 'blocked-cells': return { select: AREA.trees };
    case 'region-preview': return { select: { x: 10, y: 6, w: 1, h: 1 } };
    case 'paint-dirt': return { select: AREA.dirt };
    case 'clear-region': return { select: { x: 1, y: 1, w: 5, h: 3 } };
    case 'copy-region': return { select: { x: 1, y: 1, w: 2, h: 2 } };
    case 'mirror-region': return { select: { x: 2, y: 2, w: 4, h: 2 } };
    case 'move-start': return { select: { x: 9, y: 8, w: 1, h: 1 } };
    case 'place-trees': return { select: { x: 14, y: 2, w: 6, h: 1 } };
    case 'place-chest': return { select: { x: 4, y: 7, w: 1, h: 1 } };
    case 'move-door': case 'door-se': case 'align-portals': return { event: DOOR };
    case 'door-to-plaza': return { event: 'ev_house_door' };
    case 'remove-barrels': return { select: AREA.barrels };
    case 'place-well': return { select: { x: 15, y: 3, w: 3, h: 3 } };
    case 'change-first-line': case 'add-switch-condition': case 'remove-move-command': case 'insert-se': case 'touch-trigger':
    case 'rename-npc': case 'face-right': case 'add-npc-line': case 'npc-schedule': case 'npc-shop': case 'event-playtest':
      return { event: NPC };
    case 'remove-shop-herb': return { event: SHOP };
    case 'screen-shake': case 'dialogue-position': case 'remove-final-fade': return { event: CUT };
    case 'night-mood': return { select: { x: 0, y: 0, w: 24, h: 18 } };
    case 'forest-path': return { select: AREA.trail };
    case 'suggest-selection-actions': case 'plan-only': return { select: AREA.meadow };
    // These ask about something the assistant did a moment ago, so a real earlier turn has to exist.
    case 'undo-preview': case 'summarize-diff': case 'show-tool-log': return { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } };
    case 'rewind-turn': return { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } };
    default: return {};
  }
}

// ── judges ─────────────────────────────────────────────────────────────────

export const EVENT_FIELDS = ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits', 'lowerTileStacks', 'upperTileStacks', 'doodadGroups', 'terrainDesign', 'relief'] as const;
export const TILE_LAYERS = ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits'] as const;

/** Boot normalization and bundled dictionaries are infrastructure, not the command's result. */
export function normalizeContent(project: Project): any {
  // A deep clone, not a shallow spread: judges blank parts on the copy (withoutEvent replaces map.events),
  // and a shared map object would rewrite the document they are comparing against.
  const copy: any = clone(project);
  delete copy.meta; delete copy.tilesets; delete copy.assets;
  return copy;
}
export const mapOf = (project: Project, id = MAP): any => (project as any).maps[id];
export const eventOf = (project: Project, id: string): any => mapOf(project).events.find((event: any) => event.id === id);
export const commandsOf = (project: Project, eventId: string, page = 0): any[] => eventOf(project, eventId)?.pages?.[page]?.commands ?? [];
/** A renamed NPC's dialogue speaker label follows the rename; the lines themselves must not change. */
export const speakerless = (command: any) => (command.kind === 'text' ? { ...command, speaker: undefined } : command);
export const kinds = (commands: any[]) => commands.map(command => command.kind);

/** Document equality with some parts blanked on both sides: "everything else is preserved". */
export function sameExcept(a: Project, b: Project, blank: (doc: any) => void): boolean {
  const left = normalizeContent(a), right = normalizeContent(b);
  blank(left); blank(right);
  return isDeepStrictEqual(left, right);
}
export const withoutEvent = (...ids: string[]) => (doc: any) => { for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id)); };
export const withoutTiles = (doc: any) => { const map = doc.maps[MAP]; for (const key of EVENT_FIELDS) delete map[key]; };
export const withoutDatabaseItems = (doc: any) => { doc.database.items = []; };

export function changedCells(before: Project, after: Project): Array<{ x: number; y: number }> {
  const a = mapOf(before), b = mapOf(after);
  if (a.width !== b.width || a.height !== b.height) return [{ x: -1, y: -1 }];
  const cells = new Set<number>();
  for (const key of TILE_LAYERS) {
    const left: number[] = a[key] ?? [], right: number[] = b[key] ?? [];
    for (let i = 0; i < Math.max(left.length, right.length); i++) if ((left[i] ?? (key === 'shadowBits' ? 0 : -1)) !== (right[i] ?? (key === 'shadowBits' ? 0 : -1))) cells.add(i);
  }
  return [...cells].map(i => ({ x: i % a.width, y: Math.floor(i / a.width) }));
}
export const tileAt = (project: Project, key: typeof TILE_LAYERS[number], x: number, y: number): number => {
  const map = mapOf(project);
  return map[key]?.[y * map.width + x] ?? (key === 'shadowBits' ? 0 : -1);
};

export function blockedCells(project: Project, rect: Rect): Array<{ x: number; y: number }> {
  const context: any = { project: clone(project), currentMapId: MAP, assistantRun: false };
  const result: any = runTool(context, 'get_map_region', { mapId: MAP, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  const grid: string[] = result.data?.grid ?? [];
  const cells: Array<{ x: number; y: number }> = [];
  grid.forEach((row, dy) => [...row].forEach((glyph, dx) => { if (glyph === '#') cells.push({ x: rect.x + dx, y: rect.y + dy }); }));
  return cells;
}

/** One map's blocked cells, read from the editor's own region grid for that map. */
export function blockedOn(project: Project, mapId: string): Set<string> {
  const map = mapOf(project, mapId);
  if (!map) return new Set();
  const context: any = { project, currentMapId: mapId, assistantRun: false };
  const result: any = runTool(context, 'get_map_region', { mapId, x: 0, y: 0, w: map.width, h: map.height });
  const grid: string[] = result.data?.grid ?? [];
  const blocked = new Set<string>();
  grid.forEach((row, dy) => [...row].forEach((glyph, dx) => { if (glyph === '#') blocked.add(`${dx},${dy}`); }));
  return blocked;
}

/** Walkable cells of one map, reached on foot from `from` (4-directional, blocked cells excluded). */
export function walkableFrom(project: Project, mapId: string, from: { x: number; y: number }): Set<string> {
  const map = mapOf(project, mapId);
  const blocked = blockedOn(project, mapId);
  const seen = new Set<string>();
  if (!map || blocked.has(`${from.x},${from.y}`)) return seen;
  const queue = [`${from.x},${from.y}`];
  seen.add(queue[0]!);
  while (queue.length) {
    const [x, y] = queue.pop()!.split(',').map(Number) as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key) || blocked.has(key)) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return seen;
}

/**
 * Maps a player can actually enter from the start position. A door only links when its own cell is walkable
 * from where the player arrives — the fixture's south gate is sealed off, so the map behind it is unreachable
 * even though the transfer command exists.
 */
export function reachableMaps(project: Project): Set<string> {
  const start = (project as any).startMapId ?? MAP;
  const seen = new Set<string>([start]);
  const queue: Array<{ mapId: string; from: { x: number; y: number } }> = [
    { mapId: start, from: (project as any).startPos ?? { x: 0, y: 0 } },
  ];
  while (queue.length) {
    const current = queue.shift()!;
    const map = mapOf(project, current.mapId);
    if (!map) continue;
    const cells = walkableFrom(project, current.mapId, current.from);
    for (const event of map.events ?? []) {
      if (!cells.has(`${event.x},${event.y}`)) continue;
      for (const page of event.pages ?? []) for (const command of page.commands ?? []) {
        if (command?.kind !== 'transfer' || typeof command.mapId !== 'string' || seen.has(command.mapId)) continue;
        seen.add(command.mapId);
        queue.push({ mapId: command.mapId, from: { x: command.x ?? 0, y: command.y ?? 0 } });
      }
    }
  }
  return seen;
}

export const orphanMaps = (project: Project): string[] => Object.keys((project as any).maps).filter(id => !reachableMaps(project).has(id));

/** "(3,2)", "3,2", "x=3, y=2", "(3, 2)" → coordinate pairs. */
export function coordinatesIn(text: string): Array<{ x: number; y: number }> {
  const pairs: Array<{ x: number; y: number }> = [];
  for (const match of text.matchAll(/\(?\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*\)?/g)) pairs.push({ x: Number(match[1]), y: Number(match[2]) });
  for (const match of text.matchAll(/x\s*[=:]\s*(\d{1,2})\D{1,6}y\s*[=:]\s*(\d{1,2})/gi)) pairs.push({ x: Number(match[1]), y: Number(match[2]) });
  return pairs;
}
export const mentions = (answer: string, ...needles: string[]) => needles.some(needle => answer.includes(needle));
export const called = (tools: ToolRecord[], ...names: string[]) => tools.some(tool => tool.ok === true && names.includes(tool.name ?? ''));

export function readOnly(input: JudgeInput, label: string, check: () => Verdict): Verdict {
  if (!isDeepStrictEqual(normalizeContent(input.before), normalizeContent(input.after))) return fail(`${label}: 읽기 명령이 문서를 바꿨다`);
  if (!input.tools.some(tool => tool.ok === true)) return fail(`${label}: 성공한 조회 도구 호출이 없다`);
  if (!input.answer.trim()) return fail(`${label}: 답변이 비었다`);
  return check();
}

/** An empty top-level `branch: []` the model adds to a `choices` command is an ignored field, not a behavior change. */
export function tidyEvent(event: any): any {
  if (!event) return event;
  const copy = clone(event);
  for (const page of copy.pages ?? []) for (const command of page.commands ?? []) if (command.kind === 'choices' && Array.isArray(command.branch) && command.branch.length === 0) delete command.branch;
  return copy;
}

export function eventEdit(input: JudgeInput, id: string, check: (before: any, after: any) => Verdict, allowSystem = false): Verdict {
  const blank = (doc: any) => { withoutEvent(id)(doc); if (allowSystem) delete doc.system; };
  if (!sameExcept(input.before, input.after, blank)) return fail(`${id} 밖의 내용이 바뀌었다`);
  const before = tidyEvent(eventOf(input.before, id)), after = tidyEvent(eventOf(input.after, id));
  if (!before || !after) return fail(`${id} 이벤트가 사라졌다`);
  return check(before, after);
}
/** The original commands survive in order; new ones may be interleaved. */
export const keepsInOrder = (original: any[], next: any[]) => {
  let at = 0;
  for (const command of next) if (at < original.length && isDeepStrictEqual(command, original[at])) at++;
  return at === original.length;
};

export function judge(id: string, input: JudgeInput): Verdict {
  const { before, after, tools, answer } = input;
  switch (id) {
    case 'map-name-size': return readOnly(input, id, () => mentions(answer, '잿불 마을') && /24/.test(answer) && /18/.test(answer) ? pass('이름·크기 보고') : fail('이름(잿불 마을)과 크기(24×18)를 모두 말하지 않았다'));
    case 'find-entrances': return readOnly(input, id, () => {
      const door = mentions(answer, 'ev_test_door', '마을 문') || coordinatesIn(answer).some(c => c.x === 20 && c.y === 8);
      const gate = mentions(answer, 'ev_south_gate', '남쪽 출입구') || coordinatesIn(answer).some(c => c.x === 12 && c.y === 17);
      return door && gate ? pass('출입구 2곳 보고') : fail(`출입구 누락(문=${door}, 남쪽=${gate})`);
    });
    case 'blocked-cells': return readOnly(input, id, () => {
      const truth = blockedCells(before, AREA.trees);
      const said = coordinatesIn(answer).filter(c => inside(AREA.trees, c.x, c.y));
      const hit = truth.filter(cell => said.some(c => c.x === cell.x && c.y === cell.y)).length;
      const spurious = said.filter(c => !truth.some(cell => cell.x === c.x && cell.y === c.y)).length;
      const stated = /총\s*(\d+)\s*칸/u.exec(answer);
      if (stated && Number(stated[1]) !== truth.length) return fail(`답이 총 ${stated[1]}칸이라 했지만 실제는 ${truth.length}칸이다`);
      return hit >= Math.ceil(truth.length * 0.7) && spurious <= Math.max(1, Math.floor(truth.length * 0.2))
        ? pass(`통행 불가 ${truth.length}칸 중 ${hit}칸 보고`) : fail(`통행 불가 ${truth.length}칸 중 ${hit}칸만 맞고 틀린 좌표 ${spurious}개`);
    });
    case 'event-list': return readOnly(input, id, () => {
      const events: any[] = mapOf(before).events;
      const named = events.filter(event => mentions(answer, event.id) || (event.name && answer.includes(event.name)) || (event.pages ?? []).some((page: any) => page.name && answer.includes(page.name)));
      return named.length >= events.length - 1 ? pass(`이벤트 ${events.length}개 중 ${named.length}개 나열`) : fail(`이벤트 ${events.length}개 중 ${named.length}개만 나열`);
    });
    case 'region-preview': return readOnly(input, id, () => {
      if (!called(tools, 'show_map_region')) return fail('show_map_region 호출이 없다');
      // The preview text must not hide what is really there: a tree in the region is an obstacle, not "decoration".
      const blocked = blockedCells(before, { x: 8, y: 4, w: 5, h: 5 });
      return !blocked.length || mentions(answer, '나무', '통행', '장애', '막') ? pass('영역 미리보기 호출, 막힌 칸을 언급') : fail('영역 안의 막힌 칸(나무)을 말하지 않았다');
    });
    case 'paint-dirt': {
      const cells = changedCells(before, after);
      const rect = AREA.dirt;
      if (!cells.length) return fail('바뀐 칸이 없다');
      // The product must paint exactly the selected rectangle: a visual review found a one-cell stub growing outside it.
      if (!cells.every(c => inside(rect, c.x, c.y))) return fail('선택 영역 밖 칸이 바뀌었다');
      const all = Array.from({ length: rect.w * rect.h }, (_, i) => ({ x: rect.x + (i % rect.w), y: rect.y + Math.floor(i / rect.w) }));
      if (!all.every(c => tileAt(before, 'lowerTiles', c.x, c.y) !== tileAt(after, 'lowerTiles', c.x, c.y))) return fail('선택 영역의 일부 칸이 바닥으로 바뀌지 않았다');
      if (!sameExcept(before, after, withoutTiles)) return fail('타일 밖 내용이 바뀌었다');
      return pass(`선택 영역 ${all.length}칸의 바닥만 변경`);
    }
    case 'clear-region': {
      const rect = setupFor(id).select!;
      const cells = changedCells(before, after);
      if (!cells.length) return fail('바뀐 칸이 없다');
      if (!cells.every(c => inside(rect, c.x, c.y))) return fail('선택 영역 밖 칸이 바뀌었다');
      // Cleared means walkable ground: neither a leftover prop nor a hole where the ground was.
      const blocked = blockedCells(after, rect);
      if (blocked.length) return fail(`영역 안에 통행 불가 칸 ${blocked.length}개가 남았다(소품 잔존 또는 바닥 구멍)`);
      return sameExcept(before, after, withoutTiles) ? pass(`영역 안 ${cells.length}칸 정리, 바깥·이벤트 보존`) : fail('타일 밖 내용(이벤트 등)이 바뀌었다');
    }
    case 'copy-region': {
      const source = setupFor(id).select!;
      const cells = changedCells(before, after);
      const target: Rect = { x: source.x + 2, y: source.y, w: source.w, h: source.h };
      if (!cells.length) return fail('바뀐 칸이 없다');
      if (!cells.every(c => inside(target, c.x, c.y))) return fail('오른쪽 2칸 옮긴 목표 영역 밖 칸이 바뀌었다');
      for (let dy = 0; dy < source.h; dy++) for (let dx = 0; dx < source.w; dx++) for (const key of TILE_LAYERS) {
        if (tileAt(after, key, target.x + dx, target.y + dy) !== tileAt(before, key, source.x + dx, source.y + dy)) return fail(`복사된 칸 (${target.x + dx},${target.y + dy}) ${key} 이 원본과 다르다`);
      }
      if (!sameExcept(before, after, withoutTiles)) return fail('타일 밖 내용이 바뀌었다');
      return pass('원본 영역을 오른쪽 2칸에 그대로 복사');
    }
    case 'mirror-region': {
      const rect = setupFor(id).select!;
      const cells = changedCells(before, after);
      if (!cells.length) return fail('바뀐 칸이 없다');
      if (!cells.every(c => inside(rect, c.x, c.y))) return fail('선택 영역 밖 칸이 바뀌었다');
      if (!sameExcept(before, after, withoutTiles)) return fail('타일 밖 내용이 바뀌었다');
      // Horizontal flip: the blocked-ness pattern of every row is reversed.
      const rows = (project: Project) => Array.from({ length: rect.h }, (_, dy) => blockedCells(project, { x: rect.x, y: rect.y + dy, w: rect.w, h: 1 }).map(c => c.x - rect.x).sort().join(','));
      const mirrored = (project: Project) => Array.from({ length: rect.h }, (_, dy) => blockedCells(project, { x: rect.x, y: rect.y + dy, w: rect.w, h: 1 }).map(c => rect.w - 1 - (c.x - rect.x)).sort((l, r) => l - r).join(','));
      const same = isDeepStrictEqual(rows(after), mirrored(before));
      return same ? pass('선택 영역을 좌우로 뒤집음') : fail('좌우 뒤집기 결과가 원본의 거울상이 아니다(상하 뒤집기·회전 의심)');
    }
    case 'move-start': {
      const want = { x: 9, y: 8 };
      const start = (after as any).startPos;
      if (!(start?.x === want.x && start?.y === want.y)) return fail(`시작 위치가 (${start?.x},${start?.y}) 이다`);
      return sameExcept(before, after, doc => { delete doc.startPos; delete doc.startMapId; }) ? pass('시작 위치만 (9,8)로 이동') : fail('시작 위치 밖 내용이 바뀌었다');
    }
    case 'place-trees': {
      const rect = setupFor(id).select!;
      const cells = changedCells(before, after);
      if (cells.length < 3) return fail(`나무 칸이 ${cells.length}개뿐이다`);
      if (!cells.every(c => inside(rect, c.x, c.y))) return fail('선택 영역 밖 칸이 바뀌었다');
      const placed = cells.filter(c => tileAt(after, 'lowerTiles', c.x, c.y) !== tileAt(before, 'lowerTiles', c.x, c.y) || tileAt(after, 'upperTiles', c.x, c.y) !== tileAt(before, 'upperTiles', c.x, c.y));
      if (placed.length !== 3) return fail(`나무 ${placed.length}그루(3그루여야 한다)`);
      return sameExcept(before, after, withoutTiles) ? pass('선택 영역에 정확히 3칸 배치') : fail('타일 밖 내용이 바뀌었다');
    }
    case 'place-chest': {
      const known = new Set(mapOf(before).events.map((event: any) => event.id));
      const added = mapOf(after).events.filter((event: any) => !known.has(event.id));
      if (added.length !== 1) return fail(`새 이벤트가 ${added.length}개다`);
      const chest = added[0];
      if (!(chest.x === 4 && chest.y === 7)) return fail(`상자가 (${chest.x},${chest.y}) 에 놓였다`);
      const looksLikeChest = JSON.stringify(chest).includes('chest') || JSON.stringify(chest).includes('상자') || JSON.stringify(chest).includes('addItem') || JSON.stringify(chest).includes('gold');
      return looksLikeChest && sameExcept(before, after, withoutEvent(chest.id)) ? pass('(4,7)에 상자 이벤트 1개') : fail('상자 이벤트가 아니거나 다른 내용이 바뀌었다');
    }
    case 'move-door': return eventEdit(input, DOOR, (b, a) =>
      a.x === b.x - 1 && a.y === b.y ? (isDeepStrictEqual(a.pages, b.pages) ? pass('문 이벤트를 한 칸 왼쪽으로 이동, 전이 보존') : fail('문 이벤트의 페이지(전이 목적지)가 바뀌었다')) : fail(`문이 (${a.x},${a.y}) 에 있다`));
    case 'remove-barrels': {
      const gone = ['ev_barrel_a', 'ev_barrel_b'].filter(eventId => !eventOf(after, eventId));
      if (gone.length !== 2) return fail(`지역 안 통 ${gone.length}/2개만 제거`);
      if (!eventOf(after, 'ev_crate')) return fail('통이 아닌 상자까지 제거했다');
      if (!eventOf(after, 'ev_barrel_far')) return fail('지역 밖 통까지 제거했다');
      return sameExcept(before, after, withoutEvent('ev_barrel_a', 'ev_barrel_b')) ? pass('지역 안 통 2개만 제거') : fail('다른 내용이 바뀌었다');
    }
    case 'place-well': {
      const rect = setupFor(id).select!;
      const cells = changedCells(before, after);
      if (!cells.length) return fail('바뀐 칸이 없다');
      if (!cells.every(c => inside(rect, c.x, c.y))) return fail('선택 영역 밖 칸이 바뀌었다');
      return sameExcept(before, after, withoutTiles) ? pass(`선택 영역에 우물 ${cells.length}칸 배치`) : fail('타일 밖 내용이 바뀌었다');
    }
    case 'change-first-line': return eventEdit(input, NPC, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      if (now[0]?.kind !== 'text' || !now[0].body?.trim() || now[0].body === was[0].body) return fail('첫 대사가 바뀌지 않았다');
      if (now[0].speaker !== was[0].speaker) return fail('요청하지 않은 화자(speaker)가 바뀌었다');
      return isDeepStrictEqual(kinds(now), kinds(was)) && isDeepStrictEqual(now.slice(1), was.slice(1)) ? pass('첫 대사만 교체') : fail('첫 대사 밖의 명령이 바뀌었다');
    });
    case 'add-switch-condition': {
      // Giving a still-unnamed switch a name so the condition reads sensibly is part of using it; any other switch edit is not.
      const namesOnly = (doc: any) => { const copy = clone(doc); copy.switches = (copy.switches ?? []).map((entry: any) => ((before as any).switches ?? []).some((old: any) => old.id === entry.id && !String(old.name ?? '').trim()) ? { ...entry, name: '' } : entry); return copy; };
      return eventEdit({ ...input, after: namesOnly(input.after), before: namesOnly(input.before) }, NPC, (b, a) => {
      const ids = new Set((after as any).switches.map((entry: any) => entry.id));
      const conditionsOf = (event: any) => (event.pages ?? []).flatMap((page: any) => page.conditions ?? []);
      const added = conditionsOf(a).filter((condition: any) => !conditionsOf(b).some((old: any) => isDeepStrictEqual(old, condition)));
      if (added.length < 1 || !added.every((condition: any) => condition.kind === 'switch' && ids.has(condition.switchId))) return fail('존재하는 스위치 조건이 추가되지 않았다');
      // Either the page itself is gated, or a new gated page is added beside it; the existing commands must survive.
      const survives = (a.pages ?? []).some((page: any) => isDeepStrictEqual(page.commands, b.pages[0].commands));
      return survives ? pass(`스위치 조건 ${added.map((condition: any) => condition.switchId).join(',')} 추가`) : fail('원래 대사·명령이 사라졌다');
      });
    }
    case 'remove-move-command': return eventEdit(input, NPC, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      return isDeepStrictEqual(now, was.filter((command: any) => command.kind !== 'moveEvent')) ? pass('이동 명령만 삭제') : fail('이동 명령만 지워지지 않았다');
    });
    case 'insert-se': return eventEdit(input, NPC, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      const added = now.filter((command: any) => !was.some((old: any) => isDeepStrictEqual(old, command)));
      return added.length === 1 && added[0].kind === 'playAudio' && keepsInOrder(was, now) ? pass(`효과음 ${added[0].resourceId} 삽입`) : fail('효과음 명령 하나만 삽입되지 않았다');
    });
    case 'touch-trigger': return eventEdit(input, NPC, (b, a) =>
      // 'touch' is the same trigger under its short name (transferReachability TOUCH_TRIGGERS, eventTools touch checks).
      ['playerTouch', 'touch'].includes(a.pages[0].trigger?.kind) && isDeepStrictEqual(a.pages[0].commands, b.pages[0].commands) ? pass('실행 조건을 플레이어 접촉으로') : fail(`트리거가 ${a.pages[0].trigger?.kind}`));
    case 'rename-npc': return eventEdit(input, NPC, (b, a) => {
      if (!(a.name === '하린' || a.pages?.[0]?.name === '하린')) return fail(`이름이 ${a.name ?? a.pages?.[0]?.name}`);
      if (!isDeepStrictEqual(a.pages[0].commands.map(speakerless), b.pages[0].commands.map(speakerless))) return fail('화자 표시 밖의 대사 명령이 바뀌었다');
      // Visual review (2026-10-14): the name players see in the dialogue box is the speaker; renaming only the event leaves the old name on screen.
      const stale = a.pages[0].commands.filter((command: any) => command.kind === 'text' && command.speaker === '마을 주민');
      return stale.length ? fail('대사 화자명이 옛 이름(마을 주민)으로 남았다') : pass('이름을 하린으로(화자 표시 포함)');
    });
    case 'face-right': return eventEdit(input, NPC, (b, a) =>
      a.pages[0].graphic?.direction === 'right' && isDeepStrictEqual(a.pages[0].graphic?.sprite, b.pages[0].graphic?.sprite) ? pass('오른쪽을 바라봄, 그림 유지') : fail(`방향 ${a.pages[0].graphic?.direction}`));
    case 'add-npc-line': return eventEdit(input, NPC, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      const added = now.filter((command: any) => !was.some((old: any) => isDeepStrictEqual(old, command)));
      return added.length === 1 && added[0].kind === 'text' && String(added[0].body ?? '').trim() && keepsInOrder(was, now) ? pass('대사 한 줄 추가') : fail('텍스트 명령 하나만 추가되지 않았다');
    });
    case 'npc-schedule': return eventEdit(input, NPC, (b, a) => {
      const schedule = a.schedule ?? [];
      const valid = schedule.length >= 1 && schedule.every((entry: any) => entry.at && (after as any).maps[entry.at.mapId]);
      return valid && isDeepStrictEqual(a.pages, b.pages) ? pass(`일정 ${schedule.length}개 등록`) : fail('유효한 일정이 등록되지 않았거나 페이지가 바뀌었다');
    }, true);
    case 'npc-shop': return eventEdit(input, NPC, (b, a) => {
      const shops = (a.pages ?? []).flatMap((page: any) => page.commands).concat(a.commands ?? []).filter((command: any) => command.kind === 'shop');
      // A shop sells items and equipment alike (the tool accepts both id spaces).
      const items = new Set([...(after as any).database.items, ...((after as any).database.equipment ?? [])].map((item: any) => item.id));
      const valid = shops.length >= 1 && shops.some((shop: any) => (shop.itemIds ?? []).length >= 1 && (shop.itemIds as string[]).every(itemId => items.has(itemId)));
      return valid && keepsInOrder(b.pages[0].commands, a.pages[0].commands) ? pass('대화 시 상점이 열리는 명령 추가') : fail('유효한 상점 명령이 없거나 기존 대사가 바뀌었다');
    });
    case 'potion-price': {
      const potion = (after as any).database.items.find((item: any) => item.id === 'item_potion');
      return potion?.price === 30 && sameExcept(before, after, withoutDatabaseItems) && isDeepStrictEqual((after as any).database.items.filter((i: any) => i.id !== 'item_potion'), (before as any).database.items.filter((i: any) => i.id !== 'item_potion'))
        ? pass('회복약 가격 30골드') : fail(`회복약 가격 ${potion?.price} 이거나 다른 항목이 바뀌었다`);
    }
    case 'sword-attack': {
      const was = (before as any).database.equipment.find((e: any) => e.id === 'equip_iron_sword'), now = (after as any).database.equipment.find((e: any) => e.id === 'equip_iron_sword');
      const attack = (item: any) => item?.statBonuses?.attack ?? item?.stats?.attack ?? 0;
      return attack(now) === attack(was) + 5 && isDeepStrictEqual((after as any).database.equipment.filter((e: any) => e.id !== 'equip_iron_sword'), (before as any).database.equipment.filter((e: any) => e.id !== 'equip_iron_sword'))
        ? pass(`철검 공격력 ${attack(was)} → ${attack(now)}`) : fail(`철검 공격력 ${attack(was)} → ${attack(now)} (+5 여야 한다)`);
    }
    case 'item-description': {
      const items = (after as any).database.items, was = (before as any).database.items;
      const changed = items.filter((item: any) => !isDeepStrictEqual(item, was.find((old: any) => old.id === item.id)));
      return changed.length === 1 && changed[0].id === 'item_old_key' && String(changed[0].description ?? '').trim() && items.length === was.length ? pass('설명 없던 아이템에만 설명 추가') : fail(`변경된 아이템 ${changed.map((item: any) => item.id).join(',') || '없음'}`);
    }
    case 'create-key-item': {
      const items = (after as any).database.items, was = (before as any).database.items;
      const added = items.filter((item: any) => !was.some((old: any) => old.id === item.id));
      return added.length === 1 && (added[0].type === 'keyItem' || /열쇠|key/i.test(`${added[0].name}${added[0].id}`)) && was.every((old: any) => isDeepStrictEqual(old, items.find((item: any) => item.id === old.id))) ? pass(`열쇠 아이템 ${added[0].id}`) : fail('열쇠 아이템 하나만 추가되지 않았다');
    }
    case 'remove-shop-herb': return eventEdit(input, SHOP, (b, a) => {
      const shop = (event: any) => event.pages[0].commands.find((command: any) => command.kind === 'shop');
      const left = shop(a), was = shop(b);
      if (!left) return fail('상점 명령이 통째로 사라졌다');
      const ids = (command: any) => [...new Set([...(command.itemIds ?? []), ...(command.stock ?? []).map((entry: any) => entry.itemId)])];
      return !ids(left).includes('item_herb') && ids(was).filter((itemId: string) => itemId !== 'item_herb').every((itemId: string) => ids(left).includes(itemId))
        ? pass('약초만 재고에서 제거') : fail(`재고 ${ids(left).join(',')}`);
    });
    case 'screen-shake': return eventEdit(input, CUT, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      // Filling a command's default fields (m2Command fields {} -> {fade:'black'}) is not a change of meaning.
      const same = (old: any, next: any) => isDeepStrictEqual(old, next)
        || (old.kind === 'm2Command' && next.kind === 'm2Command' && old.commandId === next.commandId && Object.entries(old.fields ?? {}).every(([key, value]) => isDeepStrictEqual(next.fields?.[key], value)));
      let at = 0;
      const added: any[] = [];
      for (const command of now) { if (at < was.length && same(was[at], command)) at++; else added.push(command); }
      const shakes = added.filter((command: any) => command.kind === 'm2Command' && /shake/.test(String(command.commandId)));
      // The shake may be followed by a wait so it reads on screen; anything else added is an unrequested change.
      return at === was.length && shakes.length === 1 && added.every((command: any) => command === shakes[0] || command.kind === 'wait') ? pass('화면 흔들림 추가') : fail('화면 흔들림 명령 하나만 추가되지 않았다');
    });
    case 'dialogue-position': return eventEdit(input, CUT, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      const strip = (list: any[]) => list.map((c: any) => (c.kind === 'text' ? { ...c, position: undefined } : c));
      // Two real ways to say it: the text command's own position, or a displayTextSettings command placed before the text.
      const viaText = now.find((command: any) => command.kind === 'text')?.position === 'bottom' && isDeepStrictEqual(strip(now), strip(was));
      const settings = now.filter((command: any) => command.kind === 'displayTextSettings');
      const firstText = now.findIndex((command: any) => command.kind === 'text');
      const viaSettings = settings.length === 1 && settings[0].position === 'bottom' && now.indexOf(settings[0]) < firstText
        && isDeepStrictEqual(strip(now.filter((command: any) => command.kind !== 'displayTextSettings')), strip(was));
      return viaText || viaSettings ? pass('대사 위치를 아래쪽으로') : fail('대사 위치가 아래쪽으로 바뀌지 않았거나 다른 명령이 바뀌었다');
    });
    case 'door-se': return eventEdit(input, DOOR, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      const at = now.findIndex((command: any) => command.kind === 'playAudio'), transfer = now.findIndex((command: any) => command.kind === 'transfer');
      return at >= 0 && transfer >= 0 && at < transfer && keepsInOrder(was, now) && now.length === was.length + 1 ? pass('이동 전에 효과음 재생') : fail('이동(transfer) 앞에 효과음 하나가 들어가지 않았다');
    });
    case 'night-mood': {
      const was = mapOf(before).defaultLighting?.ambient ?? 1, light = mapOf(after).defaultLighting;
      const hex = String(light?.color ?? '#ffffff').replace('#', '');
      const luminance = hex.length === 6 ? (0.299 * parseInt(hex.slice(0, 2), 16) + 0.587 * parseInt(hex.slice(2, 4), 16) + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255 : 1;
      const dark = typeof light?.ambient === 'number' && light.ambient < was && (light.ambient <= 0.5 || (light.ambient <= 0.75 && luminance <= 0.25));
      return dark && sameExcept(before, after, doc => { delete doc.maps[MAP].defaultLighting; delete doc.maps[MAP].weather; delete doc.maps[MAP].climate; })
        ? pass(`밝기 ${was} → ${light.ambient}, 색 ${light.color}`) : fail(`밤 조명이 아니다(ambient ${light?.ambient}, 색 ${light?.color})`);
    }
    case 'remove-final-fade': return eventEdit(input, CUT, (b, a) => {
      const was = b.pages[0].commands, now = a.pages[0].commands;
      const isFade = (command: any) => command.kind === 'm2Command' && /m2-04[45]/.test(String(command.commandId));
      const lastIndex = was.map(isFade).lastIndexOf(true);
      if (lastIndex < 0) return fail('fixture 에 페이드가 없다');
      // A fade is a hide-screen ... show-screen block (the wait between them is its duration), so "the final fade" is the last show-screen
      // alone or that closing block; anything outside the block, or any other command inside it, may not go.
      const firstIndex = was.findIndex(isFade);
      const removed = was.filter((command: any) => !now.some((kept: any) => isDeepStrictEqual(kept, command)));
      const block = was.slice(firstIndex, lastIndex + 1);
      const inBlock = removed.length >= 1 && removed.includes(was[lastIndex]) && removed.every((command: any) => block.includes(command) && (isFade(command) || command.kind === 'wait'));
      // Visual review (2026-10-14): deleting only the closing show-screen leaves the screen black after the scene. A fade goes as a pair.
      const hides = (list: any[]) => list.filter((command: any) => isFade(command) && /m2-044/.test(String(command.commandId))).length;
      const shows = (list: any[]) => list.filter((command: any) => isFade(command) && /m2-045/.test(String(command.commandId))).length;
      if (hides(now) !== shows(now) + (hides(was) - shows(was))) return fail('페이드의 화면 숨기기/보이기 짝이 깨져 화면이 어두운 채 남는다');
      return inBlock && isDeepStrictEqual(now, was.filter((command: any) => !removed.includes(command))) ? pass(`마지막 페이드 ${removed.length}명령만 제거`) : fail('마지막 페이드만 지워지지 않았다');
    });
    case 'walkability-check': return readOnly(input, id, () => called(tools, 'check_reachability', 'run_scene_test', 'get_map_region') && /가능|불가|도달|걸어/.test(answer) ? pass('도달 가능 여부 보고') : fail('도달성 검사 호출 또는 결론이 없다'));
    case 'event-playtest': return readOnly(input, id, () => called(tools, 'run_scene_test') ? pass('이벤트 실행') : fail('run_scene_test 호출이 없다'));
    case 'blocked-entrance': return readOnly(input, id, () => mentions(answer, 'ev_south_gate', '남쪽 출입구') || coordinatesIn(answer).some(c => c.x === 12 && c.y === 17) ? pass('막힌 남쪽 출입구 보고') : fail('나무로 막힌 남쪽 출입구(12,17)를 찾아내지 못했다'));
    case 'unused-switches': return readOnly(input, id, () => mentions(answer, 'sw_unused', '미사용 스위치') ? pass('미사용 스위치 보고') : fail('sw_unused 를 말하지 않았다'));
    case 'undo-preview': return readOnly(input, id, () => called(tools, 'list_edit_history') && (/되돌|취소|미리|복원/.test(answer)) && (mentions(answer, '나무', '타일') || coordinatesIn(answer).some(c => c.x === 14 && c.y === 2)) ? pass('방금 변경(나무)을 되돌릴 미리보기 제시') : fail('방금 변경한 나무 배치를 되돌릴 수 있다는 미리보기가 없다'));
    case 'door-to-plaza': return eventEdit(input, 'ev_house_door', (b, a) => {
      const transfer = (a.pages ?? []).flatMap((page: any) => page.commands).concat(a.commands ?? []).find((command: any) => command.kind === 'transfer');
      return transfer?.mapId === 'map_plaza' ? pass(`문 → 광장 (${transfer.x},${transfer.y})`) : fail('문이 광장(map_plaza)으로 연결되지 않았다');
    });
    case 'align-portals': {
      const transferOf = (project: Project, mapId: string, eventId: string) => mapOf(project, mapId).events.find((event: any) => event.id === eventId)?.pages?.flatMap((page: any) => page.commands).find((command: any) => command.kind === 'transfer');
      const out = transferOf(after, MAP, DOOR), back = transferOf(after, 'map_plaza', 'ev_plaza_back');
      if (!out || !back) return fail('두 출입구 중 하나가 사라졌다');
      // A missing direction means retain at runtime (playSceneMapCommands), so it is the same answer as 'retain'.
      const dirOut = out.direction ?? 'retain', dirBack = back.direction ?? 'retain';
      if (!['right', 'retain'].includes(dirOut) || !['left', 'retain'].includes(dirBack)) return fail(`방향이 가는 쪽 ${out.direction}, 돌아오는 쪽 ${back.direction} 이다`);
      const keep = (project: Project) => { const copy = normalizeContent(project); for (const [mapId, eventId] of [[MAP, DOOR], ['map_plaza', 'ev_plaza_back']]) for (const event of copy.maps[mapId].events) if (event.id === eventId) for (const page of event.pages) for (const command of page.commands) if (command.kind === 'transfer') delete command.direction; return copy; };
      return isDeepStrictEqual(keep(before), keep(after)) ? pass(`출입구 방향 정렬(가는 쪽 ${out.direction}, 돌아오는 쪽 ${back.direction})`) : fail('방향 밖의 내용(좌표·목적지)이 바뀌었다');
    }
    case 'worldmap-north': {
      const transfersTo = (mapId: string, target: string) => mapOf(after, mapId).events.filter((event: any) => (event.pages ?? []).some((page: any) => page.commands.some((command: any) => command.kind === 'transfer' && command.mapId === target)) || event.commands?.some((command: any) => command.kind === 'transfer' && command.mapId === target));
      const northGate = transfersTo('map_world', MAP).filter((event: any) => event.y <= 2);
      const way = transfersTo(MAP, 'map_world');
      // Visual review (2026-10-14): the assistant erased a bush at (12,16) to unseal an old gate nobody asked about. Only the new gates may change.
      const known = new Set(mapOf(before, 'map_world').events.map((event: any) => event.id)), knownHere = new Set(mapOf(before).events.map((event: any) => event.id));
      const near = (cell: { x: number; y: number }) => [...northGate, ...way].some((gate: any) => Math.abs(gate.x - cell.x) <= 2 && Math.abs(gate.y - cell.y) <= 2);
      const stray = changedCells(before, after).filter(cell => !near(cell));
      if (stray.length) return fail(`출입구 밖 타일 ${stray.length}칸이 바뀌었다 (예: ${stray[0]!.x},${stray[0]!.y})`);
      const changedEvents = [...mapOf(before).events.filter((event: any) => !isDeepStrictEqual(event, mapOf(after).events.find((x: any) => x.id === event.id))), ...mapOf(before, 'map_world').events.filter((event: any) => !isDeepStrictEqual(event, mapOf(after, 'map_world').events.find((x: any) => x.id === event.id)))];
      if (changedEvents.length) return fail(`기존 이벤트 ${changedEvents.length}개가 바뀌었다`);
      void known; void knownHere;
      return northGate.length >= 1 && way.length >= 1 ? pass(`월드맵 북쪽 (${northGate[0].x},${northGate[0].y}) ↔ 마을 (${way[0].x},${way[0].y})`) : fail(`월드맵 북쪽 출입구 ${northGate.length}개, 마을 쪽 출입구 ${way.length}개`);
    }
    case 'unreachable-links': return readOnly(input, id, () => called(tools, 'lint_world', 'run_lint', 'check_reachability') ? pass('연결 점검') : fail('연결 점검 도구 호출이 없다'));
    case 'forest-path': {
      const rect = AREA.trail;
      const cells = changedCells(before, after);
      if (cells.length < 4) return fail(`바뀐 칸이 ${cells.length}개뿐이다`);
      // Visual review (2026-10-14) found a stray stone tile one row above the area and a row of empty ground tiles (holes); both are failures.
      if (!cells.every(c => inside(rect, c.x, c.y))) return fail('선택 영역 밖 칸이 바뀌었다');
      const holes = cells.filter(c => tileAt(before, 'lowerTiles', c.x, c.y) > 0 && tileAt(after, 'lowerTiles', c.x, c.y) <= 0);
      if (holes.length) return fail(`바닥 타일이 비어 구멍이 된 칸 ${holes.length}개`);
      return sameExcept(before, after, withoutTiles) ? pass(`숲길 ${cells.length}칸`) : fail('타일 밖 내용이 바뀌었다');
    }
    case 'summarize-diff': return readOnly(input, id, () => mentions(answer, '나무', '타일') || coordinatesIn(answer).some(c => c.x === 14 && c.y === 2) ? pass('방금 변경 요약') : fail('방금 놓은 나무(14,2)를 요약하지 않았다'));
    case 'show-tool-log': return readOnly(input, id, () => coordinatesIn(answer).some(c => c.x === 14 && c.y === 2) ? pass('수정한 타일 (14,2) 제시') : fail('수정한 타일 (14,2) 를 목록에 넣지 않았다'));
    case 'rewind-turn': return isDeepStrictEqual(normalizeContent(after), normalizeContent(input.original)) && !isDeepStrictEqual(normalizeContent(before), normalizeContent(input.original))
      ? pass('선행 변경을 되돌려 원래 문서와 같다') : fail('선행 변경이 원래 상태로 되돌려지지 않았다');
    case 'plan-only': {
      if (!isDeepStrictEqual(normalizeContent(before), normalizeContent(after))) return fail('계획만 보여달라고 했는데 문서가 바뀌었다');
      if (answer.trim().length < 20) return fail('계획 답변이 없다');
      // "이 작업" has no referent in the prompt: the plan must hang on the selected area, or ask which task. Inventing interior work is a defect.
      if (/실내|내부 시공/u.test(answer)) return fail('요청에 없는 실내 시공을 지어내 계획했다');
      return coordinatesIn(answer).some(c => inside(AREA.meadow, c.x, c.y)) || mentions(answer, '선택') || /[?？]/u.test(answer) ? pass('실행 없이, 선택 영역을 기준으로 계획') : fail('선택 영역을 기준으로 하지도, 무엇을 계획할지 되묻지도 않았다');
    }
    case 'suggest-selection-actions': return readOnly(input, id, () => answer.trim().length >= 20 ? pass('선택 영역 작업 추천') : fail('추천이 없다'));
    default: return fail(`판정기가 없는 명령: ${id}`);
  }
}

/** The fixture must actually give each prompt something to act on; otherwise a pass proves nothing. */
export function fixtureProblems(project: Project): string[] {
  const problems: string[] = [];
  const map = mapOf(project);
  for (const event of map.events) if (event.x < 0 || event.y < 0 || event.x >= map.width || event.y >= map.height) problems.push(`이벤트 ${event.id} 가 맵 밖 (${event.x},${event.y})`);
  for (const id of ['clear-region', 'copy-region', 'mirror-region', 'blocked-cells']) {
    const rect = setupFor(id).select!;
    if (!blockedCells(project, rect).length) problems.push(`${id}: 선택 영역에 소품이 없어 결과를 구분할 수 없다`);
  }
  const copyRect = setupFor('copy-region').select!;
  if (!blockedCells(project, copyRect).length) problems.push('copy-region: 원본 2×2 에 소품이 없다');
  for (const [id, rect] of [['place-trees', setupFor('place-trees').select!], ['place-well', setupFor('place-well').select!], ['paint-dirt', AREA.dirt]] as const) {
    if (blockedCells(project, rect).length) problems.push(`${id}: 선택 영역이 이미 막혀 있다`);
  }
  for (const eventId of ['ev_barrel_a', 'ev_barrel_b']) { const e = map.events.find((event: any) => event.id === eventId); if (!e || !inside(AREA.barrels, e.x, e.y)) problems.push(`${eventId} 가 통 영역 밖`); }
  if (inside(AREA.barrels, 21, 15)) problems.push('먼 통이 통 영역 안');
  const gate = blockedCells(project, { x: 11, y: 16, w: 3, h: 2 }).length;
  if (gate < 3) problems.push(`남쪽 출입구 주변이 막혀 있지 않다(${gate}/3)`);
  if (project.database.items.filter((item: any) => !String(item.description ?? '').trim()).length !== 1) problems.push('설명 없는 아이템이 정확히 하나가 아니다');
  return problems;
}
