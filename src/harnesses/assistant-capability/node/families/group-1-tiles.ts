import { autotileGroupsForTileset } from '../../../../project/defaults/autotileGroups';
import type { Project } from '../../../../project/types';
import {
  MAP, TILE_LAYERS, blockedCells, changedCells, fail, inside, mapOf, pass, runOn,
  sameExcept, tileAt, withoutTiles,
} from '../matrixNativeSpec';
import { numArg, rectArg, strArg, type Family, type FamilyOutcome } from './types';

/**
 * Group 1, write half: tile and selection-area commands.
 *
 * Every judge here accepts the shapes the editor's own tools produce. `paint_tiles` re-shapes the
 * autotile group around what it paints, so a fill legitimately changes a one-cell ring beyond the
 * request; the judges therefore tolerate that ring but reject any *newly painted material* outside
 * the asked cells, which is what a wrong target or a too-wide brush looks like.
 */

const tilesetOf = (project: Project): any => (project as any).tilesets[(project as any).maps[MAP].tilesetId];
const metaOf = (project: Project, tile: number): any => tilesetOf(project).tileMeta?.[tile];
const tagsOf = (project: Project, tile: number): string[] => {
  const tags = metaOf(project, tile)?.tags;
  return Array.isArray(tags) ? tags.map(String) : [];
};
const labelOf = (project: Project, tile: number): string => String(metaOf(project, tile)?.label ?? '');
const hasTag = (project: Project, tile: number, tag: string): boolean => tile >= 0 && tagsOf(project, tile).includes(tag);
/** A cell counts as the material when any tile layer of that cell carries one of the tags. */
const cellHasAny = (project: Project, x: number, y: number, tags: readonly string[]): boolean =>
  tags.some(tag => TILE_LAYERS.some(layer => hasTag(project, tileAt(project, layer, x, y), tag)));
const cellLabel = (project: Project, x: number, y: number): string =>
  TILE_LAYERS.map(layer => labelOf(project, tileAt(project, layer, x, y))).join('|');

const cellsIn = (rect: { x: number; y: number; w: number; h: number }) =>
  Array.from({ length: rect.w * rect.h }, (_, index) => ({ x: rect.x + (index % rect.w), y: rect.y + Math.floor(index / rect.w) }));
const keyOf = (x: number, y: number) => `${x},${y}`;
/** Chebyshev ring of one cell around every asked cell — the autotile re-shape region. */
const ringOf = (cells: ReadonlyArray<{ x: number; y: number }>): Set<string> => {
  const keys = new Set<string>();
  for (const cell of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.add(keyOf(cell.x + dx, cell.y + dy));
  return keys;
};
const sameCell = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;
const isGround = (project: Project, tile: number): boolean =>
  tile >= 0 && !['tree', 'wall', 'water', 'gate', 'kit7'].some(tag => hasTag(project, tile, tag));

/** Trees placed as one sprite occupy several cells; a "tree count" is therefore a count of touching tree clusters. */
const clusterCount = (cells: ReadonlyArray<{ x: number; y: number }>): number => {
  const left = new Set(cells.map(cell => keyOf(cell.x, cell.y)));
  let count = 0;
  while (left.size) {
    count += 1;
    const [start] = left;
    const queue = [start];
    left.delete(start);
    while (queue.length) {
      const [x, y] = queue.pop()!.split(',').map(Number) as [number, number];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const next = keyOf(x + dx, y + dy);
        if (left.delete(next)) queue.push(next);
      }
    }
  }
  return count;
};

const tileForTag = (project: Project, tag: string): number => {
  const meta = tilesetOf(project).tileMeta ?? {};
  const tiles = Object.keys(meta).map(Number).filter(tile => hasTag(project, tile, tag));
  if (!tiles.length) throw new Error(`fixture 에 ${tag} 태그 타일이 없다`);
  return Math.min(...tiles);
};
const groupTile = (project: Project, groupId: string): number => {
  const group = autotileGroupsForTileset(tilesetOf(project)).find(entry => entry.id === groupId);
  if (!group) throw new Error(`fixture 에 ${groupId} 오토타일 그룹이 없다`);
  return group.memberTileIds[0]!;
};
const coordArg = (args: Record<string, unknown>, key: string): { x: number; y: number } => {
  const value = args[key] as { x?: unknown; y?: unknown } | undefined;
  if (!value || typeof value.x !== 'number' || typeof value.y !== 'number') throw new Error(`family args.${key} must be {x,y}`);
  return { x: value.x, y: value.y };
};

const paintCells = (project: Project, cells: ReadonlyArray<{ x: number; y: number }>, tile: number) =>
  runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile, cells: cells.map(cell => ({ ...cell })) });
const fillRect = (project: Project, rect: { x: number; y: number; w: number; h: number }, material: string) =>
  runOn(project, 'fill_region', { mapId: MAP, x: rect.x, y: rect.y, w: rect.w, h: rect.h, material });


/** Clearing leaves plain ground: the props and structures go, the floor is refilled so no cell is left as a hole. */
const cleared = (project: Project, rect: { x: number; y: number; w: number; h: number }) => {
  const wiped = runOn(project, 'clear_region', { mapId: MAP, x: rect.x, y: rect.y, w: rect.w, h: rect.h, layer: 'both' });
  return fillRect(wiped, rect, '버들항 풀밭');
};

const clearRegion: Family = {
  id: 'clear-region',
  area: 'tiles',
  mode: 'write',
  title: '선택 영역만 비우기',
  variants: [
    { key: 'grove-plain', prompt: '이 5×3 영역만 비워줘.', args: { rect: { x: 1, y: 1, w: 5, h: 3 } }, setup: { select: { x: 1, y: 1, w: 5, h: 3 } } },
    { key: 'grove-polite', prompt: '선택한 4×2 영역의 나무와 잡동사니를 정리해 주세요.', args: { rect: { x: 5, y: 1, w: 4, h: 2 } }, setup: { select: { x: 5, y: 1, w: 4, h: 2 } } },
    { key: 'terse-strip', prompt: '여기 3×1 치워.', args: { rect: { x: 1, y: 4, w: 3, h: 1 } }, setup: { select: { x: 1, y: 4, w: 3, h: 1 } } },
    { key: 'scope-explained', prompt: '선택한 3×4 영역의 소품과 구조물을 모두 걷어 주세요. 영역 밖은 그대로 두세요.', args: { rect: { x: 6, y: 1, w: 3, h: 4 } }, setup: { select: { x: 6, y: 1, w: 3, h: 4 } } },
    { key: 'whole-grove', prompt: '숲 덩이 전체(8×4)를 깨끗하게 정리해줘.', args: { rect: { x: 1, y: 1, w: 8, h: 4 } }, setup: { select: { x: 1, y: 1, w: 8, h: 4 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `영역 ${rect.w}×${rect.h}`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    if (!cells.every(cell => inside(rect, cell.x, cell.y))) return fail(`${label}: 영역 밖 칸이 바뀌었다`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용(이벤트 등)이 바뀌었다`);
    // "비워라" has two valid readings — empty cells (-1) or plain ground — so only leftovers count as failure.
    const props = cellsIn(rect).filter(cell => ['tree', 'wall', 'water', 'gate', 'kit7'].some(tag => cellHasAny(input.after, cell.x, cell.y, [tag])));
    if (props.length) return fail(`${label}: 소품·구조물이 ${props.length}칸 남았다 (예: ${props[0]!.x},${props[0]!.y} 「${cellLabel(input.after, props[0]!.x, props[0]!.y)}」)`);
    const clearedCells = cellsIn(rect).filter(cell => TILE_LAYERS.every(layer => tileAt(input.after, layer, cell.x, cell.y) <= (layer === 'shadowBits' ? 0 : -1)));
    return pass(`${label} 정리 — ${cells.length}칸 변경(빈 칸 ${clearedCells.length}), 소품 0, 이벤트 보존`);
  },
  reference(project, args) {
    return cleared(project, rectArg(args));
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const shifted = cleared(project, { ...rect, x: rect.x + 1 });
    const propsLeft = runOn(cleared(project, rect), 'place_props', {
      mapId: MAP, area: { x: rect.x, y: rect.y, w: 1, h: 1 }, material: '버들항 · 나무·덤불', count: 1, seed: 3,
    });
    const half = runOn(cleared(project, rect), 'place_props', {
      mapId: MAP, area: { x: rect.x + rect.w - 1, y: rect.y, w: 1, h: rect.h }, material: '버들항 · 나무·덤불', count: 1, seed: 5,
    });
    const victim = (mapOf(project).events as any[]).find(event => !inside(rect, event.x, event.y));
    const deleted = runOn(cleared(project, rect), 'remove_event', { mapId: MAP, eventId: victim.id });
    return [shifted, propsLeft, half, deleted];
  },
};

const copied = (project: Project, from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number }) =>
  runOn(project, 'copy_map_region', { from: { mapId: MAP, ...from }, to: { mapId: MAP, ...to }, layers: 'all' });

const copyRegion: Family = {
  id: 'copy-region',
  area: 'tiles',
  mode: 'write',
  title: '영역을 오른쪽으로 복사',
  variants: [
    { key: 'grove-2x2', prompt: '이 영역을 오른쪽으로 2칸 복사해줘.', args: { from: { x: 5, y: 1, w: 3, h: 2 }, to: { x: 13, y: 4 } }, setup: { select: { x: 5, y: 1, w: 3, h: 2 } } },
    { key: 'grove-polite', prompt: '선택한 3×2 영역을 (13,7) 자리에 그대로 복사해 주세요.', args: { from: { x: 5, y: 1, w: 3, h: 2 }, to: { x: 13, y: 7 } }, setup: { select: { x: 5, y: 1, w: 3, h: 2 } } },
    { key: 'terse-2x2', prompt: '이 2×2, (12,6)으로 복사.', args: { from: { x: 1, y: 2, w: 2, h: 2 }, to: { x: 12, y: 6 } }, setup: { select: { x: 1, y: 2, w: 2, h: 2 } } },
    { key: 'scope-explained', prompt: '선택한 4×2 숲 조각을 (14,8)에 화소 그대로 복사하고, 원본은 지우지 마세요.', args: { from: { x: 5, y: 1, w: 4, h: 2 }, to: { x: 14, y: 8 } }, setup: { select: { x: 5, y: 1, w: 4, h: 2 } } },
    { key: 'wide-2x3', prompt: '왼쪽 위 2×3 조각을 (13,13)에 복제해줘.', args: { from: { x: 1, y: 1, w: 2, h: 3 }, to: { x: 13, y: 13 } }, setup: { select: { x: 1, y: 1, w: 2, h: 3 } } },
  ],
  judge(input, args) {
    const from = rectArg(args, 'from');
    const to = coordArg(args, 'to');
    const target = { x: to.x, y: to.y, w: from.w, h: from.h };
    const label = `(${from.x},${from.y}) ${from.w}×${from.h} → (${to.x},${to.y})`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    if (!cells.every(cell => inside(target, cell.x, cell.y))) return fail(`${label}: 목적지 밖 칸이 바뀌었다(원본을 지웠거나 다른 곳을 건드렸다)`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    let differs = 0;
    for (let dy = 0; dy < from.h; dy++) for (let dx = 0; dx < from.w; dx++) for (const layer of TILE_LAYERS) {
      const source = tileAt(input.before, layer, from.x + dx, from.y + dy);
      const written = tileAt(input.after, layer, to.x + dx, to.y + dy);
      if (written !== source) return fail(`${label}: 복사된 칸 (${to.x + dx},${to.y + dy}) 의 ${layer} 이 원본과 다르다`);
      if (source !== tileAt(input.before, layer, to.x + dx, to.y + dy)) differs += 1;
    }
    if (!differs) return fail(`${label}: 목적지가 이미 원본과 같아 아무것도 복사되지 않았다`);
    return pass(`${label}: ${differs}개 타일 값이 원본과 같아짐`);
  },
  reference(project, args) {
    return copied(project, rectArg(args, 'from'), coordArg(args, 'to'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const from = rectArg(args, 'from');
    const to = coordArg(args, 'to');
    const shifted = copied(project, from, { x: to.x + 2, y: to.y });
    const moved = runOn(copied(project, from, to), 'clear_region', { mapId: MAP, x: from.x, y: from.y, w: from.w, h: from.h, layer: 'both' });
    const partial = copied(project, { ...from, w: 1 }, to);
    const overPainted = runOn(copied(project, from, to), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: tileForTag(project, 'road'), cells: [{ x: to.x, y: to.y }],
    });
    return [shifted, moved, partial, overPainted];
  },
};


const mirrored = (project: Project, rect: { x: number; y: number; w: number; h: number }, axis: 'horizontal' | 'vertical') =>
  runOn(project, 'mirror_region', { mapId: MAP, x: rect.x, y: rect.y, w: rect.w, h: rect.h, axis });

const mirrorRegion: Family = {
  id: 'mirror-region',
  area: 'tiles',
  mode: 'write',
  title: '선택 영역 좌우 뒤집기',
  variants: [
    { key: 'grove-4x2', prompt: '선택 영역을 좌우로 뒤집어줘.', args: { rect: { x: 2, y: 2, w: 4, h: 2 } }, setup: { select: { x: 2, y: 2, w: 4, h: 2 } } },
    { key: 'grove-polite', prompt: '선택한 6×2 영역을 가로로 반전해 주세요.', args: { rect: { x: 1, y: 2, w: 6, h: 2 } }, setup: { select: { x: 1, y: 2, w: 6, h: 2 } } },
    { key: 'terse-3x3', prompt: '여기 3×3 좌우 반전.', args: { rect: { x: 5, y: 1, w: 3, h: 3 } }, setup: { select: { x: 5, y: 1, w: 3, h: 3 } } },
    { key: 'scope-explained', prompt: '선택한 4×3 영역을 좌우 거울상으로 만들고, 상하는 그대로 두세요. 영역 밖은 건드리지 마세요.', args: { rect: { x: 1, y: 1, w: 4, h: 3 } }, setup: { select: { x: 1, y: 1, w: 4, h: 3 } } },
    { key: 'wide-7x2', prompt: '숲 조각 7×2를 왼쪽 기준으로 뒤집어줘.', args: { rect: { x: 1, y: 3, w: 7, h: 2 } }, setup: { select: { x: 1, y: 3, w: 7, h: 2 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `영역 ${rect.w}×${rect.h} 좌우 반전`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    if (!cells.every(cell => inside(rect, cell.x, cell.y))) return fail(`${label}: 영역 밖 칸이 바뀌었다`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    for (let dy = 0; dy < rect.h; dy++) for (let dx = 0; dx < rect.w; dx++) {
      const mirrorX = rect.x + rect.w - 1 - dx;
      for (const layer of TILE_LAYERS) {
        if (tileAt(input.after, layer, rect.x + dx, rect.y + dy) !== tileAt(input.before, layer, mirrorX, rect.y + dy)) {
          return fail(`${label}: (${rect.x + dx},${rect.y + dy}) 이 원본의 좌우 거울상이 아니다(상하 반전·회전 의심)`);
        }
      }
    }
    return pass(`${label}: ${cells.length}칸이 거울상과 일치`);
  },
  reference(project, args) {
    return mirrored(project, rectArg(args), 'horizontal');
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const flippedVertically = mirrored(project, rect, 'vertical');
    const shifted = mirrored(project, { ...rect, x: rect.x + 1 }, 'horizontal');
    const unmirrored = paintCells(project, [cellsIn(rect)[0]!], tileForTag(project, 'road'));
    const sideEffect = runOn(mirrored(project, rect, 'horizontal'), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: tileForTag(project, 'road'), cells: [{ x: 12, y: 5 }],
    });
    return [flippedVertically, shifted, unmirrored, sideEffect];
  },
};


const placeTrees = (project: Project, area: { x: number; y: number; w: number; h: number }, count: number) =>
  runOn(project, 'place_props', { mapId: MAP, area, material: '버들항 · 나무·덤불', count, seed: 7 });

const treeCells = (project: Project, cells: ReadonlyArray<{ x: number; y: number }>) =>
  cells.filter(cell => cellHasAny(project, cell.x, cell.y, ['tree']));

const treeCount = (before: Project, after: Project, cells: ReadonlyArray<{ x: number; y: number }>) => {
  const added = treeCells(after, cells).filter(cell => !cellHasAny(before, cell.x, cell.y, ['tree']));
  return { cells: added.length, clusters: clusterCount(added) };
};

const placeTreesFamily: Family = {
  id: 'place-trees',
  area: 'tiles',
  mode: 'write',
  title: '선택 영역에 나무 세 그루',
  variants: [
    { key: 'meadow-three', prompt: '여기에 나무 세 그루를 놓아줘.', args: { area: { x: 14, y: 2, w: 6, h: 1 }, count: 3 }, setup: { select: { x: 14, y: 2, w: 6, h: 1 } } },
    { key: 'meadow-polite', prompt: '선택한 5×2 빈 풀밭에 나무 3그루를 심어 주세요.', args: { area: { x: 14, y: 2, w: 5, h: 2 }, count: 3 }, setup: { select: { x: 14, y: 2, w: 5, h: 2 } } },
    { key: 'terse-four', prompt: '여기 나무 네 그루.', args: { area: { x: 15, y: 2, w: 4, h: 2 }, count: 4 }, setup: { select: { x: 15, y: 2, w: 4, h: 2 } } },
    { key: 'scope-explained', prompt: '선택한 3×3 빈터에 나무를 정확히 두 그루만 놓아 주세요. 영역 밖 칸은 그대로 두세요.', args: { area: { x: 18, y: 3, w: 3, h: 3 }, count: 2 }, setup: { select: { x: 18, y: 3, w: 3, h: 3 } } },
    { key: 'south-meadow', prompt: '아래쪽 빈 풀밭(16,6) 4×2 에 나무 다섯 그루를 놓아줘.', args: { area: { x: 16, y: 6, w: 4, h: 2 }, count: 5 }, setup: { select: { x: 16, y: 6, w: 4, h: 2 } } },
  ],
  judge(input, args) {
    const area = rectArg(args, 'area');
    const count = numArg(args, 'count');
    const label = `영역 ${area.w}×${area.h} 나무 ${count}그루`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    if (!cells.every(cell => inside(area, cell.x, cell.y))) return fail(`${label}: 선택 영역 밖 칸이 바뀌었다`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    const clutter = cells.filter(cell => ['wall', 'water', 'gate'].some(tag => cellHasAny(input.after, cell.x, cell.y, [tag])));
    if (clutter.length) return fail(`${label}: 나무가 아닌 구조물·물 타일 ${clutter.length}칸 (예: ${clutter[0]!.x},${clutter[0]!.y})`);
    const trees = treeCount(input.before, input.after, cells);
    if (!trees.cells) return fail(`${label}: 새로 놓인 나무가 없다`);
    // One tree sprite may cover a couple of cells; then the trees are counted as touching groups.
    if (trees.cells !== count && trees.clusters !== count) return fail(`${label}: 나무 ${trees.cells}칸/${trees.clusters}그루(요청 ${count}그루)`);
    return pass(`${label}: 나무 ${trees.cells}칸 배치`);
  },
  reference(project, args) {
    return placeTrees(project, rectArg(args, 'area'), numArg(args, 'count'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const area = rectArg(args, 'area');
    const count = numArg(args, 'count');
    const outside = placeTrees(project, { ...area, x: area.x - 4 }, count);
    const partial = placeTrees(project, area, 1);
    const grassInstead = paintCells(project, cellsIn(area), tileForTag(project, 'grass'));
    const withWall = runOn(placeTrees(project, area, count), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: tileForTag(project, 'wall'), cells: [{ x: area.x, y: area.y }],
    });
    return [outside, partial, grassInstead, withWall];
  },
};


const placeWell = (project: Project, area: { x: number; y: number; w: number; h: number }) =>
  runOn(project, 'place_props', { mapId: MAP, area, material: '버들항 장소 · 우물', count: 1, seed: 2 });

const isWellCell = (project: Project, x: number, y: number) => /우물/u.test(cellLabel(project, x, y));

const placeWellFamily: Family = {
  id: 'place-well',
  area: 'tiles',
  mode: 'write',
  title: '빈 공간에 우물 배치',
  variants: [
    { key: 'meadow-plain', prompt: '이 빈 공간에 작은 우물을 배치해줘.', args: { area: { x: 15, y: 3, w: 3, h: 3 } }, setup: { select: { x: 15, y: 3, w: 3, h: 3 } } },
    { key: 'meadow-polite', prompt: '선택한 4×3 빈터 한가운데에 우물을 놓아 주세요.', args: { area: { x: 13, y: 2, w: 4, h: 3 } }, setup: { select: { x: 13, y: 2, w: 4, h: 3 } } },
    { key: 'terse-well', prompt: '여기 우물 하나.', args: { area: { x: 19, y: 3, w: 3, h: 3 } }, setup: { select: { x: 19, y: 3, w: 3, h: 3 } } },
    { key: 'scope-explained', prompt: '선택한 5×2 영역 안에만 우물을 세워 주세요. 영역 밖은 그대로 두세요.', args: { area: { x: 13, y: 6, w: 5, h: 2 } }, setup: { select: { x: 13, y: 6, w: 5, h: 2 } } },
    { key: 'south-well', prompt: '아래쪽(17,12) 4×2 자리에 우물을 놓아줘.', args: { area: { x: 17, y: 12, w: 4, h: 2 } }, setup: { select: { x: 17, y: 12, w: 4, h: 2 } } },
  ],
  judge(input, args) {
    const area = rectArg(args, 'area');
    const label = `영역 ${area.w}×${area.h} 우물`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    if (!cells.every(cell => inside(area, cell.x, cell.y))) return fail(`${label}: 선택 영역 밖 칸이 바뀌었다`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    const well = cells.filter(cell => isWellCell(input.after, cell.x, cell.y));
    if (!well.length) return fail(`${label}: 우물 타일이 없다`);
    return pass(`${label}: 우물 ${well.length}칸 (${well[0]!.x},${well[0]!.y})`);
  },
  reference(project, args) {
    return placeWell(project, rectArg(args, 'area'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const area = rectArg(args, 'area');
    const outside = placeWell(project, { ...area, x: area.x > area.w + 1 ? area.x - area.w - 2 : area.x + area.w + 2 });
    const withExtra = runOn(placeWell(project, area), 'place_props', {
      mapId: MAP, area: { x: 12, y: 8, w: 1, h: 1 }, material: '버들항 · 나무·덤불', count: 1, seed: 1,
    });
    const noWell = fillRect(project, area, '버들항 모랫길');
    const wallInstead = paintCells(project, [{ x: area.x, y: area.y }], tileForTag(project, 'wall'));
    return [outside, withExtra, noWell, wallInstead];
  },
};


const forestPath = (project: Project, rect: { x: number; y: number; w: number; h: number }, material: string) => fillRect(project, rect, material);

const forestPathFamily: Family = {
  id: 'forest-path',
  area: 'tiles',
  mode: 'write',
  title: '지역에 숲길 추가',
  variants: [
    { key: 'trail-plain', prompt: '이 지역에 작은 숲길을 하나 추가해줘.', args: { rect: { x: 2, y: 15, w: 10, h: 1 }, material: '버들항 모랫길', tag: 'sand' }, setup: { select: { x: 2, y: 15, w: 10, h: 1 } } },
    { key: 'trail-polite', prompt: '선택한 8×2 영역에 흙길을 깔아 주세요.', args: { rect: { x: 2, y: 15, w: 8, h: 2 }, material: '버들항 모랫길', tag: 'sand' }, setup: { select: { x: 2, y: 15, w: 8, h: 2 } } },
    { key: 'terse-stone', prompt: '여기 6×1 돌길.', args: { rect: { x: 4, y: 7, w: 6, h: 1 }, material: '버들항 길 포석', tag: 'road' }, setup: { select: { x: 4, y: 7, w: 6, h: 1 } } },
    { key: 'scope-explained', prompt: '선택한 5×3 영역에 숲길을 내되 바닥이 비는 칸(구멍) 없이 이어 주세요. 영역 밖은 건드리지 마세요.', args: { rect: { x: 15, y: 15, w: 5, h: 3 }, material: '버들항 모랫길', tag: 'sand' }, setup: { select: { x: 15, y: 15, w: 5, h: 3 } } },
    { key: 'farm-lane', prompt: '밭 옆으로 7×1 흙길을 내줘.', args: { rect: { x: 13, y: 11, w: 7, h: 1 }, material: '버들항 모랫길', tag: 'sand' }, setup: { select: { x: 13, y: 11, w: 7, h: 1 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `영역 ${rect.w}×${rect.h} 숲길`;
    const tag = strArg(args, 'tag');
    const cells = changedCells(input.before, input.after);
    if (cells.length < 4) return fail(`${label}: 바뀐 칸이 ${cells.length}개뿐이다`);
    const ring = ringOf(cellsIn(rect));
    const stray = cells.filter(cell => !ring.has(keyOf(cell.x, cell.y)));
    if (stray.length) return fail(`${label}: 선택 영역 밖 먼 칸 ${stray.length}개가 바뀌었다 (예: ${stray[0]!.x},${stray[0]!.y})`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    const holes = cells.filter(cell => tileAt(input.before, 'lowerTiles', cell.x, cell.y) > 0 && tileAt(input.after, 'lowerTiles', cell.x, cell.y) <= 0);
    if (holes.length) return fail(`${label}: 바닥이 빈 구멍 칸 ${holes.length}개`);
    const blocked = cells.filter(cell => !isGround(input.after, tileAt(input.after, 'lowerTiles', cell.x, cell.y)));
    if (blocked.length) return fail(`${label}: 길이 아닌(막힌) 타일 ${blocked.length}칸 (예: ${blocked[0]!.x},${blocked[0]!.y} 「${labelOf(input.after, tileAt(input.after, 'lowerTiles', blocked[0]!.x, blocked[0]!.y))}」)`);
    const offMaterial = cellsIn(rect).filter(cell => !cellHasAny(input.after, cell.x, cell.y, [tag]));
    if (offMaterial.length) return fail(`${label}: ${tag} 길이 아닌 칸 ${offMaterial.length}개 (예: ${offMaterial[0]!.x},${offMaterial[0]!.y} 「${cellLabel(input.after, offMaterial[0]!.x, offMaterial[0]!.y)}」)`);
    return pass(`${label}: ${cells.length}칸 ${tag} 길, 구멍·막힌 칸 없음`);
  },
  reference(project, args) {
    return forestPath(project, rectArg(args), strArg(args, 'material'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const material = strArg(args, 'material');
    const stray = runOn(forestPath(project, rect, material), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: groupTile(project, 'beodeul_road_autotile'), cells: [{ x: rect.x + rect.w + 2, y: rect.y }],
    });
    const holes = runOn(project, 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: -1, cells: cellsIn(rect).slice(0, 3),
    });
    const partial = fillRect(project, { ...rect, w: 1 }, material);
    const grassInstead = fillRect(project, rect, '버들항 풀밭');
    return [stray, holes, partial, grassInstead];
  },
};


const moveStart = (project: Project, x: number, y: number, mapId = MAP) => runOn(project, 'set_start_position', { mapId, x, y });

const moveStartFamily: Family = {
  id: 'move-start',
  area: 'maps',
  mode: 'write',
  title: '시작 위치 이동',
  variants: [
    { key: 'here-plain', prompt: '시작 위치를 여기로 옮겨줘.', args: { x: 9, y: 8 }, setup: { select: { x: 9, y: 8, w: 1, h: 1 } } },
    { key: 'here-polite', prompt: '시작 지점을 (11, 9) 로 옮겨 주세요.', args: { x: 11, y: 9 }, setup: { select: { x: 11, y: 9, w: 1, h: 1 } } },
    { key: 'terse-cell', prompt: '시작 (4,4)로.', args: { x: 4, y: 4 }, setup: { select: { x: 4, y: 4, w: 1, h: 1 } } },
    { key: 'scope-explained', prompt: '게임 시작 위치를 마을 맵의 (14,13) 칸으로 바꿔 주세요. 다른 맵 설정은 그대로 두세요.', args: { x: 14, y: 13 }, setup: { select: { x: 14, y: 13, w: 1, h: 1 } } },
    { key: 'south-cell', prompt: '시작점을 아래쪽 (12,15) 로 내려줘.', args: { x: 12, y: 15 }, setup: { select: { x: 12, y: 15, w: 1, h: 1 } } },
  ],
  judge(input, args) {
    const want = { x: numArg(args, 'x'), y: numArg(args, 'y') };
    const start = (input.after as any).startPos;
    const label = `시작 위치 (${want.x},${want.y})`;
    if (!(start?.x === want.x && start?.y === want.y)) return fail(`${label}: 시작 위치가 (${start?.x},${start?.y}) 이다`);
    if ((input.after as any).startMapId !== (input.before as any).startMapId) return fail(`${label}: 시작 맵까지 바뀌었다`);
    return sameExcept(input.before, input.after, doc => { delete doc.startPos; delete doc.startMapId; })
      ? pass(`${label} 로 이동, 다른 필드 보존`) : fail(`${label}: 시작 위치 밖 내용이 바뀌었다`);
  },
  reference(project, args) {
    return moveStart(project, numArg(args, 'x'), numArg(args, 'y'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const shifted = moveStart(project, x + 2, y);
    const otherMap = moveStart(project, 2, 2, 'map_plaza');
    const withMapEdit = runOn(moveStart(project, x, y), 'set_map_properties', { mapId: MAP, name: '잿불 마을 (수정)' });
    const unchanged = runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: tileForTag(project, 'road'), cells: [{ x, y }] });
    return [shifted, otherMap, withMapEdit, unchanged];
  },
};


const MATERIAL_FOR_TAG: Record<string, string> = { sand: '버들항 모랫길', road: '버들항 길 포석', grass: '버들항 풀밭' };

/** The cells the correct tools touch for this selection: autotile reshaping and companion tiles included. */
const allowedFootprint = (project: Project, cells: ReadonlyArray<{ x: number; y: number }>, tag: string): Set<string> => {
  const allowed = new Set(changedCells(project, paintCells(project, cells, tileForTag(project, tag))).map(cell => keyOf(cell.x, cell.y)));
  const xs = cells.map(cell => cell.x), ys = cells.map(cell => cell.y);
  const bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  if (cells.length === bbox.w * bbox.h && MATERIAL_FOR_TAG[tag]) {
    for (const cell of changedCells(project, fillRect(project, bbox, MATERIAL_FOR_TAG[tag]))) allowed.add(keyOf(cell.x, cell.y));
  }
  return allowed;
};

const selectionJudge = (input: any, cells: ReadonlyArray<{ x: number; y: number }>, tag: string, label: string) => {
  const changed = changedCells(input.before, input.after);
  if (!changed.length) return fail(`${label}: 바뀐 칸이 없다`);
  const allowed = allowedFootprint(input.before, cells, tag);
  const stray = changed.filter(cell => !allowed.has(keyOf(cell.x, cell.y)));
  if (stray.length) return fail(`${label}: 선택 밖 칸 ${stray.length}개가 바뀌었다 (예: ${stray[0]!.x},${stray[0]!.y})`);
  const missing = cells.filter(cell => !cellHasAny(input.after, cell.x, cell.y, [tag]));
  if (missing.length) return fail(`${label}: 선택 칸 ${missing.length}개가 요청한 재료로 바뀌지 않았다 (예: ${missing[0]!.x},${missing[0]!.y} 「${cellLabel(input.after, missing[0]!.x, missing[0]!.y)}」)`);
  if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
  return pass(`${label}: 선택 ${cells.length}칸 칠함`);
};

const selectionSingleCell: Family = {
  id: 'selection-single-cell',
  area: 'tiles',
  mode: 'write',
  title: '한 칸만 칠하기',
  variants: [
    { key: 'plain', prompt: '선택한 한 칸만 길 포석으로 바꿔줘.', args: { cell: { x: 20, y: 16 }, tag: 'road' }, setup: { select: { x: 20, y: 16, w: 1, h: 1 } } },
    { key: 'polite', prompt: '이 한 칸에 돌바닥을 깔아 주세요.', args: { cell: { x: 6, y: 16 }, tag: 'road' }, setup: { select: { x: 6, y: 16, w: 1, h: 1 } } },
    { key: 'terse', prompt: '여기 한 칸, 모래.', args: { cell: { x: 9, y: 13 }, tag: 'sand' }, setup: { select: { x: 9, y: 13, w: 1, h: 1 } } },
    { key: 'scope-explained', prompt: '정확히 선택한 한 칸만 풀밭으로 바꾸고 옆 칸은 그대로 두세요.', args: { cell: { x: 4, y: 14 }, tag: 'grass' }, setup: { select: { x: 4, y: 14, w: 1, h: 1 } } },
    { key: 'sand-cell', prompt: '그 칸(2,16) 하나만 모랫길로.', args: { cell: { x: 2, y: 16 }, tag: 'sand' }, setup: { select: { x: 2, y: 16, w: 1, h: 1 } } },
  ],
  judge(input, args) {
    const cell = coordArg(args, 'cell');
    const tag = strArg(args, 'tag');
    const label = `한 칸 (${cell.x},${cell.y})`;
    return selectionJudge(input, [cell], tag, label);
  },
  reference(project, args) {
    const cell = coordArg(args, 'cell');
    return paintCells(project, [cell], tileForTag(project, strArg(args, 'tag')));
  },
  wrongs(project, args): FamilyOutcome[] {
    const cell = coordArg(args, 'cell');
    const tag = strArg(args, 'tag');
    const tile = tileForTag(project, tag);
    const neighbour = paintCells(project, [{ x: cell.x + 1, y: cell.y }], tile);
    const twoCells = paintCells(project, [cell, { x: cell.x, y: cell.y + 1 }], tile);
    const sideEffect = runOn(paintCells(project, [cell], tile), 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile, cells: [{ x: 12, y: 4 }] });
    const wrongMaterial = paintCells(project, [cell], tileForTag(project, tag === 'sand' ? 'road' : 'sand'));
    return [neighbour, twoCells, sideEffect, wrongMaterial];
  },
};

const stripCells = (rect: { x: number; y: number; w: number; h: number }) => cellsIn(rect);

const selectionColumn: Family = {
  id: 'selection-column-strip',
  area: 'tiles',
  mode: 'write',
  title: '세로 띠만 칠하기',
  variants: [
    { key: 'plain-1x5', prompt: '선택한 세로 한 줄만 길 포석으로 칠해줘.', args: { rect: { x: 20, y: 12, w: 1, h: 5 }, tag: 'road' }, setup: { select: { x: 20, y: 12, w: 1, h: 5 } } },
    { key: 'polite-1x4', prompt: '선택한 1×4 세로 띠에 돌바닥을 깔아 주세요.', args: { rect: { x: 4, y: 12, w: 1, h: 4 }, tag: 'road' }, setup: { select: { x: 4, y: 12, w: 1, h: 4 } } },
    { key: 'terse-1x3', prompt: '이 세로 3칸, 모래로.', args: { rect: { x: 9, y: 12, w: 1, h: 3 }, tag: 'sand' }, setup: { select: { x: 9, y: 12, w: 1, h: 3 } } },
    { key: 'scope-explained', prompt: '선택한 1×6 세로 띠만 흙길로 바꾸고 옆 칸은 그대로 두세요.', args: { rect: { x: 19, y: 3, w: 1, h: 6 }, tag: 'sand' }, setup: { select: { x: 19, y: 3, w: 1, h: 6 } } },
    { key: 'road-1x5', prompt: '아래쪽 세로 5칸(6,12)을 길로 내줘.', args: { rect: { x: 6, y: 12, w: 1, h: 5 }, tag: 'road' }, setup: { select: { x: 6, y: 12, w: 1, h: 5 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    return selectionJudge(input, stripCells(rect), strArg(args, 'tag'), `세로 띠 ${rect.w}×${rect.h}(${rect.x},${rect.y})`);
  },
  reference(project, args) {
    const rect = rectArg(args);
    return paintCells(project, stripCells(rect), tileForTag(project, strArg(args, 'tag')));
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const tag = strArg(args, 'tag');
    const tile = tileForTag(project, tag);
    const shifted = paintCells(project, cellsIn({ ...rect, x: rect.x + 1 }), tile);
    const tooWide = paintCells(project, cellsIn({ ...rect, w: 2 }), tile);
    const half = paintCells(project, cellsIn({ ...rect, h: Math.max(1, rect.h - 2) }), tile);
    const stray = runOn(paintCells(project, cellsIn(rect), tile), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile, cells: [{ x: rect.x + 4, y: rect.y }],
    });
    return [shifted, tooWide, half, stray];
  },
};

const selectionL: Family = {
  id: 'selection-l-shaped',
  area: 'tiles',
  mode: 'write',
  title: 'L자 선택 칸만 칠하기',
  variants: [
    {
      key: 'plain', prompt: '선택한 L자 모양 칸만 길 포석으로 칠해줘.',
      args: { cells: [{ x: 15, y: 8 }, { x: 15, y: 9 }, { x: 15, y: 10 }, { x: 15, y: 11 }, { x: 16, y: 11 }, { x: 17, y: 11 }, { x: 18, y: 11 }], tag: 'road' },
      setup: { select: { x: 15, y: 8, w: 4, h: 4 } },
    },
    {
      key: 'polite', prompt: '선택 영역 중 L자로 잡힌 5칸에만 돌바닥을 깔아 주세요.',
      args: { cells: [{ x: 20, y: 3 }, { x: 20, y: 4 }, { x: 20, y: 5 }, { x: 21, y: 5 }, { x: 22, y: 5 }], tag: 'road' },
      setup: { select: { x: 20, y: 3, w: 3, h: 3 } },
    },
    {
      key: 'terse', prompt: '이 L자 6칸만 모래로.',
      args: { cells: [{ x: 3, y: 7 }, { x: 3, y: 8 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }], tag: 'sand' },
      setup: { select: { x: 3, y: 7, w: 4, h: 3 } },
    },
    {
      key: 'scope-explained', prompt: '선택한 L자 칸만 흙길로 바꿔 주세요. L자 바깥(같은 사각형 안의 나머지 칸)은 그대로 두세요.',
      args: { cells: [{ x: 8, y: 12 }, { x: 9, y: 12 }, { x: 10, y: 12 }, { x: 11, y: 12 }, { x: 11, y: 13 }, { x: 11, y: 14 }, { x: 11, y: 15 }], tag: 'sand' },
      setup: { select: { x: 8, y: 12, w: 4, h: 4 } },
    },
    {
      key: 'wide', prompt: 'L자로 8칸(15,12)~(18,13)만 길로 깔아줘.',
      args: { cells: [{ x: 15, y: 12 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 18, y: 13 }, { x: 18, y: 12 }, { x: 19, y: 13 }, { x: 20, y: 13 }], tag: 'road' },
      setup: { select: { x: 15, y: 12, w: 6, h: 2 } },
    },
  ],
  judge(input, args) {
    const raw = args.cells;
    if (!Array.isArray(raw) || !raw.length) throw new Error('family args.cells must be a non-empty array');
    const cells = raw.map(cell => ({ x: Number((cell as any).x), y: Number((cell as any).y) }));
    return selectionJudge(input, cells, strArg(args, 'tag'), `L자 ${cells.length}칸`);
  },
  reference(project, args) {
    const cells = (args.cells as Array<{ x: number; y: number }>).map(cell => ({ x: cell.x, y: cell.y }));
    return paintCells(project, cells, tileForTag(project, strArg(args, 'tag')));
  },
  wrongs(project, args): FamilyOutcome[] {
    const cells = (args.cells as Array<{ x: number; y: number }>).map(cell => ({ x: cell.x, y: cell.y }));
    const tag = strArg(args, 'tag');
    const tile = tileForTag(project, tag);
    const xs = cells.map(cell => cell.x), ys = cells.map(cell => cell.y);
    const bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
    const bboxFill = paintCells(project, cellsIn(bbox), tile);
    const shifted = paintCells(project, cells.map(cell => ({ x: cell.x + 1, y: cell.y })), tile);
    const partial = paintCells(project, cells.slice(0, Math.max(1, cells.length - 2)), tile);
    const stray = runOn(paintCells(project, cells, tile), 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile, cells: [{ x: bbox.x, y: bbox.y + bbox.h + 2 }] });
    return [bboxFill, shifted, partial, stray];
  },
};

const selectionWholeMap: Family = {
  id: 'selection-whole-map',
  area: 'tiles',
  mode: 'write',
  title: '맵 전체 칠하기',
  variants: [
    { key: 'sand-all', prompt: '맵 전체 바닥을 모랫길로 다 바꿔줘.', args: { tag: 'sand', material: '버들항 모랫길', tag: 'sand' } },
    { key: 'sand-polite', prompt: '이 맵 전체를 흙바닥으로 깔아 주세요. 이벤트는 지우지 마세요.', args: { tag: 'sand', material: '버들항 모랫길', tag: 'sand' } },
    { key: 'terse', prompt: '맵 전체, 모래.', args: { tag: 'sand', material: '버들항 모랫길', tag: 'sand' } },
    { key: 'road-explained', prompt: '맵의 모든 칸을 길 포석으로 통일하고, 이벤트·건물은 그대로 두세요.', args: { tag: 'road', material: '버들항 길 포석' } },
    { key: 'sand-events', prompt: '마을 바닥 전부를 모랫길로 갈아줘. 출입구 이벤트는 남겨.', args: { tag: 'sand', material: '버들항 모랫길', tag: 'sand' } },
  ],
  judge(input, args) {
    const tag = strArg(args, 'tag');
    const map = mapOf(input.after);
    const label = '맵 전체';
    const missing: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (!cellHasAny(input.after, x, y, [tag])) missing.push({ x, y });
    if (missing.length) return fail(`${label}: ${missing.length}/${map.width * map.height}칸이 요청한 재료가 아니다 (예: ${missing[0]!.x},${missing[0]!.y} 「${cellLabel(input.after, missing[0]!.x, missing[0]!.y)}」)`);
    const before = mapOf(input.before).events.map((event: any) => event.id).sort();
    const after = map.events.map((event: any) => event.id).sort();
    if (JSON.stringify(before) !== JSON.stringify(after)) return fail(`${label}: 이벤트가 사라지거나 늘었다(${before.length} → ${after.length})`);
    return sameExcept(input.before, input.after, withoutTiles) ? pass(`${label} ${map.width * map.height}칸 칠함, 이벤트 ${after.length}개 보존`) : fail(`${label}: 타일 밖 내용이 바뀌었다`);
  },
  reference(project, args) {
    const map = mapOf(project);
    return fillRect(project, { x: 0, y: 0, w: map.width, h: map.height }, strArg(args, 'material'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const map = mapOf(project);
    const material = strArg(args, 'material');
    const half = fillRect(project, { x: 0, y: 0, w: map.width, h: Math.floor(map.height / 2) }, material);
    const wrongMaterial = fillRect(project, { x: 0, y: 0, w: map.width, h: map.height }, '버들항 풀밭');
    const whole = fillRect(project, { x: 0, y: 0, w: map.width, h: map.height }, material);
    const offByOne = fillRect(project, { x: 1, y: 1, w: map.width - 1, h: map.height - 1 }, material);
    const oneEvent = runOn(whole, 'remove_event', { mapId: MAP, eventId: (map.events as any[])[0].id });
    return [half, wrongMaterial, offByOne, oneEvent];
  },
};


const chainBoth = (project: Project, area: { x: number; y: number; w: number; h: number }, count: number) => {
  const floored = fillRect(project, area, '버들항 모랫길');
  return placeTrees(floored, area, count);
};

const chainPaintThenPlace: Family = {
  id: 'chain-paint-then-place',
  area: 'tiles',
  mode: 'write',
  title: '바닥 칠하고 그 위에 소품',
  variants: [
    { key: 'plain', prompt: '이 영역 바닥을 흙으로 깔고 그 위에 나무 세 그루를 놓아줘.', args: { area: { x: 14, y: 2, w: 5, h: 4 }, count: 3 }, setup: { select: { x: 14, y: 2, w: 5, h: 4 } } },
    { key: 'polite', prompt: '선택한 4×4 영역을 흙길로 깐 다음, 그 안에 나무 4그루를 심어 주세요.', args: { area: { x: 13, y: 12, w: 4, h: 4 }, count: 4 }, setup: { select: { x: 13, y: 12, w: 4, h: 4 } } },
    { key: 'terse', prompt: '여기 흙 깔고 나무 2그루.', args: { area: { x: 18, y: 2, w: 4, h: 3 }, count: 2 }, setup: { select: { x: 18, y: 2, w: 4, h: 3 } } },
    { key: 'scope-explained', prompt: '선택한 4×3 영역 바닥을 모랫길로 바꾸고, 그 위에 나무를 3그루 놓아 주세요. 영역 밖은 그대로 두세요.', args: { area: { x: 2, y: 12, w: 4, h: 3 }, count: 3 }, setup: { select: { x: 2, y: 12, w: 4, h: 3 } } },
    { key: 'wide', prompt: '마당(15,6) 5×3을 흙으로 다지고 나무 다섯 그루를 세워줘.', args: { area: { x: 15, y: 6, w: 5, h: 3 }, count: 5 }, setup: { select: { x: 15, y: 6, w: 5, h: 3 } } },
  ],
  judge(input, args) {
    const area = rectArg(args, 'area');
    const count = numArg(args, 'count');
    const label = `영역 ${area.w}×${area.h} 흙+나무 ${count}`;
    const changed = changedCells(input.before, input.after);
    if (!changed.length) return fail(`${label}: 바뀐 칸이 없다`);
    const allowed = ringOf(cellsIn(area));
    const stray = changed.filter(cell => !allowed.has(keyOf(cell.x, cell.y)));
    if (stray.length) return fail(`${label}: 영역 밖 칸 ${stray.length}개가 바뀌었다 (예: ${stray[0]!.x},${stray[0]!.y})`);
    if (!sameExcept(input.before, input.after, withoutTiles)) return fail(`${label}: 타일 밖 내용이 바뀌었다`);
    const bare = cellsIn(area).filter(cell => !cellHasAny(input.after, cell.x, cell.y, ['sand', 'farm_lane', 'tree']));
    if (bare.length) return fail(`${label}: 바닥이 흙이 아닌 칸 ${bare.length}개 (예: ${bare[0]!.x},${bare[0]!.y} 「${cellLabel(input.after, bare[0]!.x, bare[0]!.y)}」)`);
    const trees = treeCount(input.before, input.after, cellsIn(area));
    if (!trees.cells) return fail(`${label}: 새로 놓인 나무가 없다`);
    if (trees.cells !== count && trees.clusters !== count) return fail(`${label}: 나무 ${trees.cells}칸/${trees.clusters}그루(요청 ${count}그루)`);
    return pass(`${label}: 흙 바닥 + 나무 ${trees.cells}칸`);
  },
  reference(project, args) {
    return chainBoth(project, rectArg(args, 'area'), numArg(args, 'count'));
  },
  wrongs(project, args): FamilyOutcome[] {
    const area = rectArg(args, 'area');
    const count = numArg(args, 'count');
    const floorOnly = fillRect(project, area, '버들항 모랫길');
    const treesOnly = placeTrees(project, area, count);
    const noFloor = runOn(placeTrees(project, area, count), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: -1, cells: cellsIn(area).slice(0, Math.ceil(area.w * area.h / 2)),
    });
    const sideEffect = runOn(chainBoth(project, area, count), 'paint_tiles', {
      mapId: MAP, layer: 'lower', mode: 'cells', tile: tileForTag(project, 'road'), cells: [{ x: 1, y: 16 }],
    });
    return [floorOnly, treesOnly, noFloor, sideEffect];
  },
};

export const GROUP_1_TILES: readonly Family[] = [
  clearRegion, copyRegion, mirrorRegion, placeTreesFamily, placeWellFamily, forestPathFamily,
  moveStartFamily, selectionSingleCell, selectionColumn, selectionL, selectionWholeMap, chainPaintThenPlace,
];

