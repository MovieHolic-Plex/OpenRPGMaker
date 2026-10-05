import sheet from '@/assets/worldmapAuthoringSheet.json';
const WORLDMAP_BRUSHES = sheet.brushes;
import type { GameMap, TileGroupMetadata, TilesetDef } from './types';

type Material = { kind: string; background: string };
type Point = { x: number; y: number };
const LAND = new Set(['grass', 'sand', 'snow', 'dirt', 'swamp', 'tundra', 'ash', 'red', 'savanna', 'jungle', 'glacier', 'dune', 'farm', 'crop']);
const ALIASES: Record<string, string> = {
  '초원': 'grass', '잔디': 'grass', '사막': 'sand', '모래': 'sand', '설원': 'snow', '눈': 'snow',
  '강': 'river', '하천': 'river', '길': 'road', '도로': 'road', '흙길': 'road',
  '물': 'sea', '호수': 'sea', '연못': 'sea', '바다·호수': 'sea',
  '숲': 'forest', '활엽수 숲': 'forest', '침엽수 숲': 'conifer', '눈 숲': 'snowforest', '설원 숲': 'snowforest',
  '눈 덮인 숲': 'snowforest', '눈 덮인 침엽수 숲': 'snowforest', '설원 침엽수림': 'snowforest',
  '산': 'mountain', '산맥': 'mountain', '설산': 'snowmountain', '눈 산맥': 'snowmountain',
};
export function worldmapBrushMaterial(t: TilesetDef | undefined, tile: number): Material | undefined {
  const tags = t?.tileMeta?.[tile]?.tags;
  return tags?.[0] === 'worldmap-brush' ? { kind: tags[1]!, background: tags[2]! } : undefined;
}
/** Generic material names choose a brush; explicit background names retain their contract. */
export function worldmapMaterialGroup(t: TilesetDef, query: unknown): TileGroupMetadata | undefined {
  if (typeof query !== 'string' || !t.autotileGroups?.some(g => g.id === 'worldmap-brush-grass-sea')) return;
  const raw = query.trim();
  const kind = ALIASES[raw] ?? WORLDMAP_BRUSHES.find(b => b.name === raw)?.kind;
  if (!kind) return;
  const brush = WORLDMAP_BRUSHES.find(b => b.kind === kind && b.background === (LAND.has(kind) ? 'sea' : 'any'))
    ?? WORLDMAP_BRUSHES.find(b => b.kind === kind && b.background === 'grass')
    ?? WORLDMAP_BRUSHES.find(b => b.kind === kind);
  return t.tileGroups?.find(g => g.id === brush?.id);
}
function representative(t: TilesetDef, kind: string, background: string): number | undefined {
  const brush = WORLDMAP_BRUSHES.find(b => b.kind === kind && b.background === background);
  const auto = t.autotileGroups?.find(g => g.id === brush?.id);
  return auto?.variantMap['0'] ?? t.tileGroups?.find(g => g.id === brush?.id)?.tileIds[0];
}
function at(map: GameMap, t: TilesetDef, x: number, y: number): Material | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  return worldmapBrushMaterial(t, map.lowerTiles[y * map.width + x]!);
}
function ground(material: Material | undefined): string | undefined {
  if (!material) return;
  if (LAND.has(material.kind)) return material.kind === 'glacier' ? 'snow' : material.kind === 'dune' ? 'sand' : material.kind;
  return ['grass', 'sand', 'snow'].includes(material.background) ? material.background : undefined;
}
function nearbyGround(map: GameMap, t: TilesetDef, x: number, y: number): string {
  for (let distance = 1; distance <= 8; distance++) {
    for (const [dx, dy] of [[-distance, 0], [distance, 0], [0, -distance], [0, distance]]) {
      const bg = ground(at(map, t, x + dx!, y + dy!));
      if (bg) return bg;
    }
  }
  return 'grass';
}
/** Per-cell context shared by the native brush, hover and AI fill/path tools. */
export function worldmapAutoTile(map: GameMap, t: TilesetDef, tile: number, x: number, y: number, points: readonly Point[] = []): number {
  const selected = worldmapBrushMaterial(t, tile);
  if (!selected || selected.background === 'any' || selected.background === 'plain') return tile;
  const previous = at(map, t, x, y);
  let kind = selected.kind;
  let bg = ground(previous) ?? nearbyGround(map, t, x, y);
  if (LAND.has(kind)) {
    if (previous?.kind === 'sea' && previous.background === 'plain'
      || previous?.kind === kind && previous.background === 'sea') bg = 'sea';
    if (kind === bg) return t.tileGroups?.find(g => g.id === 'worldmap-brush-plain-' + kind)?.tileIds[0] ?? tile;
  }
  if (kind === 'road' && (previous?.kind === 'river' || previous?.kind.startsWith('bridge-'))) {
    const has = (dx: number, dy: number) => points.some(p => p.x === x + dx && p.y === y + dy)
      || ['road', 'bridge-horizontal', 'bridge-vertical'].includes(at(map, t, x + dx, y + dy)?.kind ?? '');
    const horizontal = Number(has(-1, 0)) + Number(has(1, 0));
    const vertical = Number(has(0, -1)) + Number(has(0, 1));
    // A single click follows the river banks; a stroke follows its road axis.
    const riverVertical = at(map, t, x, y - 1)?.kind === 'river' || at(map, t, x, y + 1)?.kind === 'river';
    kind = horizontal === vertical ? previous?.kind.startsWith('bridge-') ? previous.kind : riverVertical ? 'bridge-horizontal' : 'bridge-vertical'
      : horizontal > vertical ? 'bridge-horizontal' : 'bridge-vertical';
  }
  if (kind.startsWith('bridge-') && bg !== 'sand' && bg !== 'snow') bg = 'water';
  return representative(t, kind, bg) ?? representative(t, kind, 'grass') ?? tile;
}

/** Removing a bridge restores its river; removing a path restores its own ground. */
export function worldmapEraseTile(t: TilesetDef | undefined, tile: number): number | undefined {
  const material = worldmapBrushMaterial(t, tile);
  if (!t || !material || material.background === 'any') return;
  if (material.kind.startsWith('bridge-')) return representative(t, 'river', material.background === 'water' ? 'grass' : material.background);
  const kind = material.background === 'sea' || material.background === 'plain' ? 'sea' : material.background;
  return t.tileGroups?.find(g => g.id === 'worldmap-brush-plain-' + kind)?.tileIds[0];
}
