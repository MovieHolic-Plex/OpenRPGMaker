// 버들항 숲 composer 줄기 T3(나무껍질 대비, 2026-10-24 사용자 선택·허용). 그림·표는 scripts/content/fallen-forest-trunks/bake.py 가 굽는다.
// 원본 버들항 나무 키트와 화소가 다른 줄기·뿌리 칸만 들어 있다. beodeulForestComposer() 가 나무 이름별 표(cells)로
// 바뀐 칸만 translateTiles 로 대상 칩셋(beodeul_city 계열)에 이식한다 — 수관 칸은 원본 칸 번호 그대로다.
import catalog from '@/assets/beodeulForestTrunks.json';
import type { TilesetDef } from '../types';

export const BEODEUL_FOREST_TRUNKS_ID = 'beodeul_forest_trunks';
export const BEODEUL_FOREST_TRUNKS_TEXTURE = 'tex_beodeul_forest_trunks';
/** 나무 이름 → 칸마다 이 시트의 칸 번호(-1 = 원본 칸 그대로, -2 = 비움) · 덮개(%). */
export const BEODEUL_FOREST_TRUNKS = catalog as unknown as { count: number; cells: Record<string, number[]>; cover: Record<string, number[]> };

export function createBeodeulForestTrunksTileset(): TilesetDef {
  const n = catalog.count;
  return {
    id: BEODEUL_FOREST_TRUNKS_ID, name: '버들항 · 숲 나무 줄기(나무껍질 대비)',
    image: { type: 'bundled', id: BEODEUL_FOREST_TRUNKS_TEXTURE }, kind: 'custom', family: 'oprn-atlas',
    tileSize: 16, tilesPerRow: catalog.tilesPerRow, count: n,
    passability: Array.from({ length: n }, () => ({ up: false, down: false, left: false, right: false })),
    priority: Array.from({ length: n }, () => 'upper' as const), terrain: Array(n).fill(0),
    tileMeta: Array.from({ length: n }, () => ({ label: '버들항 · 나무 줄기', description: '숲 composer 활엽수 줄기·뿌리 칸(T3 나무껍질 대비). 원본 나무 키트 수관과 함께 쓴다.', tags: ['버들항', 'tree'] })),
  };
}
