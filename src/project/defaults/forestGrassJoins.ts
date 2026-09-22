import type { TilesetDef } from '../types';

export const FOREST_GRASS_JOINS_TEXTURE = 'tex_forest_harmony_grass_joins';
export function createForestGrassJoinsTileset(): TilesetDef {
  const sources = [504,505,240,498,499,528,529,619,712,559];
  return {
    id: 'forest_harmony_grass_joins', name: '숲마을 · 잔디 사선 경계',
    image: { type: 'bundled', id: FOREST_GRASS_JOINS_TEXTURE }, kind: 'custom',
    tileSize: 16, tilesPerRow: 10, count: 10,
    passability: sources.map((_,i) => ({ up:(i<3||i===9), down:(i<3||i===9), left:(i<3||i===9), right:(i<3||i===9) })),
    priority: sources.map(() => 'lower' as const), terrain: sources.map(() => 0),
    tileMeta: sources.map((tile,i): NonNullable<TilesetDef["tileMeta"]>[number] => ({
      label: i===2 ? '기존 바닥240 사본' : `숲마을 ${tile} · 색 맞춤`,
      description: (i<2||i===9) ? '504/505 사선과559 수평 반복의 원본 알파를 유지한 잔디 경계. 하위 바닥2 위에 합성하며 지붕/암벽 면이 아니다.' : '바닥240에 맞춘 색 보정판. 사전의 원본 번호/이식 번호를 구분한다.',
      role: (i<3||i===9) ? 'terrain' : 'cliff', defaultLayer: (i<3||i===9) ? 'lower' : 'upper',
      ...((i<2||i===9) ? { layerBacking:2 } : {}), passage: (i<3||i===9) ? 'passable' : 'solid', source:'bundled-default',
    })),
    tileGroups: [], referenceSourceTilesetId: 'forest_harmony',
  };
}

/** Append 559 to the shipped nine-cell sheet; preserve all authored metadata. */
export function extendForestGrassJoinsTileset(t: TilesetDef): boolean {
  if (t.image.type !== 'bundled' || t.image.id !== FOREST_GRASS_JOINS_TEXTURE
    || t.count !== 9 || t.tilesPerRow !== 9 || t.tileGrafts?.length) return false;
  const current = createForestGrassJoinsTileset();
  t.count = 10; t.tilesPerRow = 10;
  t.passability[9] = current.passability[9]!;
  t.priority[9] = current.priority[9]!;
  t.terrain[9] = current.terrain[9]!;
  if (t.tileMeta) t.tileMeta[9] = current.tileMeta![9]!;
  return true;
}
