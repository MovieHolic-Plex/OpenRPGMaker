import blueprint from '@/assets/pixelArtWorldSchoolBuilding.json';
import type { TilesetReferenceCategory } from '@/project/tilesetReferences';

/** Shared coordinates only. Source artwork is supplied by the importing user. */
export function pixelArtWorldSchoolBuildingGuide(filename: string, dataUrl: string): TilesetReferenceCategory | undefined {
  if (!['ST-Schl-I01.png', 'ST-Schl-I02.png'].includes(filename)) return;
  return {
    id: 'paw-school-building-blueprint', name: '학교 · 4층 / 방 구조',
    description: '교실 16·특별/관리실 8·화장실 4. 여러 원본을 함께 사용하는 청사진이며 현재 시트 번호와 합성 번호를 구분한다.',
    documents: [
      { id: 'guide', name: '먼저 읽기.md', markdown: blueprint.guide },
      { id: 'stairwell', name: '계단실 · 연결 벽과 계단참.md', markdown: blueprint.stairwellGuide },
      { id: 'dictionary', name: '원본·합성 번호·부품 사전.md', markdown: '합성 tile 번호는 이 청사진 전용이다. sources의 모든 원본을 확보하고 tiles의 source/tile로 해석한다. 현재 가져온 원본만으로 전체 층을 조립하지 않는다.\n\n```json\n' + JSON.stringify({ sources: blueprint.sources, tiles: blueprint.tiles, recipes: blueprint.recipes }) + '\n```\n\n![현재 원본](image:source)' },
      ...blueprint.floors.map(floor => ({ id: floor.id, name: `${floor.name} 전체 배열.md`, markdown: '```json\n' + JSON.stringify(floor) + '\n```' })),
    ],
    images: [{ id: 'source', name: filename, caption: '사용자가 가져온 원본. 완성 층 그림은 모든 원본으로 로컬 조립한 뒤 생성한다.', dataUrl }],
  };
}
