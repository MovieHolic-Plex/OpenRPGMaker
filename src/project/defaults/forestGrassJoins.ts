import type { TilesetDef } from '../types';

export const FOREST_GRASS_JOINS_TEXTURE = 'tex_forest_harmony_grass_joins';
export function createForestGrassJoinsTileset(): TilesetDef {
  const sources = [504,505,240,498,499,528,529,619,712];
  return {
    id: 'forest_harmony_grass_joins', name: '숲마을 · 잔디 사선 경계',
    image: { type: 'bundled', id: FOREST_GRASS_JOINS_TEXTURE }, kind: 'custom',
    tileSize: 16, tilesPerRow: 9, count: 9,
    passability: sources.map((_,i) => ({ up:i<3, down:i<3, left:i<3, right:i<3 })),
    priority: sources.map(() => 'lower' as const), terrain: sources.map(() => 0),
    tileMeta: sources.map((tile,i): NonNullable<TilesetDef["tileMeta"]>[number] => ({
      label: i===2 ? '기존 바닥240 사본' : `숲마을 ${tile} · 색 맞춤`,
      description: i<2 ? '504/505 사선의 투명 모양을 유지한 잔디 경계. 하위 바닥2 위에 합성하며 지붕/암벽 면이 아니다.' : '바닥240에 맞춘 색 보정판. 사전의 원본 번호/이식 번호를 구분한다.',
      role: i<3 ? 'terrain' : 'cliff', defaultLayer: i<3 ? 'lower' : 'upper',
      ...(i<2 ? { layerBacking:2 } : {}), passage: i<3 ? 'passable' : 'solid', source:'bundled-default',
    })),
    tileGroups: [], referenceSourceTilesetId: 'forest_harmony',
  };
}
