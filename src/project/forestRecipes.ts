import saved from '@/assets/forestHarmonyTileset.json';
import { canMove, isPassable } from './collision';
import type { GameMap, Project, TilesetDef } from './types';

export const FOREST_RECIPE_PARTS = {
  tree: 'forest-trees:tree',
  'small-bush': 'forest-trees:small-bush',
  northwest: 'forest-enclosure:북서쪽 굽은 숲',
  northeast: 'forest-enclosure:북동쪽 감싸는 숲',
  east: 'forest-enclosure:동쪽 숲',
  southeast: 'forest-enclosure:남동쪽 굽은 숲',
  southwest: 'forest-enclosure:남서쪽 굽은 숲',
} as const;
export const FOREST_RECIPE_IDS = ['strip', ...Object.keys(FOREST_RECIPE_PARTS)] as const;
export type ForestRecipeInput = { recipeId: string; x: number; y: number; repeats?: number };
type Pattern = { width: number; height: number; lowerTiles: number[]; upperTiles: number[] };
export type ForestRecipePlan = Pattern & { x: number; y: number; parts: { id: string; x: number; y: number }[] };
export class ForestRecipeError extends Error {
  constructor(readonly code: string, message: string, readonly x?: number, readonly y?: number) { super(message); }
}
const fail = (code: string, message: string, x?: number, y?: number): never => { throw new ForestRecipeError(code, message, x, y); };

/** Read whole authored patterns. Fail closed if the source atlas or recipe has changed. */
export function compileForestRecipe(t: TilesetDef, input: ForestRecipeInput): ForestRecipePlan {
  // The recipes draw only from the shipped sheet (0..saved.count-1). Slots grafted past it (grove canopy 2550~,
  // village parts 2610~ — the bundled tileset itself carries them since 2026-09-25) do not change those cells, so only
  // grafts inside the original range must match. The old exact-count check rejected the bundled original as a
  // "derived sheet" as soon as any tool had grown it (2026-09-25 assistant trial).
  const baseGrafts = (grafts: readonly { targetTile: number; sourceChipset: string; sourceTile: number }[] | undefined) =>
    (grafts ?? []).filter(g => g.targetTile < saved.count).map(g => `${g.targetTile}:${g.sourceChipset}:${g.sourceTile}`).sort().join(',');
  if (t.id !== 'forest_harmony' || t.image.type !== 'bundled' || t.image.id !== 'tex_forest_harmony'
      || t.tileSize !== 16 || t.tilesPerRow !== 30 || t.count < saved.count || baseGrafts(t.tileGrafts) !== baseGrafts(saved.tileGrafts))
    fail('wrong-tileset', '공용 forest_harmony 16px/30열 원본에서만 사용하세요. 원본 칸(0~2549)에 다른 이식이 있는 파생판은 지원하지 않습니다.');
  if (![input.x, input.y].every(v => Number.isInteger(v) && v >= 0)) fail('invalid-origin', 'x/y는 0 이상의 정수입니다.');
  const part = (id: string): Pattern => {
    const original = saved.tileGroups.find(g => g.id === id)?.previewMap;
    const current = t.tileGroups?.find(g => g.id === id)?.previewMap;
    if (!original || JSON.stringify(original) !== JSON.stringify(current)) fail('recipe-source-changed', `부품 ${id}가 없거나 원본 배열과 다릅니다.`);
    return structuredClone(original!) as Pattern;
  };
  if (input.recipeId !== 'strip') {
    const id = FOREST_RECIPE_PARTS[input.recipeId as keyof typeof FOREST_RECIPE_PARTS];
    if (!id) fail('unsupported-recipe', `지원하지 않는 조립법: ${input.recipeId}`);
    if (input.repeats !== undefined) fail('invalid-repeat', 'repeats는 strip에서만 사용합니다.');
    return { ...part(id), x: input.x, y: input.y, parts: [{ id, x: input.x, y: input.y }] };
  }
  const n = input.repeats ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > 16) fail('invalid-repeat', 'strip repeats는 1~16 정수입니다.');
  const width = 6 * n + 2, height = 6;
  const plan: ForestRecipePlan = { x: input.x, y: input.y, width, height,
    lowerTiles: Array(width * height).fill(1141), upperTiles: Array(width * height).fill(-1), parts: [] };
  const put = (id: string, dx: number) => {
    const p = part(id);if (p.height !== 6) fail('recipe-source-changed', 'strip 부품 높이는 6이어야 합니다.');
    plan.parts.push({ id, x: input.x + dx, y: input.y });
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      const at = y * width + dx + x, from = y * p.width + x;
      plan.lowerTiles[at] = p.lowerTiles[from];plan.upperTiles[at] = p.upperTiles[from];
    }
  };
  for (let i = 0; i < n; i++) put('forest-repeat:body', 1 + 6 * i);
  put('forest-repeat:left', 0);put('forest-repeat:right', width - 4);
  return plan;
}

export function checkForestRecipeBounds(map: GameMap, p: ForestRecipePlan): void {
  if (p.x + p.width > map.width || p.y + p.height > map.height)
    fail('out-of-bounds', `필요 영역 (${p.x},${p.y}) ${p.width}×${p.height}가 맵 밖입니다. 자르지 말고 위치를 바꾸세요.`, p.x, p.y);
}
export function compareForestRecipe(map: GameMap, p: ForestRecipePlan) {
  checkForestRecipeBounds(map, p);
  const errors: { x: number; y: number; layer: string; expected: number; actual: number }[] = [];
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    for (const layer of ['lower', 'upper'] as const) {
      const wanted = p[`${layer}Tiles`][y * p.width + x], actual = map[`${layer}Tiles`][(p.y + y) * map.width + p.x + x];
      if (actual !== wanted) errors.push({ x: p.x + x, y: p.y + y, layer, expected: wanted, actual });
    }
  }
  return { valid: errors.length === 0, mismatchCount: errors.length, errors: errors.slice(0, 64) };
}

/** Tile-only access proof. Moving NPCs and runtime event conditions need separate play QA. */
export function forestRecipeAccess(project: Project, map: GameMap, points: { x: number; y: number }[] = []) {
  if (!points.length) return { status: 'not-requested', unreachable: [] };
  if (points.length < 2 || points.length > 16) fail('invalid-access', 'accessPoints는 2~16개입니다.');
  for (const p of points) if (![p.x, p.y].every(Number.isInteger) || !isPassable(project, map, p.x, p.y))
    fail('blocked-access', '출입구/집 앞 좌표가 맵 밖이거나 통행 불가입니다.', p.x, p.y);
  const start = points[0], queue = [start], seen = new Set([start.y * map.width + start.x]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const x = p.x + dx, y = p.y + dy, key = y * map.width + x;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(key)) continue;
      if (canMove(project, map, p.x, p.y, x, y)) { seen.add(key);queue.push({ x, y }); }
    }
  }
  const unreachable = points.filter(p => !seen.has(p.y * map.width + p.x));
  return { status: unreachable.length ? 'blocked' : 'tile-paths-connected', unreachable };
}

export function applyForestRecipe(project: Project, map: GameMap, p: ForestRecipePlan,
  overwrite = false, accessPoints: { x: number; y: number }[] = []) {
  checkForestRecipeBounds(map, p);
  const next = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    const mx = p.x + x, my = p.y + y, at = my * map.width + mx, from = y * p.width + x;
    if (map.events.some(e => e.x === mx && e.y === my)) fail('event-overlap', '이벤트가 있는 칸을 덮지 않습니다.', mx, my);
    const same = map.lowerTiles[at] === p.lowerTiles[from] && map.upperTiles[at] === p.upperTiles[from];
    if (!overwrite && !same && (map.upperTiles[at] >= 0 || ![240,1141,1145].includes(map.lowerTiles[at])))
      fail('occupied-cell', '빈 바탕이 아닙니다. preview 후 명시적으로 overwrite를 지정하거나 다른 위치를 고르세요.', mx, my);
    next.lowerTiles[at] = p.lowerTiles[from];next.upperTiles[at] = p.upperTiles[from];
  }
  const access = forestRecipeAccess(project, next, accessPoints);
  if (access.status === 'blocked') fail('blocked-access', '조립하면 출입구/집 앞 연결이 끊깁니다.', access.unreachable[0].x, access.unreachable[0].y);
  // Commit only after every check; no partial tree is left when a later cell fails.
  map.lowerTiles = next.lowerTiles;map.upperTiles = next.upperTiles;
  return { ...compareForestRecipe(map, p), access };
}
