import { XP_AUTOTILE_MASKS, xpAutotileQuarters, xpAutotileExample, validateXpAutotileExample, xpAutotileGroup, type PixelArtWorldAutotilePack } from '@/project/pixelArtWorldAutotiles';
import type { TilesetReferenceCategory } from '@/project/tilesetReferences';

export function drawXpAutotile(context: CanvasRenderingContext2D, source: CanvasImageSource, mask: number, x: number, y: number): void {
  for (const quarter of xpAutotileQuarters(mask)) {
    context.drawImage(source, quarter.sx, quarter.sy, 16, 16, x + quarter.dx, y + quarter.dy, 16, 16);
  }
}

export function createPixelArtWorldAutotileReferences(pack: PixelArtWorldAutotilePack, image: HTMLImageElement, sourceDataUrl: string, offset: number, tilesetId: string): TilesetReferenceCategory {
  const atlas = document.createElement('canvas');
  atlas.width = 256; atlas.height = 192;
  const context = atlas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  XP_AUTOTILE_MASKS.forEach((mask, index) => drawXpAutotile(context, image, mask, index % 8 * 32, Math.floor(index / 8) * 32));
  const example = xpAutotileExample(offset);
  const bad = { ...example, lowerTiles: [...example.lowerTiles], upperTiles: [...example.upperTiles] };
  // Replace top-left convex corner with center; remove one actual thin-run cell.
  bad.lowerTiles[example.width + 1] = offset + XP_AUTOTILE_MASKS.indexOf(255);
  bad.lowerTiles[3 * example.width + 8] = -1;
  // Misroute one edge into upper: transparent alpha and render layer are independent.
  bad.upperTiles[example.width + 2] = bad.lowerTiles[example.width + 2];
  bad.lowerTiles[example.width + 2] = -1;
  const comparison = document.createElement('canvas');
  comparison.width = example.width * 32 * 2 + 8; comparison.height = example.height * 32;
  const compareContext = comparison.getContext('2d')!;
  compareContext.imageSmoothingEnabled = false;
  const draw = (map: typeof example, ox: number) => {
    compareContext.fillStyle = '#72838a';
    compareContext.fillRect(ox, 0, example.width * 32, example.height * 32);
    for (const layer of [map.lowerTiles, map.upperTiles]) layer.forEach((tile, i) => {
      if (tile < 0) return;
      drawXpAutotile(compareContext, image, XP_AUTOTILE_MASKS[tile - offset], ox + i % map.width * 32, Math.floor(i / map.width) * 32);
    });
  };
  draw(example, 0); draw(bad, example.width * 32 + 8);
  const dictionary = XP_AUTOTILE_MASKS.map((mask, index) => ({ tile: offset + index, mask, quarters: xpAutotileQuarters(mask) }));
  return {
    id: pack.id, name: `${pack.name} · 자동 연결`,
    description: '확인된 사용자 원본에서 생성. 8방향·16px 쿼터를 47종 32px 타일로 합성. 문/정면 벽/이벤트 저작은 별도.',
    images: [
      { id: 'source', name: pack.filename, caption: '사용자가 가져온 실제 96×128 원본. 16px 쿼터; 원본 12칸을 완성 타일로 나누지 않는다.', dataUrl: sourceDataUrl },
      { id: 'variants', name: 'variants.png', caption: `실제 합성 47종. 그림은 8열, 왼쪽 위부터 사전 순서. 프로젝트 타일 ID는 ${offset}부터. 마지막 공백은 변형이 아니다.`, dataUrl: atlas.toDataURL('image/png') },
      { id: 'comparison', name: 'connections-comparison.png', caption: '왼쪽 정상 / 오른쪽 오류. 배경 청회색은 비교용 캔버스 색이며 타일이 아니다. 실타일 원래 32px. 오류: 외곽 모서리, 얇은 선 누락, upper 이동.', dataUrl: comparison.toDataURL('image/png') },
    ],
    documents: [
      { id: 'read-first', name: '먼저 읽기.md', markdown: [
        `# ${pack.name}\n\ntilesetId: ${tilesetId}\n\n${pack.description}`,
        `원본: ${pack.filename}, 96×128px, 정적 XP 형식. SHA-256: ${pack.sha256}. 확인일: ${pack.checkedAt}.`,
        `[제작자](${pack.sourcePage}) · [이용 조건](${pack.termsUrl})\n\n${pack.credit}`,
        '원본/가공 소재를 재배포하지 않는다. 공개 게임에 제작자 크레딧을 남긴다. 여기 그림은 사용자가 가져온 원본에서 프로젝트 안에 생성했다.',
        `## 레이어와 통행\n\n이 그룹은 lower, ${pack.passage}. 기존 타일 번호/그림/통행은 보존하고 새 변형만 추가했다. 투명색 추가 제거·리사이즈·좌우 반전을 하지 않는다. 원본의 불투명 몸통을 투명색으로 지우지 않는다. upper의 가구와 겹치기 전 벽 영역/통행을 확인한다.`,
        '## 저작 순서\n\n1. 이 용도의 MD와 이미지를 전부 읽는다.\n2. 막힌 벽/천장 또는 바닥 영역을 먼저 정한다.\n3. lower에 같은 그룹의 아무 변형으로 영역을 칠한다. 편집기 자동 연결이 주변 8방향을 재계산한다. 서로 다른 재료 그룹은 연결하지 않는다.\n4. 외곽은 볼록, 양 직교가 연결되고 대각만 비면 오목 조각을 쓴다. 단독 칸은 원본 좌상단 전용 그림이다. 얇은 가로/세로 선은 양쪽 반쪽을 합성한다. 최소 크기 1×1.\n5. 원본 96×128의 12칸을 9슬라이스로 복사하지 않는다.\n6. 방의 정면 벽/문/바닥은 별도 원본의 검토된 사전을 사용한다. 문앞 접근칸·이벤트·전이는 이 그룹으로 생기지 않는다.',
        '자동 성형을 거치지 않는 직접 배열 저작은 사전의 256개 variantMap과 엔진의 N=1,E=2,S=4,W=8,NE=16,SE=32,SW=64,NW=128을 사용한다. 맵 밖은 비연결이다. 방향에 대응하는 양 직교 중 하나라도 없으면 그 대각 비트는 무시한다.',
        '![실제 원본](image:source)\n\n![실제 변형](image:variants)',
      ].join('\n\n') },
      { id: 'dictionary', name: '쿼터와 변형 사전.md', markdown: [
        '# 정확한 좌표 사전',
        '모든 sx,sy는 원본 PNG의 0기준 픽셀 좌표, dx,dy는 목적 32px 타일 안의 픽셀 좌표. 각 조각은 16×16px. 인덱스 순서는 NW,NE,SW,SE. source_rect는 (sx,sy,16,16). 확대/회전 없음. 타일 ID는 현재 타일셋 전용이며 다른 시트에 옮겨 쓸 수 없다.',
        `\`\`\`json\n${JSON.stringify(dictionary, null, 2)}\n\`\`\``,
        `## 모든 8방향 입력 → 목적 타일\n\n\`\`\`json\n${JSON.stringify(xpAutotileGroup(pack, offset).variantMap)}\n\`\`\``,
      ].join('\n\n') },
      { id: 'examples', name: '완성 배열과 오류.md', markdown: [
        '# 직사각형·구멍·외딴 점·얇은 선·L/T/십자',
        '원점=(0,0). 아래 width×height 전체 배열을 사용한다. -1은 이 부품이 점유하지 않는 칸이며, 다른 방에 적용할 때 기존 바닥을 지우라는 뜻이 아니다. lower에만 배치. 가로 선 양끝/세로 선 양끝과 구멍의 오목 코너를 모두 확인한다.',
        `\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\``,
        '![정상/오류 실타일](image:comparison)',
        `오류 비교 전체 배열:\n\n\`\`\`json\n${JSON.stringify(bad, null, 2)}\n\`\`\``,
        `검출 코드와 좌표:\n\n\`\`\`json\n${JSON.stringify(validateXpAutotileExample(offset, bad))}\n\`\`\``,
        'validateXpAutotileExample은 이 고정 specimen의 크기, 정확한 47종 연결 타일, lower/upper 배치를 대조한다. 잘못된 외곽/오목 코너, 누락/연결 단절=XP_CONNECTION, upper 오배치=XP_WRONG_LAYER. 통행은 그룹 전체가 위 문서의 passage를 따르며 방 전체 경로 탐색·실행 이벤트·미학·AI 배치 성공률은 이 검사 범위가 아니다.',
      ].join('\n\n') },
    ],
  };
}
