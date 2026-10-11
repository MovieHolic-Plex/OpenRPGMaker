// 버들항 자연 덧그림 팩 — 그림자·자연 물가·풀밭 가장자리(2026-10-11). 그림·목록은 scripts/content/build-beodeul-nature.py 가 굽는다.
// 모두 2층(lowerOverlayTiles) 투명 덧그림이라 통과·아래층 우선순위다 — 칸의 통행은 1·3층(물·물체)이 정한다.
// 마을 시공기(beodeulVillage.ts)가 translateTiles 로 버들항 시트 뒤에 이식해 쓴다. 이웃 비트 = 북서1 북2 북동4 서8 동16 남서32 남64 남동128.
import catalog from '@/assets/beodeulNatureCatalog.json';
import type { TilesetDef } from '../types';

export const BEODEUL_NATURE_ID = 'beodeul_nature';
export const BEODEUL_NATURE_TEXTURE = 'tex_beodeul_nature';
export interface NatureShadow { dx: number; dy: number; rows: number[][]; kind: 'tall' | 'block' }
export const BEODEUL_NATURE = catalog as unknown as {
  count: number; tilesPerRow: number;
  shadows: Record<string, NatureShadow>;
  bankGrass: number[]; bankLawn: number[]; edgeLawn: number[];
  /** 불투명 흙 화소(집 밑동)가 든 그림자 칸 — 길 위 4층으로 올리지 않는다. */
  soilTiles: number[];
};

export function createBeodeulNatureTileset(): TilesetDef {
  const n = catalog.count;
  return {
    id: BEODEUL_NATURE_ID, name: '버들항 · 자연 덧그림(그림자·물가·풀밭 가장자리)',
    image: { type: 'bundled', id: BEODEUL_NATURE_TEXTURE }, kind: 'custom', family: 'oprn-atlas',
    tileSize: 16, tilesPerRow: catalog.tilesPerRow, count: n,
    passability: Array.from({ length: n }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array(n).fill('lower'), terrain: Array(n).fill(0),
    referenceSourceTilesetId: 'beodeul_city',
  };
}
