import blueprint from '@/assets/pixelArtWorldCity.json';
import type { TilesetReferenceCategory } from './tilesetReferences';

/** Coordinate blueprint only; raster sources must be supplied by the user. */
export const PIXEL_ART_WORLD_CITY = blueprint;

export function pixelArtWorldCityGuide(filename: string, sourceDataUrl: string): TilesetReferenceCategory | null {
  if (!blueprint.sources.some(source => source.filename === filename)) return null;
  return {
    id: 'paw-city-50-blueprint', name: '도시 50×50 · 여러 원본 조립',
    description: '전체 배열과 원본 사전. 아래 번호는 이 청사진의 합성 atlas 전용이며 현재 시트 번호가 아니다.',
    images: [{ id: 'local-source', name: filename, caption: '이 프로젝트에서 가져온 원본. 나머지 의존 소재는 제작자에게서 별도로 다운로드한다.', dataUrl: sourceDataUrl }],
    documents: [
      { id: 'read-first', name: '조립 순서.md', markdown: [
        '# 햇살동 · 50×50 도시', blueprint.notes,
        '1. 아래 sources의 원본 PNG를 다운로드하고 SHA-256을 각각 확인한다. 빠진 원본을 비슷한 타일로 대체하지 않는다.',
        '2. tiles 사전 순서로 각 원본의 32px 조각을 새 사용자 atlas에 합성한다. 일반 원본 tile=y*8+x. XP 원본 tile은 variantMasks 인덱스이며 16px 쿼터 합성 계약을 읽는다.',
        '3. 같은 그림이어도 layer/passage가 다르면 별도 atlas 번호다. 하위는 항상 불투명 받침을 유지하고 상위의 투명 여백을 통행으로 오해하지 않는다.',
        '4. lowerTiles 전체 → upperTiles 전체 순서로 50×50 맵에 놓는다. entrances의 approach를 비워 두며 design의 도로·횡단 표시를 건물로 덮지 않는다.',
        '5. 시설은 해당 내부 원본의 scene 용도와 천장 오토타일 문서를 먼저 읽는다. 문 위치의 action 이벤트로 실내 이동, 실내 남쪽 touch 출구로 보도의 approach에 돌아온다.',
        '이 청사진만 가져왔다고 다른 원본이나 시설 이동 이벤트가 자동 설치되는 것은 아니다. 원본 그림은 사용자 프로젝트에서만 합성한다.',
        '[원작 및 이용 조건](https://yms.main.jp/dotartworld/page1/rule.html) · Pixel Art World / ドット絵世界',
        '![현재 원본](image:local-source)',
      ].join('\n\n') },
      { id: 'spatial-design', name: '구역·도로·연결 설계.md', markdown: `# 공간 청사진\n\n건물 bbox와 보행망을 먼저 읽고 타일을 놓는다. 이 데이터는 연구 모델 출력이 아니라 설계자가 작성한 게임 지도다.\n\n\`\`\`json\n${JSON.stringify(blueprint.design,null,2)}\n\`\`\`` },
      { id: 'sources', name: '원본·합성 번호 사전.md', markdown: `# 원본과 합성 번호\n\n\`\`\`json\n${JSON.stringify({sources:blueprint.sources,tiles:blueprint.tiles},null,2)}\n\`\`\`` },
      { id: 'arrays', name: '전체 하위·상위 배열.md', markdown: `# 행 우선 전체 배열\n\n\`\`\`json\n${JSON.stringify({width:blueprint.width,height:blueprint.height,lowerTiles:blueprint.lowerTiles,upperTiles:blueprint.upperTiles})}\n\`\`\`` },
      { id: 'entrances', name: '건물·입구·접근칸.md', markdown: `# 건물과 출입 동선\n\n\`\`\`json\n${JSON.stringify({placements:blueprint.placements,entrances:blueprint.entrances,start:blueprint.start},null,2)}\n\`\`\`` },
    ],
  };
}
