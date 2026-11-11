// map-vqa 보정용 «심은 결함»: 사람이 만든 좋은 맵(장소 견본)의 사본에 결함 한 가지를 일부러 넣는다. 검수자는 그 자리에서 그 결함을 잡아야 한다.
// 조리법은 결정론이다(같은 견본 → 같은 사본). 심은 자리(planted)는 판정에 쓰는 정답이고 검수자에게는 주지 않는다.
import type { Project } from '../../../../project/types';
import { cloneDoc } from '../smallJobs/checkSupport';
import type { MapFacts } from './facts';
import type { Defect, MapReview } from './verdict';

export type Rect = { x: number; y: number; w: number; h: number };
export type Planted = { project: Project; region: Rect; note: string };
export type Recipe = 'strip-furniture' | 'shift-objects' | 'stamp-6x' | 'wall-off' | 'locked-text-on-way' | 'person-on-roof' | 'unpainted-hole' | 'exit-on-bare-edge';
/** 조리법마다: 검수자가 이 가운데 하나의 종류로, major 이상으로, 심은 자리와 겹치게 적어야 «잡았다»로 친다. */
export const RECIPE_CLASSES: Record<Recipe, string[]> = {
  'strip-furniture': ['empty-expanse', 'other'],
  'shift-objects': ['wrong-surface', 'cut-off-piece', 'passage-mismatch', 'unpainted-or-seam', 'doorless-building', 'other'],
  'stamp-6x': ['repeated-stamp', 'cut-off-piece', 'wrong-surface'],
  'wall-off': ['enclosure-unreadable', 'passage-mismatch', 'doorless-building', 'road-to-nowhere', 'cut-off-piece', 'unpainted-or-seam'],
  'locked-text-on-way': ['invisible-event-misplaced', 'passage-mismatch', 'enclosure-unreadable'],
  'person-on-roof': ['people-placement', 'wrong-surface'],
  'unpainted-hole': ['unpainted-or-seam', 'cut-off-piece', 'empty-expanse'],
  'exit-on-bare-edge': ['exit-off-road', 'invisible-event-misplaced'],
};

const LAYERS = ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits'] as const;
const STACKS = ['lowerTileStacks', 'upperTileStacks'] as const;
const OBJECT_LAYERS = ['upperTiles', 'upperOverlayTiles'] as const;
const index = (map: any, x: number, y: number) => y * map.width + x;
const inside = (map: any, x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
function draft(project: Project, mapId: string): { project: Project; map: any } {
  const copy = cloneDoc(project) as any;
  return { project: copy as Project, map: copy.maps[mapId] };
}
/** 한 칸의 모든 층을 다른 칸으로 복사한다(층 쌓임 포함). */
function copyCell(map: any, sx: number, sy: number, dx: number, dy: number, source: any = map): void {
  if (!inside(map, dx, dy) || !inside(source, sx, sy)) return;
  for (const layer of LAYERS) if (Array.isArray(source[layer])) { map[layer] ??= new Array(map.width * map.height).fill(layer === 'shadowBits' ? 0 : -1); map[layer][index(map, dx, dy)] = source[layer][index(source, sx, sy)]; }
  for (const stacks of STACKS) { const from = source[stacks]?.[index(source, sx, sy)]; if (from) { map[stacks] ??= {}; map[stacks][index(map, dx, dy)] = [...from]; } else if (map[stacks]) delete map[stacks][index(map, dx, dy)]; }
}
const hasObject = (map: any, x: number, y: number): boolean => OBJECT_LAYERS.some(layer => (map[layer]?.[index(map, x, y)] ?? -1) >= 0) || !!map.upperTileStacks?.[index(map, x, y)]?.length;

/** 가구·소품 층을 통째로 지운다 — 방이 빈 바닥만 남는다. */
function stripFurniture(project: Project, mapId: string): Planted {
  const { project: copy, map } = draft(project, mapId);
  for (const layer of OBJECT_LAYERS) if (Array.isArray(map[layer])) map[layer] = map[layer].map(() => -1);
  delete map.upperTileStacks; map.doodadGroups = [];
  return { project: copy, region: { x: 0, y: 0, w: map.width, h: map.height }, note: '윗층(가구·소품)을 모두 지웠다' };
}
/** 물체 층만 오른쪽 3·아래 2칸 민다 — 가구가 벽·통로 위로 올라가고 잘린다. */
function shiftObjects(project: Project, mapId: string): Planted {
  const { project: copy, map } = draft(project, mapId), source = structuredClone({ upperTiles: map.upperTiles, upperOverlayTiles: map.upperOverlayTiles, upperTileStacks: map.upperTileStacks });
  for (const layer of OBJECT_LAYERS) {
    if (!Array.isArray(map[layer])) continue;
    map[layer] = map[layer].map(() => -1);
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (inside(map, x - 3, y - 2)) map[layer][index(map, x, y)] = (source as any)[layer][index(map, x - 3, y - 2)];
  }
  if (source.upperTileStacks) { map.upperTileStacks = {}; for (const [cell, stack] of Object.entries<any>(source.upperTileStacks)) { const x = Number(cell) % map.width + 3, y = Math.floor(Number(cell) / map.width) + 2; if (inside(map, x, y)) map.upperTileStacks[index(map, x, y)] = stack; } }
  return { project: copy, region: { x: 0, y: 0, w: map.width, h: map.height }, note: '물체 층을 오른쪽 3칸·아래 2칸 밀었다' };
}
/** 물체가 가장 빽빽한 6×6 조각 하나를 한 줄에 6번 찍는다. */
function stampSix(project: Project, mapId: string): Planted | null {
  const { project: copy, map } = draft(project, mapId), size = Math.min(6, Math.floor((map.width - 2) / 6));
  if (size < 3 || map.height < size + 2) return null;
  let best = { x: 0, y: 0, count: -1 };
  for (let y = 0; y + size <= map.height; y += 1) for (let x = 0; x + size <= map.width; x += 1) {
    let count = 0;
    for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) if (hasObject(map, x + dx, y + dy)) count += 1;
    if (count > best.count) best = { x, y, count };
  }
  if (best.count < size) return null;
  const source = structuredClone(map), rowY = Math.max(0, Math.min(map.height - size, Math.floor(map.height / 2) - Math.floor(size / 2)));
  const span = Math.floor(map.width / 6);
  for (let n = 0; n < 6; n += 1) for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) copyCell(map, best.x + dx, best.y + dy, n * span + dx, rowY + dy, source);
  map.events = (map.events ?? []).filter((event: any) => !(event.y >= rowY && event.y < rowY + size));
  return { project: copy, region: { x: 0, y: rowY, w: Math.min(map.width, 5 * span + size), h: size }, note: `(${best.x},${best.y}) 의 ${size}×${size} 조각을 y=${rowY} 줄에 6번 찍었다` };
}
/** 가장자리의 열린 구간(문·성문·길 끝)을 옆의 막힌 칸 그림으로 덮어 막는다 — 안쪽 두 줄까지. */
function wallOff(project: Project, mapId: string, facts: MapFacts): Planted | null {
  const runs = facts.openEdges.filter(run => run.to - run.from + 1 <= 8);
  if (!runs.length || runs.length !== facts.openEdges.length) return null; // 넓게 열린 가장자리(들판)는 막을 문이 아니다
  const { project: copy, map } = draft(project, mapId), source = structuredClone(map);
  const touched: Array<[number, number]> = [];
  for (const run of runs) {
    const along = run.edge === 'north' || run.edge === 'south';
    const inward: [number, number] = run.edge === 'north' ? [0, 1] : run.edge === 'south' ? [0, -1] : run.edge === 'west' ? [1, 0] : [-1, 0];
    const edgeCell = (i: number): [number, number] => along ? [i, run.edge === 'north' ? 0 : map.height - 1] : [run.edge === 'west' ? 0 : map.width - 1, i];
    // 구간 바로 옆의 막힌 가장자리 칸을 벽 견본으로 쓴다.
    const sample = [run.from - 1, run.to + 1].map(edgeCell).find(([x, y]) => inside(map, x, y) && facts.blocked.has(`${x},${y}`));
    if (!sample) return null;
    for (let i = run.from; i <= run.to; i += 1) for (let depth = 0; depth < 2; depth += 1) {
      const [ex, ey] = edgeCell(i), x = ex + inward[0] * depth, y = ey + inward[1] * depth;
      copyCell(map, sample[0] + inward[0] * depth, sample[1] + inward[1] * depth, x, y, source);
      touched.push([x, y]);
    }
  }
  map.events = (map.events ?? []).filter((event: any) => !touched.some(([x, y]) => event.x === x && event.y === y));
  const xs = touched.map(cell => cell[0]), ys = touched.map(cell => cell[1]);
  return { project: copy, region: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }, note: `가장자리의 열린 구간 ${runs.length}곳을 옆 벽 그림으로 막았다` };
}
const lockedEvent = (id: string, x: number, y: number) => ({ id, name: '굳게 닫힌 집 문', x, y, trigger: { kind: 'playerTouch' }, commands: [], pages: [{ id: `${id}_p0`, name: '굳게 닫힌 집 문', conditions: [], graphic: { transparent: true }, trigger: { kind: 'playerTouch' }, priority: 'same', overlapForbidden: true, movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', body: '문이 굳게 잠겨 있다. 들어갈 수 없는 집이다.' }] }] });
/** 가장 좁은 열린 가장자리 구간(문·길 끝)의 한 줄 안쪽을 «잠긴 집 문» 글 이벤트(안 보임)로 가로막는다 — lockedDoors 가 성문에 깐 것과 같은 모양. */
function lockedTextOnWay(project: Project, mapId: string, facts: MapFacts): Planted | null {
  const run = [...facts.openEdges].filter(candidate => candidate.to - candidate.from + 1 <= 8).sort((a, b) => (a.to - a.from) - (b.to - b.from))[0];
  if (!run) return null;
  const { project: copy, map } = draft(project, mapId), cells: Array<[number, number]> = [];
  for (let i = run.from; i <= run.to; i += 1) {
    const cell: [number, number] = run.edge === 'north' ? [i, 1] : run.edge === 'south' ? [i, map.height - 2] : run.edge === 'west' ? [1, i] : [map.width - 2, i];
    if (!facts.blocked.has(`${cell[0]},${cell[1]}`)) cells.push(cell);
  }
  if (!cells.length) return null;
  map.events = [...(map.events ?? []).filter((event: any) => !cells.some(([x, y]) => event.x === x && event.y === y)), ...cells.map(([x, y]) => lockedEvent(`ev_planted_locked_${x}_${y}`, x, y))];
  const xs = cells.map(cell => cell[0]), ys = cells.map(cell => cell[1]);
  return { project: copy, region: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }, note: `열린 길목 ${cells.length}칸에 안 보이는 «잠긴 집 문» 글 이벤트를 깔았다` };
}
const personEvent = (id: string, x: number, y: number) => ({ id, name: '주민', x, y, trigger: { kind: 'action' }, commands: [], pages: [{ id: `${id}_p0`, name: '주민', conditions: [], graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_people1' }, pattern: 1, direction: 'down' }, trigger: { kind: 'action' }, priority: 'same', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', body: '안녕하세요.' }] }] });
/** 사방이 막힌 칸(지붕·물·벽 한가운데) 세 곳에 사람을 세운다. */
function personOnRoof(project: Project, mapId: string, facts: MapFacts): Planted | null {
  const { project: copy, map } = draft(project, mapId), deep: Array<[number, number]> = [];
  const blocked = (x: number, y: number) => facts.blocked.has(`${x},${y}`);
  for (let y = 2; y < map.height - 2; y += 1) for (let x = 2; x < map.width - 2; x += 1) {
    if (blocked(x, y) && hasObject(map, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([dx, dy]) => blocked(x + dx!, y + dy!))) deep.push([x, y]);
  }
  if (deep.length < 3) return null;
  const picks = [deep[Math.floor(deep.length / 4)]!, deep[Math.floor(deep.length / 2)]!, deep[Math.floor(deep.length * 3 / 4)]!];
  map.events = [...(map.events ?? []), ...picks.map(([x, y], n) => personEvent(`ev_planted_person_${n}`, x, y))];
  const xs = picks.map(pick => pick[0]), ys = picks.map(pick => pick[1]);
  return { project: copy, region: { x: Math.min(...xs), y: Math.min(...ys) - 1, w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 2 }, note: `사방이 막힌 칸 ${picks.map(([x, y]) => `(${x},${y})`).join(' ')} 에 사람을 세웠다` };
}
/** 맵 한가운데 6×5칸을 모든 층에서 비운다 — 안 칠한 구멍. */
function unpaintedHole(project: Project, mapId: string): Planted | null {
  const { project: copy, map } = draft(project, mapId);
  if (map.width < 12 || map.height < 10) return null;
  const rect = { x: Math.floor(map.width / 2) - 3, y: Math.floor(map.height / 2) - 2, w: 6, h: 5 };
  for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) {
    for (const layer of LAYERS) if (Array.isArray(map[layer])) map[layer][index(map, x, y)] = layer === 'shadowBits' ? 0 : -1;
    for (const stacks of STACKS) if (map[stacks]) delete map[stacks][index(map, x, y)];
  }
  map.events = (map.events ?? []).filter((event: any) => !(event.x >= rect.x && event.x < rect.x + rect.w && event.y >= rect.y && event.y < rect.y + rect.h));
  return { project: copy, region: rect, note: `(${rect.x},${rect.y}) 의 6×5칸을 모든 층에서 비웠다` };
}
/** 넓게 열린 가장자리(길이 아닌 맨땅) 한가운데에 안 보이는 출구를 놓는다. 가장 좁은 열린 구간(길 끝)에는 출구가 없다. */
function exitOnBareEdge(project: Project, mapId: string, facts: MapFacts): Planted | null {
  const wide = [...facts.openEdges].filter(run => run.to - run.from + 1 >= 12 && !run.hasExit).sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
  if (!wide) return null;
  const { project: copy, map } = draft(project, mapId), i = Math.floor((wide.from + wide.to) / 2) + Math.floor((wide.to - wide.from) / 3);
  const [x, y] = wide.edge === 'north' ? [i, 0] : wide.edge === 'south' ? [i, map.height - 1] : wide.edge === 'west' ? [0, i] : [map.width - 1, i];
  map.events = [...(map.events ?? []), { id: 'ev_planted_exit', name: 'ev_world_gate_planted', x, y, trigger: { kind: 'playerTouch' }, commands: [], pages: [{ id: 'ev_planted_exit_p0', name: 'ev_world_gate_planted', conditions: [], graphic: { transparent: true }, trigger: { kind: 'playerTouch' }, priority: 'below', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'transfer', mapId, x: 1, y: 1, fade: 'black' }] }] }];
  (copy as any).maps.map_planted_next = { ...structuredClone(map), id: 'map_planted_next', name: '다음 지역', events: [] };
  map.events.at(-1).pages[0].commands[0].mapId = 'map_planted_next';
  return { project: copy, region: { x: Math.max(0, x - 1), y: Math.max(0, y - 1), w: 3, h: 3 }, note: `넓게 열린 ${wide.edge} 가장자리의 (${x},${y}) 맨땅에 안 보이는 출구를 놓았다` };
}

/** 조리법을 그 맵에 쓴다. 그 맵에 맞지 않으면 null(예: 열린 가장자리가 없는 방에 «길목 막기»). */
export function plant(recipe: Recipe, project: Project, mapId: string, facts: MapFacts): Planted | null {
  switch (recipe) {
    case 'strip-furniture': return stripFurniture(project, mapId);
    case 'shift-objects': return shiftObjects(project, mapId);
    case 'stamp-6x': return stampSix(project, mapId);
    case 'wall-off': return wallOff(project, mapId, facts);
    case 'locked-text-on-way': return lockedTextOnWay(project, mapId, facts);
    case 'person-on-roof': return personOnRoof(project, mapId, facts);
    case 'unpainted-hole': return unpaintedHole(project, mapId);
    case 'exit-on-bare-edge': return exitOnBareEdge(project, mapId, facts);
  }
}

const intersects = (a: Rect, b: Rect, grow = 2): boolean => a.x - grow < b.x + b.w && b.x < a.x + a.w + grow && a.y - grow < b.y + b.h && b.y < a.y + a.h + grow;
const serious = (defect: Defect): boolean => defect.severity === 'blocker' || defect.severity === 'major';
/** 심은 결함을 잡았나: 엄격 = major 이상 + 그 조리법의 종류 + 심은 자리와 겹침. 느슨 = major 이상 + 겹침(종류 무관). */
export function caught(review: MapReview, classes: string[], region: Rect): { strict: boolean; loose: boolean; by: Defect | null } {
  const near = review.defects.filter(defect => serious(defect) && intersects(defect.region, region));
  const by = near.find(defect => classes.includes(defect.class)) ?? null;
  return { strict: !!by, loose: near.length > 0, by: by ?? near[0] ?? null };
}
